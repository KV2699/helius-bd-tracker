#!/usr/bin/env node
// Resolve a seed surface for accounts that have none.
//   node seeds.js Zeta Mango Raydium Meteora Phantom Backpack
import { resolveSeeds } from './pipeline/seeds.js';
import { writeFile, mkdir } from 'node:fs/promises';

const names = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!names.length) { console.error('Usage: node seeds.js <Name> [Name ...]'); process.exit(1); }

console.log(`\nSeed resolution - the directory says where to look; the fetch is the evidence\n`);
const res = await resolveSeeds({ names, onEvent: e => console.log(`  [${e.stage}] ${e.msg}`) });
await mkdir('data/runs', { recursive: true });
await writeFile(`data/runs/${res.runId}.json`, JSON.stringify(res, null, 2));

console.log(`\n--- ${res.runId} ---`);
console.log(`Requested : ${res.requested.length}`);
console.log(`Admitted  : ${res.admitted.length}`);
console.log(`Rejected  : ${res.rejected.length}`);
if (res.admitted.length) {
  console.log(`\nSEEDS - fetched, readable, and naming themselves:`);
  for (const a of res.admitted)
    console.log(`  ${a.name.padEnd(22)} ${String(a.category || '').padEnd(18)} ${String(a.chars).padStart(6)}ch  ${a.url}`);
}
if (res.rejected.length) {
  console.log(`\nNOT SEEDED:`);
  for (const r of res.rejected) console.log(`  ${r.name.padEnd(22)} ${r.reason}${r.detail ? ' - ' + r.detail : ''}`);
}
console.log(`\nSaved: data/runs/${res.runId}.json\n`);
