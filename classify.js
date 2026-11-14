#!/usr/bin/env node
// Settle an account's product motion from evidence already on its own pages.
//   node classify.js Backpack "Zeta Markets"
import { NearAI, Ledger, loadPrices } from './pipeline/near.js';
import { classifyAccount } from './pipeline/classify.js';
import { writeFile, mkdir } from 'node:fs/promises';

const names = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!names.length) { console.error('Usage: node classify.js <Account> [Account ...]'); process.exit(1); }

const runId = `classify-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
const ledger = new Ledger(runId, 1);
let ai = null;
try { ai = new NearAI(ledger); await loadPrices(); }
catch { console.log('  (no NEAR key - running the code-side classification only)\n'); }

console.log(`\nMotion classification - code finds the evidence, the model only reads excerpts\n`);
const results = [];
for (const name of names) {
  const r = await classifyAccount(name, { ai, onEvent: e => console.log(`  [${e.stage}] ${e.msg}`) });
  results.push(r);

  console.log(`\n=== ${r.name || name} ===`);
  if (r.error) { console.log(`  ${r.error}`); continue; }
  console.log(`  currently   : ${r.currentRelationship}, tier ${r.currentTier}`);
  console.log(`  read        : ${r.sources.map(s => `${s.url} (${s.chars}ch)`).join('\n                ')}`);
  console.log(`  distinct terms: SENDER ${r.distinctTerms.SENDER} | RPC ${r.distinctTerms.RPC_ENTERPRISE} | DATA ${r.distinctTerms.DATA} | CONSUMER ${r.distinctTerms.CONSUMER}`);
  console.log(`  VERDICT     : ${r.verdict.motion} (${r.verdict.confidence} confidence)`);
  r.verdict.reasons.forEach(x => console.log(`                ${x}`));
  if (r.interpretation) {
    console.log(`  relation    : ${r.interpretation.relation} - ${r.interpretation.what}`);
    console.log(`  owner named : ${r.interpretation.owner_named}${r.interpretation.owner_evidence ? ' - "' + r.interpretation.owner_evidence + '"' : ''}`);
    if (r.interpretation.strongest_excerpt)
      console.log(`  strongest   : "${String(r.interpretation.strongest_excerpt).slice(0, 220)}"`);
  }
  if (r.evidence.SENDER.length) {
    console.log(`  Sender evidence (top ${Math.min(4, r.evidence.SENDER.length)}):`);
    r.evidence.SENDER.slice(0, 4).forEach(h => console.log(`    [${h.term}] ${h.excerpt.slice(0, 150)}`));
  }
}

await mkdir('data/runs', { recursive: true });
await writeFile(`data/runs/${runId}.json`, JSON.stringify({ runId, results, cost: ledger.totals }, null, 2));
const t = ledger.totals;
console.log(`\nCost: ${t.calls} call(s), ${t.priced ? '$' + t.usd.toFixed(4) : t.inTok + '+' + t.outTok + ' tokens'}`);
console.log(`Saved: data/runs/${runId}.json\n`);
