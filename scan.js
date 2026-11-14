#!/usr/bin/env node
// Run a scan. Inference goes to NEAR AI Cloud; there is no fallback.
//   NEAR_AI_API_KEY=... node scan.js --days 14 --budget 2
//   NEAR_AI_API_KEY=... node scan.js --from 2026-10-29 --to 2026-11-12
//
// Rolling batches beat one long sweep. A 90-day window asks the collector to
// pull a handful of candidates out of years of archive; a 14-day window lets it
// read the slice properly. Each batch is saved as its own run and merged into
// the account history - never overwritten.
import { runScan, saveRun } from './pipeline/run.js';
import { SEED_URLS, sourcePlan } from './pipeline/sources.js';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const days   = Number(arg('days', 90));
const budget = Number(arg('budget', 2));
const urls   = arg('urls') ? arg('urls').split(',') : sourcePlan();
const variant= arg('variant', null);
// --collectors execution,incident   targeted passes
// --collectors all                  every targeted collector
// (omitted)                         the original single prompt, for comparison
const colArg = arg('collectors', null);

// An explicit range wins over --days. Order is normalised, so --from and --to
// can be given either way round.
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const fromArg = arg('from', null), toArg = arg('to', null);
for (const [k, v] of [['from', fromArg], ['to', toArg]])
  if (v && !ISO.test(v)) { console.error(`--${k} must be YYYY-MM-DD, got "${v}"`); process.exit(1); }

let window;
if (fromArg || toArg) {
  const a = fromArg || toArg, b = toArg || fromArg;
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  const span = Math.round((new Date(hi) - new Date(lo)) / 86400000);
  if (span <= 0) { console.error('--from and --to describe a zero-length window'); process.exit(1); }
  window = { from: lo, to: hi, days: span, explicit: true };
} else {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  window = { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), days };
}

console.log(`\nHelius BD scan - ${window.from} to ${window.to} (${window.days} days${window.explicit ? ', explicit range' : ''})`);
console.log(`Inference: NEAR AI Cloud - budget cap $${budget}` + (variant ? ` - VARIANT ${variant}` : ' - baseline prompts') + '\n');

try {
  const { COLLECTOR_KEYS } = await import('./pipeline/collectors.js');
  const collectors = colArg === 'all' ? COLLECTOR_KEYS
                   : colArg ? colArg.split(',').map(x => x.trim()).filter(Boolean)
                   : null;
  if (collectors) console.log(`Collectors: ${collectors.join(', ')}\n`);

  const result = await runScan({
    urls, window, budgetUsd: budget, variant, collectors, deep: process.argv.includes('--deep'),
    onEvent: e => console.log(`  [${e.stage}] ${e.msg}`)
  });
  const file = await saveRun(result);

  const v = result.rows.reduce((a, r) => { a[r.assessment.verdict] = (a[r.assessment.verdict] || 0) + 1; return a; }, {});
  console.log(`\n--- ${result.runId} ---`);
  console.log(`Sources fetched : ${result.sourcesFetched.length}`);
  console.log(`Rows verified   : ${result.rows.length}`);
  console.log(`Rejected        : ${result.rejected.length}`);
  console.log(`Verdicts        : ${Object.entries(v).map(([k, n]) => `${k} ${n}`).join(' · ') || 'none'}`);
  const c = result.cost;
  console.log(`Cost            : ${c.calls} calls · ${c.promptTokens}+${c.completionTokens} tokens · ` +
              (c.priced ? `$${c.usd.toFixed(4)}` : 'tokens only (set NEAR_AI_PRICE_IN_PER_M / _OUT_PER_M to price it)'));
  console.log(`Saved           : ${file}\n`);
  if (!result.rows.length) console.log('An empty run is a valid result. Nothing was invented to fill it.\n');
} catch (e) {
  console.error(`\nRun aborted: ${e.message}\n`);
  process.exit(1);
}
