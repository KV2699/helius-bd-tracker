#!/usr/bin/env node
// Rolling 14-day batches, newest first.
//
// One 90-day sweep asked the collector to pull a handful of candidates out of
// years of archive. Four 14-day batches let it read each slice properly, and
// give a dated evidence history instead of one undated snapshot.
//
// Every batch is its own run on disk. Nothing is overwritten; evidence is
// MERGED into the account history, keyed on (entity, date, quote).
//   node batches.js                      4 batches of 14 days from today
//   node batches.js --batches 6 --days 14
import { runScan, saveRun } from './pipeline/run.js';
import { sourcePlan } from './pipeline/sources.js';
import { writeFile, mkdir, readFile, readdir } from 'node:fs/promises';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const nBatches = Number(arg('batches', 4));
const span     = Number(arg('days', 14));
const budget   = Number(arg('budget', 2));
const anchor   = arg('anchor', new Date().toISOString().slice(0, 10));

const day = 86400000;
const windows = [];
for (let i = 0; i < nBatches; i++) {
  const to   = new Date(new Date(anchor).getTime() - i * span * day).toISOString().slice(0, 10);
  const from = new Date(new Date(anchor).getTime() - (i + 1) * span * day).toISOString().slice(0, 10);
  windows.push({ from, to, days: span });
}

console.log(`\nROLLING BATCHES - ${nBatches} x ${span} days, newest first`);
windows.forEach((w, i) => console.log(`  Batch ${i + 1}: ${w.to} back to ${w.from}`));
console.log();

const plan = sourcePlan();
const batches = [];

// UNDATED SURFACES ARE READ ONCE PER SWEEP, NOT ONCE PER WINDOW.
//
// The first 7-batch sweep collected 130 standing conditions for 22 distinct
// facts - every one of them appeared in more than one batch - and that
// duplication was about half the $0.59 the sweep cost. The reason is in the
// definition: a standing condition is a fact off a page that carries NO DATE.
// Such a page cannot ever produce a dated row, in this window or any other, so
// re-reading it for six more windows buys nothing. It is dropped from the plan
// after the batch that first read it.
//
// A surface that produced even one DATED row stays in the plan for every
// window, and so does a surface that produced nothing at all - a blog index
// whose posts were all out of window this time may well be in window later.
// Only standing-ONLY surfaces are retired, and the run says which.
const undatedSurfaces = new Set();
const retireUndated = rows => {
  const dated = new Set(), standing = new Set();
  for (const r of rows) {
    if (!r.source_url) continue;
    (r.standing ? standing : dated).add(r.source_url);
  }
  const retired = [...standing].filter(u => !dated.has(u));
  retired.forEach(u => undatedSurfaces.add(u));
  return retired;
};

for (const [i, window] of windows.entries()) {
  console.log(`\n${'='.repeat(70)}\nBATCH ${i + 1}  ${window.to} -> ${window.from}\n${'='.repeat(70)}`);
  const urls = plan.filter(p => !undatedSurfaces.has(p.url ?? p));
  const skipped = plan.length - urls.length;
  if (skipped) console.log(`  (${skipped} undated surface(s) already read this sweep - not re-reading)`);
  let result;
  try {
    result = await runScan({ urls, window, budgetUsd: budget,
      onEvent: e => { if (/^(fetched|\d+ candidate|grounded)/.test(e.msg) === false) return;
                      process.stdout.write(`  [${e.stage}] ${e.msg}\n`); } });
  } catch (e) {
    console.error(`  batch failed: ${e.message}`);
    batches.push({ window, error: e.message });
    continue;
  }
  const file = await saveRun(result);

  const reasons = {};
  for (const r of (result.rejected || [])) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
  const b = { batch: i + 1, window, runId: result.runId, file,
              sources: (result.sourcesFetched || result.fetched || []).length,
              rows: (result.rows || []).length,
              dated: (result.rows || []).filter(r => !r.standing).length,
              standing: (result.rows || []).filter(r => r.standing).length,
              rejected: (result.rejected || []).length, reasons,
              cost: result.cost?.usd ?? null, calls: result.cost?.calls ?? null };
  b.sourcesSkipped = skipped;
  b.retiredUndated = retireUndated(result.rows || []);
  batches.push(b);
  console.log(`  -> ${b.sources} sources · ${b.rows} rows (${b.dated} dated, ${b.standing} standing) · ` +
              `${b.rejected} rejected · $${(b.cost ?? 0).toFixed(4)}`);
}

/* ---- MERGE into the account history. Append only. ---------------------- */
const HIST = 'data/history.json';
let history = { accounts: {}, batchesSeen: [] };
try { history = JSON.parse(await readFile(HIST, 'utf8')); } catch {}

// Merge EVERY run on disk that history has not seen, not just the ones this
// invocation produced. A batch run separately with scan.js is still a batch,
// and the history is append-only by design.
let added = 0, already = 0;
const onDisk = (await readdir('data/runs')).filter(f => f.startsWith('run-') && f.endsWith('.json'));
const merged = batches.filter(b => !b.error).map(b => ({ runId: b.runId, file: b.file, batch: b.batch, window: b.window }));
for (const f of onDisk) {
  if (merged.some(m => m.file.endsWith(f))) continue;
  try {
    const r = JSON.parse(await readFile(`data/runs/${f}`, 'utf8'));
    if (r.runId && r.window) merged.push({ runId: r.runId, file: `data/runs/${f}`, batch: null, window: r.window });
  } catch {}
}
for (const b of merged) {
  if (history.batchesSeen.includes(b.runId)) continue;
  const run = JSON.parse(await readFile(b.file, 'utf8'));
  for (const row of (run.rows || [])) {
    const acct = (history.accounts[row.entity] ||= { entity: row.entity, evidence: [] });
    // Keyed on what the evidence IS, not when we happened to read it, so the
    // same event found in two overlapping batches merges instead of doubling.
    const key = `${row.event_date}|${String(row.quote).slice(0, 80)}`;
    if (acct.evidence.some(e => e.key === key)) { already++; continue; }
    acct.evidence.push({ key, date: row.event_date, standing: !!row.standing,
                         date_basis: row.date_basis || (row.standing ? 'observed_on_fetch' : 'stated in source'),
                         quote: row.quote, source: row.source_url, batch: b.batch,
                         window: `${b.window.from}..${b.window.to}`, runId: b.runId });
    added++;
  }
  history.batchesSeen.push(b.runId);
}
await mkdir('data', { recursive: true });
await writeFile(HIST, JSON.stringify(history, null, 2));

/* ---- REPORT ------------------------------------------------------------ */
console.log(`\n${'='.repeat(70)}\nBATCH TIMELINE\n${'='.repeat(70)}`);
for (const b of batches) {
  if (b.error) { console.log(`\nBatch ${b.batch ?? '?'}: ${b.window.to} -> ${b.window.from}  FAILED: ${b.error}`); continue; }
  console.log(`\nBatch ${b.batch}: ${b.window.to} -> ${b.window.from}`);
  console.log(`  ${b.sources} sources read${b.sourcesSkipped ? ` (${b.sourcesSkipped} undated, already read)` : ''}` +
              ` · ${b.dated} dated rows · ${b.standing} standing conditions`);
  console.log(`  ${b.rejected} rejected: ${Object.entries(b.reasons).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
  console.log(`  $${(b.cost ?? 0).toFixed(4)} · ${b.calls} calls`);
}

const ok = batches.filter(b => !b.error);
const totalCost = ok.reduce((a, b) => a + (b.cost || 0), 0);
const allReasons = {};
for (const b of ok) for (const [k, v] of Object.entries(b.reasons)) allReasons[k] = (allReasons[k] || 0) + v;

console.log(`\n${'='.repeat(70)}`);
console.log(`${ok.length} batches · ${ok.reduce((a, b) => a + b.rows, 0)} rows · ` +
            `${ok.reduce((a, b) => a + b.rejected, 0)} rejected · $${totalCost.toFixed(4)} total`);
console.log(`Rejections across all batches: ${Object.entries(allReasons).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`History: ${Object.keys(history.accounts).length} accounts · ${added} new pieces of evidence · ${already} already held`);

const runId = 'batches-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
await writeFile(`data/runs/${runId}.json`, JSON.stringify({ runId, anchor, batches, totalCost }, null, 2));
console.log(`\nSaved: data/runs/${runId}.json`);
console.log(`Now run: npm run funnel\n`);
