// Serves the interface and exposes the pipeline. The interface is a view;
// all inference happens here, on NEAR AI Cloud.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { runScan, saveRun } from './pipeline/run.js';
import { SEED_URLS, sourcePlan } from './pipeline/sources.js';

// A run id carries its WINDOW before its stamp ("run-2026-10-29_to_2026-11-12
// -2026-11-13T20-39-15"), so a plain lexical sort puts an October window ahead
// of a November one and "latest" shows a stale run. Sort on the trailing
// ISO stamp instead, which is the only part that orders runs in time.
const runStamp = f => (String(f).match(/(\d{4}-\d{2}-\d{2}T[\d-]{8})(?=\.json$|$)/) || [, ''])[1];
const byStamp = (a, b) => (runStamp(a) || a).localeCompare(runStamp(b) || b);

// "Latest" means the most recent EVIDENCE WINDOW, not the most recently
// written file. A 7-batch sweep walks backwards, so batch 7 - the August
// window - is written last, and sorting by stamp made the interface show
// three-month-old evidence as current. Sort on the window's end date when the
// filename carries one, and fall back to the write stamp for runs that have no
// window in the name.
const runWindowEnd = f => (String(f).match(/_to_(\d{4}-\d{2}-\d{2})/) || [, ''])[1];
const byWindow = (a, b) => {
  const wa = runWindowEnd(a), wb = runWindowEnd(b);
  if (wa && wb && wa !== wb) return wa.localeCompare(wb);
  return byStamp(a, b);
};

const PORT = Number(process.env.PORT || 8742);
const ROOT = process.cwd();
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
                '.json':'application/json; charset=utf-8', '.css':'text/css; charset=utf-8',
                '.svg':'image/svg+xml', '.png':'image/png', '.md':'text/markdown; charset=utf-8' };

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Is the scanner usable in this process? The UI asks before offering the button.
  if (url.pathname === '/api/status') {
    return json(res, 200, {
      ready: !!process.env.NEAR_AI_API_KEY,
      provider: 'NEAR AI Cloud',
      baseUrl: process.env.NEAR_AI_BASE_URL || 'https://cloud-api.near.ai/v1',
      reason: process.env.NEAR_AI_API_KEY ? null
        : 'NEAR_AI_API_KEY is not set. Claim a key at cloud.near.ai (free $10 via nearbuilders.org/join).'
    });
  }

  // Load the most recent scan + monitor so the page populates on open.
  // The tracker workbook. Built on request from the live registry and the
  // latest run, so it can never drift from what the interface is showing.
  if (url.pathname === '/api/tracker.xlsx') {
    try {
      const { buildTracker } = await import('./tracker/build.js');
      const buf = buildTracker();
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Helius-BD-Tracker.xlsx"',
        'Content-Length': buf.length,
        'Cache-Control': 'no-store'
      });
      return res.end(buf);
    } catch (e) { return json(res, 500, { error: e.message }); }
  }

  if (url.pathname === '/api/latest') {
    const pick = async (prefix) => {
      try {
        const fs = (await readdir('data/runs')).filter(f => f.startsWith(prefix) && f.endsWith('.json')).sort(byWindow);
        if (!fs.length) return null;
        return JSON.parse(await readFile(join('data/runs', fs[fs.length - 1]), 'utf8'));
      } catch { return null; }
    };
    const fn = await pick('funnel-');
    const bt = await pick('batches-');
    return json(res, 200, { result: await pick('run-'), monitor: await pick('monitor-'),
                            funnel: fn ? { ...fn.summary, rows: fn.rows } : null,
                            batches: bt ? bt.batches : null });
  }

  if (url.pathname === '/api/monitor' && req.method === 'POST') {
    let body=''; for await (const c of req) body += c;
    let o={}; try{ o=JSON.parse(body||'{}'); }catch{}
    const days = Number(o.days || 90);
    const to2 = new Date(), from2 = new Date(to2.getTime() - days*86400000);
    const win = { from: from2.toISOString().slice(0,10), to: to2.toISOString().slice(0,10), days };
    try {
      const { NearAI, Ledger, loadPrices } = await import('./pipeline/near.js');
      const { monitorAccounts } = await import('./pipeline/monitor.js');
      const { ICP, surfaceReport } = await import('./pipeline/icp.js');
      const runId = `monitor-${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}`;
      const ledger = new Ledger(runId, 1);
      const ai = new NearAI(ledger);
      await loadPrices();
      const r = await monitorAccounts({ ai, window: win });
      const out = { runId, generatedAt:new Date().toISOString(), window:win, ...r,
        researchBlocked: ICP.filter(a=>a.blocked).map(a=>({account:a.name, ...surfaceReport(a)})),
        cost: ledger.totals };
      await (await import('node:fs/promises')).writeFile(`data/runs/${runId}.json`, JSON.stringify(out,null,2));
      return json(res, 200, { ok:true, result: out });
    } catch (e) { return json(res, 200, { ok:false, error: e.message }); }
  }

  if (url.pathname === '/api/runs') {
    try {
      const files = (await readdir('data/runs')).filter(f => f.endsWith('.json') && f !== 'latest.json').sort(byWindow).reverse();
      return json(res, 200, { runs: files });
    } catch { return json(res, 200, { runs: [] }); }
  }

  // The newest discovery pass: roster-sourced NAMES, not leads. Served
  // separately from /api/latest so the interface can never show a candidate
  // in the same list as a scored row - a name on a roster has evidenced
  // nothing, and the two must not be mixed.
  if (url.pathname === '/api/discovered') {
    try {
      const files = (await readdir('data/discovered')).filter(f => f.endsWith('.json')).sort(byStamp);
      if (!files.length) return json(res, 200, { discovery: null });
      const d = JSON.parse(await readFile(join('data/discovered', files[files.length - 1]), 'utf8'));
      return json(res, 200, { discovery: d, history: files.slice().reverse() });
    } catch (e) { return json(res, 200, { discovery: null, error: e.message }); }
  }

  // Outreach packets built from the LATEST FUNNEL RUN. Every packet is a thing
  // a human approves; nothing here sends, and no recipient is ever invented.
  if (url.pathname === '/api/outreach') {
    try {
      const { buildOutreach } = await import('./pipeline/outreach.js');
      const { ICP } = await import('./pipeline/icp.js');
      const files = (await readdir('data/runs')).filter(f => f.startsWith('funnel-') && f.endsWith('.json')).sort(byWindow);
      if (!files.length) return json(res, 200, { outreach: null, reason: 'no funnel run on disk - run: node funnel.js' });
      const fn = JSON.parse(await readFile(join('data/runs', files[files.length - 1]), 'utf8'));
      const rows = fn.rows || fn.placed || [];
      const out = buildOutreach(rows, { accounts: ICP });
      out.funnelRun = fn.runId || files[files.length - 1];
      return json(res, 200, { outreach: out });
    } catch (e) { return json(res, 200, { outreach: null, error: e.message }); }
  }

  if (url.pathname === '/api/run' && req.method === 'POST') {
    let body = '';
    for await (const c of req) body += c;
    let opts = {}; try { opts = JSON.parse(body || '{}'); } catch {}
    const days = Number(opts.days || 90);
    const to = new Date(), from = new Date(to.getTime() - days * 86400000);

    // Stream the stage log so the office animates against real progress.
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache' });
    const send = o => res.write(JSON.stringify(o) + '\n');
    try {
      const result = await runScan({
        urls: opts.urls?.length ? opts.urls : sourcePlan(),
        window: { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10), days },
        budgetUsd: Number(opts.budget || 2),
        onEvent: e => send({ type: 'event', ...e })
      });
      await saveRun(result);
      send({ type: 'done', result });
    } catch (e) {
      send({ type: 'error', message: e.message });
    }
    return res.end();
  }

  // static
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  const safe = normalize(join(ROOT, p));
  if (!safe.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  try {
    const buf = await readFile(safe);
    res.writeHead(200, { 'Content-Type': TYPES[extname(safe)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(PORT, () => {
  console.log(`\nHelius BD Tracker  http://localhost:${PORT}`);
  console.log(process.env.NEAR_AI_API_KEY
    ? '  Scanner: READY (NEAR AI Cloud)\n'
    : '  Scanner: DISABLED - NEAR_AI_API_KEY not set. Interface runs; Run scan is unavailable.\n');
});
