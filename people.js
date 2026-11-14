#!/usr/bin/env node
// Widened owner discovery: who owns execution, from pages the account declares.
//   node people.js "Flint Labs"
import { findPeople } from './pipeline/people.js';
import { writeFile, mkdir } from 'node:fs/promises';

const names = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!names.length) { console.error('Usage: node people.js "<Account>" [...]'); process.exit(1); }

console.log(`\nOwner discovery - account-declared surfaces and repository READMEs only\n`);
const all = [];
for (const n of names) {
  const r = await findPeople(n, { onEvent: e => console.log(`  [${e.stage}] ${e.msg}`) });
  all.push(r);
  console.log(`\n=== ${r.account || n} ===`);
  if (r.error) { console.log(`  ${r.error}`); continue; }
  console.log(`  surfaces read : ${r.checked.length}`);
  const stances = r.checked.filter(c => c.stance);
  if (stances.length) {
    console.log(`  repo stance   :`);
    stances.forEach(c => console.log(`      ${c.stance}  ${c.url}`));
  }
  if (r.found.length) {
    console.log(`  NAMED INFRASTRUCTURE PEOPLE (${r.found.length}):`);
    r.found.forEach(f => console.log(`      ${f.names[0].padEnd(22)} ${f.role}\n          ${f.source}`));
  } else {
    console.log(`  No person named with an infrastructure role on any surface this account declares.`);
  }
  if (r.hiring.length) {
    console.log(`  HIRING for the function:`);
    r.hiring.forEach(h => console.log(`      "${h.role}"  ${h.source}`));
  }
}
const runId = 'people-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
await mkdir('data/runs', { recursive: true });
await writeFile(`data/runs/${runId}.json`, JSON.stringify({ runId, results: all }, null, 2));
console.log(`\nSaved: data/runs/${runId}.json\n`);
