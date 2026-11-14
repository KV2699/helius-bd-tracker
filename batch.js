#!/usr/bin/env node
// Take a seeds run and carry it the whole way: surfaces -> status -> product fit.
// Nothing enters the registry here; this reports what WOULD enter and why.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { discoverSurfaces } from './pipeline/surfaces.js';
import { readStatus } from './pipeline/status.js';
import { fetchSource } from './pipeline/fetch.js';
import { nameVariants } from './pipeline/seeds.js';

const dir = 'data/runs';
const f = (await readdir(dir)).filter(x => x.startsWith('seeds-')).sort().pop();
const seeds = JSON.parse(await readFile(`${dir}/${f}`, 'utf8'));
console.log(`\nBatch from ${f} - ${seeds.admitted.length} seeded account(s)\n`);

const byName = new Map();
for (const a of seeds.admitted) if (!byName.has(a.name)) byName.set(a.name, a);
const accounts = [...byName.values()].map(a => ({
  name: a.name, category: a.category, tvl: a.tvl,
  surfaces: [{ kind: 'site', url: a.url, status: 'verified' }]
}));

// 1. Surfaces the account links to itself.
const sd = await discoverSurfaces({ accounts, perAccount: 4, onEvent: () => {} });
const extra = new Map();
for (const d of sd.dated) {
  if (!extra.has(d.account)) extra.set(d.account, []);
  extra.get(d.account).push({ kind: d.kind, url: d.url, status: 'verified' });
}
console.log(`Surface discovery: ${sd.found.length} readable, ${sd.dated.length} worth adding\n`);

// 2. Status, then 3. a product read - on the whole surface set.
const rows = [];
for (const acct of accounts) {
  const all = [...acct.surfaces, ...(extra.get(acct.name) || [])];
  let text = '', chars = 0, read = 0;
  for (const s of all.slice(0, 5)) {
    const src = await fetchSource(s.url, { skipWhitelist: true });
    if (!src.ok) continue;
    text += '\n' + src.pageText; chars += src.pageText.length; read++;
  }
  const st = readStatus(text, nameVariants(acct.name).concat(acct.name));
  // "jito" alone matches a token pair ("JTO-paired Orca pools") and ecosystem
  // name-lists ("Sanctum, Jupiter, Phantom, Jito, and Marinade"). It only means
  // the block engine alongside what you use it for.
  const sender = /\b(keeper bot|liquidation bot|liquidator|jit maker|crank|priority fee|jito (bundle|tip)|block engine|transaction landing|sendTransaction)\b/i.test(text);
  const solana = /\bsolana\b|mainnet-?beta|\bSPL\b/i.test(text);
  rows.push({ account: acct.name, category: acct.category, tvl: acct.tvl,
              surfaces: all.length, read, chars, status: st.status,
              statusQuote: st.quote || null, solana, senderEvidence: sender });
}

rows.sort((a, b) => b.chars - a.chars);
console.log(`${'ACCOUNT'.padEnd(24)}${'SURF'.padStart(5)}${'CHARS'.padStart(9)}  ${'STATUS'.padEnd(9)}${'SOLANA'.padEnd(8)}SENDER EVIDENCE`);
console.log('-'.repeat(78));
for (const r of rows)
  console.log(r.account.slice(0, 23).padEnd(24) + String(r.surfaces).padStart(5) +
    String(r.chars).padStart(9) + '  ' + r.status.padEnd(9) +
    (r.solana ? 'yes' : 'NO').padEnd(8) + (r.senderEvidence ? 'YES' : '-'));

const dead = rows.filter(r => r.status !== 'active');
const notSol = rows.filter(r => !r.solana);
const sender = rows.filter(r => r.senderEvidence && r.solana && r.status === 'active');
console.log(`\n${rows.length} assessed · ${dead.length} not operating · ${notSol.length} no Solana mention · ${sender.length} with Sender evidence`);
if (dead.length) for (const d of dead) console.log(`  CEASED  ${d.account}: "${(d.statusQuote || '').slice(0, 120)}"`);
if (sender.length) console.log(`\nWORTH REGISTERING: ${sender.map(s => s.account).join(', ')}`);

const runId = 'batch-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
await mkdir(dir, { recursive: true });
await writeFile(`${dir}/${runId}.json`, JSON.stringify({ runId, rows, surfaces: sd.dated }, null, 2));
console.log(`\nSaved: ${dir}/${runId}.json\n`);
