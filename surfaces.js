#!/usr/bin/env node
// Surface discovery: find the pages an account links to but we were not reading.
//   node surfaces.js
import { discoverSurfaces } from './pipeline/surfaces.js';
import { writeFile, mkdir } from 'node:fs/promises';

console.log(`\nSurface discovery - links read off pages the accounts already own\n`);
const res = await discoverSurfaces({ onEvent: e => console.log(`  [${e.stage}] ${e.msg}`) });
await mkdir('data/runs', { recursive: true });
await writeFile(`data/runs/${res.runId}.json`, JSON.stringify(res, null, 2));

console.log(`\n--- ${res.runId} ---`);
console.log(`Accounts read      : ${res.scanned.length}`);
console.log(`Readable surfaces  : ${res.found.length}`);
console.log(`Carrying dates     : ${res.dated.length}`);
console.log(`Rejected           : ${res.rejected.length}`);
if (res.dated.length) {
  console.log(`\nWORTH ADDING - readable, dated, first-party:`);
  for (const f of res.dated)
    console.log(`  ${f.account.padEnd(20)} ${f.kind.padEnd(10)} ${String(f.chars).padStart(6)}ch  ${f.dateMentions} dates  ${f.url}`);
}
console.log(`\nSaved: data/runs/${res.runId}.json\n`);
