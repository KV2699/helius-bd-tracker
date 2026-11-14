#!/usr/bin/env node
// Re-apply the CURRENT scoring to a saved run. Pure code, no model, no cost.
//
// Scoring lives in pipeline/score.js and the verdict is stored on each row at
// run time, so the page and the workbook read one number rather than three
// implementations guessing at it. The consequence is that changing a cap leaves
// saved runs stale - and re-running a scan to pick up a scoring change costs
// $0.12 and makes the evidence move underneath you, which is the wrong trade.
// This re-scores the rows exactly as they were collected.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { assess } from './pipeline/score.js';

const arg = n => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : null; };
const dir = 'data/runs';
let file = arg('file');
if (!file) {
  const runs = (await readdir(dir)).filter(f => f.startsWith('run-') && f.endsWith('.json')).sort();
  if (!runs.length) { console.error('No run to re-score.'); process.exit(1); }
  file = `${dir}/${runs[runs.length - 1]}`;
}

const run = JSON.parse(await readFile(file, 'utf8'));
const before = {}, after = {};
let moved = 0;

for (const row of (run.rows || [])) {
  const old = row.assessment?.verdict ?? 'UNSCORED';
  before[old] = (before[old] || 0) + 1;
  const a = assess(row, 'trading');
  row.assessment = a;
  if (a.routedTo) row.routedTo = a.routedTo;
  after[a.verdict] = (after[a.verdict] || 0) + 1;
  if (a.verdict !== old) {
    moved++;
    console.log(`  ${old} -> ${a.verdict}  ${row.entity} (${row.event_date})`);
    if (a.verdict === 'NO_ACTION' && old === 'ROUTED')
      console.log(`      ${(row.quote || '').slice(0, 100)}`);
  }
}

run.rescoredAt = new Date().toISOString();
await writeFile(file, JSON.stringify(run, null, 2));

console.log(`\n--- re-scored ${file} ---`);
console.log(`before : ${JSON.stringify(before)}`);
console.log(`after  : ${JSON.stringify(after)}`);
console.log(`${moved} row(s) changed verdict. No model was called; this cost nothing.\n`);
