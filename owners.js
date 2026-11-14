#!/usr/bin/env node
// Find the named infrastructure owner for an account. The missing field that
// blocks every row from ever being Actionable.
//   node owners.js "Zeta Markets"
import { findOwners } from './pipeline/forks.js';
import { ICP, lookupICP } from './pipeline/icp.js';
import { writeFile, mkdir } from 'node:fs/promises';

const name = process.argv.slice(2).filter(a => !a.startsWith('--')).join(' ');
if (!name) { console.error('Usage: node owners.js "<Account>"'); process.exit(1); }
const acct = lookupICP(name) || ICP.find(a => a.name.toLowerCase() === name.toLowerCase());
if (!acct) { console.error(`${name} is not in the registry.`); process.exit(1); }
if (!acct.github) { console.error(`${acct.name} has no GitHub org recorded. Find one declared on a page they own - do not guess.`); process.exit(1); }

console.log(`\nOwner search - ${acct.name} (github.com/${acct.github}, declared in their own docs)\n`);
const res = await findOwners(acct.github, { account: acct.name, onEvent: e => console.log(`  [${e.stage}] ${e.msg}`) });
await mkdir('data/runs', { recursive: true });
await writeFile(`data/runs/${res.runId}.json`, JSON.stringify(res, null, 2));

console.log(`\n--- ${res.runId} ---`);
if (res.error) console.log(`  ERROR ${res.error}: ${res.detail}`);
console.log(`Contributors considered : ${res.considered.length}`);
console.log(`Infrastructure owners   : ${res.owners.length}`);
if (res.incomplete) console.log(`\n!! INCOMPLETE - GitHub rate limit. Not an empty result.`);

if (res.owners.length) {
  console.log(`\nNAMED INFRASTRUCTURE OWNERS:`);
  for (const o of res.owners) {
    console.log(`\n  ${o.person || o.handle}`);
    console.log(`    role     : ${o.role_text}`);
    console.log(`    evidence : ${o.repo} (${o.contributions} commits) - ${o.profile_url}`);
    console.log(`    reach    : ${[o.blog, o.x && '@' + o.x].filter(Boolean).join('  ') || 'GitHub profile only'}`);
  }
} else {
  console.log(`\nNo contributor profile names an infrastructure role.`);
  console.log(`${acct.name} stays at RESEARCH. A GitHub handle is not a buying contact.`);
  if (res.considered.length) {
    console.log(`\nConsidered and rejected (no infrastructure role on the profile):`);
    for (const c of res.considered.slice(0, 10))
      console.log(`  ${(c.person || c.handle).padEnd(26)} ${(c.role_text || '(no bio, name or company)').slice(0, 76)}`);
  }
}
console.log(`\nSaved: data/runs/${res.runId}.json\n`);
