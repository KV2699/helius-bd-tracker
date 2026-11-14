#!/usr/bin/env node
// Score every verified account across the whole Helius product surface.
//   node products.js            all verified accounts
//   node products.js Kraken     one account
import { productFit, productFitAll, PRODUCTS } from './pipeline/products.js';
import { writeFile, mkdir } from 'node:fs/promises';

const names = process.argv.slice(2).filter(a => !a.startsWith('--'));
const keys = Object.keys(PRODUCTS);

console.log(`\nHelius product fit - every verified account, every motion\n`);
const log = e => process.stdout.write(`  [${e.stage}] ${e.msg}\n`);
const res = names.length
  ? { runId: 'products-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19),
      accounts: await Promise.all(names.map(n => productFit(n, { onEvent: log }))) }
  : await productFitAll({ onEvent: log });

const ok = res.accounts.filter(a => !a.error);
ok.sort((a, b) => b.product_fit_score - a.product_fit_score);

console.log(`\n${'ACCOUNT'.padEnd(20)}${keys.map(k => k.slice(0, 5).padStart(6)).join('')}  ${'PRIMARY'.padEnd(13)}${'SCORE'.padStart(6)}  VERDICT`);
console.log('-'.repeat(20 + keys.length * 6 + 36));
for (const a of ok)
  console.log(a.account.slice(0, 19).padEnd(20) +
    keys.map(k => String(a.vector[k]).padStart(6)).join('') +
    '  ' + String(a.primary_product).padEnd(13) + String(a.product_fit_score).padStart(6) + '  ' + a.verdict);

const tally = {};
for (const a of ok) { if (a.primary_product !== 'none') tally[a.primary_product] = (tally[a.primary_product] || 0) + 1; }
console.log(`\nPRODUCT OPPORTUNITIES`);
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1]))
  console.log(`  ${PRODUCTS[k].name.padEnd(22)} ${v}`);
const byVerdict = {};
for (const a of ok) byVerdict[a.verdict] = (byVerdict[a.verdict] || 0) + 1;
console.log(`\nVERDICTS  ${Object.entries(byVerdict).map(([k, v]) => `${k} ${v}`).join(' · ')}`);

const ready = ok.filter(a => a.verdict === 'OUTREACH_READY');
const qual  = ok.filter(a => a.verdict === 'QUALIFY');
if (qual.length) {
  console.log(`\nQUALIFY - assign research:`);
  for (const a of qual) console.log(`  ${a.account.padEnd(20)} ${PRODUCTS[a.primary_product]?.name || '-'} - ${a.next_action}`);
}
console.log(`\nOutreach-ready: ${ready.length}${ready.length ? ' (' + ready.map(r => r.account).join(', ') + ')' : ' - none has both a named owner and a dated trigger'}`);

const errs = res.accounts.filter(a => a.error);
if (errs.length) console.log(`\nNot assessed: ${errs.map(e => e.account + ' (' + e.error + ')').join(', ')}`);

await mkdir('data/runs', { recursive: true });
await writeFile(`data/runs/${res.runId}.json`, JSON.stringify(res, null, 2));
console.log(`\nSaved: data/runs/${res.runId}.json\n`);
