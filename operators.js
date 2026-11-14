#!/usr/bin/env node
// HX-GA2: operator discovery. The protocol is rarely the buyer - the keeper-bot
// operator or the maker quoting on the venue is, and they have no Helius
// relationship. This finds them, from pages we fetch ourselves.
//   NEAR_AI_API_KEY=... node operators.js
import { NearAI, Ledger, loadPrices } from './pipeline/near.js';
import { discoverOperators } from './pipeline/operators.js';
import { writeFile, mkdir } from 'node:fs/promises';

const runId = `operators-${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}`;
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };

console.log(`\nHX-GA2 Operator Discovery | Inference: NEAR AI Cloud\n`);
const ledger = new Ledger(runId, Number(arg('budget', 1)));
try {
  const ai = new NearAI(ledger);
  await loadPrices();
  const res = await discoverOperators({ ai, onEvent: e => console.log(`  [${e.stage}] ${e.msg}`) });

  const out = { ...res, runId, cost: ledger.totals, costLines: ledger.lines };
  await mkdir('data/runs', { recursive: true });
  await writeFile(`data/runs/${runId}.json`, JSON.stringify(out, null, 2));

  console.log(`\n--- ${runId} ---`);
  console.log(`Protocols scanned  : ${res.scanned.length}`);
  console.log(`Operators grounded : ${res.operators.length}`);
  console.log(`New to the registry: ${res.fresh.length}`);
  console.log(`Rejected           : ${res.skipped.length}`);
  const t = ledger.totals;
  console.log(`Cost               : ${t.calls} calls, ${t.priced ? '$'+t.usd.toFixed(4) : t.inTok+'+'+t.outTok+' tokens'}`);
  if (res.fresh.length) {
    console.log(`\nSTREAM B CANDIDATES - cold, no Helius relationship:`);
    for (const o of res.fresh)
      console.log(`  ${o.operator.padEnd(28)} ${o.kind.padEnd(14)} via ${o.protocol}\n      "${o.quote.slice(0,90)}"`);
  } else {
    console.log(`\nNo third-party operator was named in any page we can read. That is a valid result.`);
    console.log(`The next step is a human one: the operators exist, but these surfaces do not name them.`);
  }
  console.log(`\nSaved: data/runs/${runId}.json\n`);
} catch (e) {
  console.error(`\nAborted: ${e.message}\n`);
  process.exit(1);
}
