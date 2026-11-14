#!/usr/bin/env node
// Account Monitor: what changed on our verified registry surfaces, and when.
//   NEAR_AI_API_KEY=... node monitor.js --days 90
import { NearAI, Ledger, loadPrices } from './pipeline/near.js';
import { monitorAccounts } from './pipeline/monitor.js';
import { ICP, surfaceReport } from './pipeline/icp.js';
import { writeFile, mkdir } from 'node:fs/promises';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const days = Number(arg('days', 90));
const to = new Date(), from = new Date(to.getTime() - days * 86400000);
const window = { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10), days };
const runId = `monitor-${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}`;

console.log(`\nAccount Monitor - ${window.from} to ${window.to}`);
console.log(`Registry: ${ICP.length} accounts | Inference: NEAR AI Cloud\n`);

const ledger = new Ledger(runId, Number(arg('budget', 1)));
try {
  const ai = new NearAI(ledger);
  await loadPrices();
  const res = await monitorAccounts({ ai, window, onEvent: e => console.log(`  [${e.stage}] ${e.msg}`) });

  const blocked = ICP.filter(a => a.blocked).map(a => ({ account:a.name, ...surfaceReport(a) }));
  const out = { runId, generatedAt:new Date().toISOString(), window, ...res, researchBlocked:blocked,
                cost: ledger.totals, costLines: ledger.lines };
  await mkdir('data/runs', { recursive:true });
  await writeFile(`data/runs/${runId}.json`, JSON.stringify(out,null,2));

  console.log(`\n--- ${runId} ---`);
  console.log(`Accounts monitored : ${res.monitored.length}`);
  console.log(`Dated changes      : ${res.changes.length}`);
  console.log(`Skipped            : ${res.skipped.length}`);
  console.log(`Errors             : ${res.errors.length}`);
  const t = ledger.totals;
  console.log(`Cost               : ${t.calls} calls, ${t.priced ? '$'+t.usd.toFixed(4) : t.inTok+'+'+t.outTok+' tokens'}`);
  if (res.changes.length) {
    console.log(`\nCHANGES:`);
    for (const c of res.changes)
      console.log(`  ${c.change_date}  ${c.account.padEnd(16)} ${c.signal_type.padEnd(27)} ${c.quote.slice(0,62)}`);
  }
  console.log(`\nRESEARCH-BLOCKED (${blocked.length}) - human tasks:`);
  for (const b of blocked) console.log(`  ${b.account.padEnd(16)} ${String(b.reason).padEnd(22)} ${b.humanTask || ''}`);
  console.log();
} catch (e) { console.error(`\nAborted: ${e.message}\n`); process.exit(1); }
