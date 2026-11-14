#!/usr/bin/env node
// THE DISCOVERY-TO-REGISTRY BRIDGE.
//
// Turns discovery candidates into registry accounts. Promotion runs on
// IDENTITY, not on whether we have found the company's docs page yet:
//   identity_confirmed  system-set, with evidence
//   surface_verified    a confidence flag that sets the next action
// See pipeline/bridge.js for why those are two flags and not one gate.
//
//   node bridge.js                      the newest discovery pass, top 40
//   node bridge.js --tier trading       only the highest-value buyers
//   node bridge.js --limit 10
import { runBridge, saveBridge } from './pipeline/bridge.js';
import { readdir, readFile, writeFile } from 'node:fs/promises';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const limit = Number(arg('limit', 40));
const tier  = arg('tier', null);

const files = (await readdir('data/discovered')).filter(f => f.endsWith('.json')).sort();
if (!files.length) { console.error('No discovery pass on disk. Run: node discover.js'); process.exit(1); }
const disc = JSON.parse(await readFile(`data/discovered/${files[files.length - 1]}`, 'utf8'));

let candidates = (disc.candidates || []).filter(c => !c.in_registry);
if (tier) candidates = candidates.filter(c => c.tier === tier);

console.log(`\nDISCOVERY -> REGISTRY BRIDGE`);
console.log(`Source: ${disc.discoveryId}  (${candidates.length} candidate(s)${tier ? `, tier ${tier}` : ''}, reading ${Math.min(limit, candidates.length)})`);
console.log(`Promotion runs on identity. Surface verification is a confidence flag, not a gate.\n`);

const result = await runBridge({ candidates, limit, onEvent: e => process.stdout.write(`  [${e.stage}] ${e.msg}\n`) });
result.source = disc.discoveryId;
const file = await saveBridge(result);

const c = result.counts;
console.log(`\n--- ${result.bridgeId} ---`);
console.log(`Considered            : ${c.considered}`);
console.log(`Promoted              : ${c.promoted}`);
console.log(`  surface verified    : ${c.surface_verified}`);
console.log(`  surface not yet     : ${c.surface_not_yet_verified}`);
console.log(`Held                  : ${c.held}  (${c.held_disqualified} disqualified, ${c.held_duplicate} already in the registry,`);
console.log(`                         ${c.held_ceased} ceased on their own page, ${c.held_ceased_unconfirmed} reported ceased by a third party)`);
console.log(`Surfaces verified     : ${c.surfaces}`);
console.log(`Saved                 : ${file}`);

/* ---- WRITE THE REGISTRY ADDITIONS -------------------------------------
   icp.js is hand-curated and the bridge must not rewrite source, so promoted
   accounts are appended to data/registry-additions.json, which icp.js merges
   at load. Append-only and keyed on the name, so re-running the bridge updates
   an account rather than duplicating it. */
const ADD = 'data/registry-additions.json';
let store = { accounts: [] };
try { store = JSON.parse(await readFile(ADD, 'utf8')); } catch {}
const byName = new Map((store.accounts || []).map(a => [a.name.toLowerCase(), a]));
let fresh = 0, updated = 0;
for (const e of result.registryEntries) {
  const key = e.name.toLowerCase();
  if (byName.has(key)) { Object.assign(byName.get(key), e, { updated_on: new Date().toISOString().slice(0, 10) }); updated++; }
  else { byName.set(key, { ...e, roster_tier: e.note, added_on: new Date().toISOString().slice(0, 10), added_by: result.bridgeId }); fresh++; }
}
store.accounts = [...byName.values()];
store.note = 'Written by bridge.js. Merged into ICP at load by pipeline/icp.js. ' +
             'Every account here has a confirmed identity; surface_verified says ' +
             'whether a page it publishes has been read yet.';
await writeFile(ADD, JSON.stringify(store, null, 2));
console.log(`Registry additions   : ${fresh} new, ${updated} updated -> ${ADD} (${store.accounts.length} total)`);

const verified = result.results.filter(r => r.promoted && r.surface_verified);
const unverified = result.results.filter(r => r.promoted && !r.surface_verified);

if (verified.length) {
  console.log(`\nPROMOTED - SURFACE VERIFIED (${verified.length})\n`);
  for (const r of verified) {
    console.log(`  ${r.name}  [${r.tier}]  ${r.domain}`);
    for (const s of r.surfaces) console.log(`      ${s.kind.padEnd(10)} ${String(s.chars).padStart(6)}ch  ${s.url}`);
    console.log(`      basis: ${r.domain_basis?.how}`);
  }
}
if (unverified.length) {
  console.log(`\nPROMOTED - SURFACE NOT YET VERIFIED (${unverified.length})`);
  console.log(`These are real companies. Next action is to find and verify their own surface.\n`);
  for (const r of unverified) console.log(`  ${r.name.padEnd(24)} [${r.tier}]  ${r.reason}`);
}

const held = result.results.filter(r => !r.promoted);
if (held.length) {
  console.log(`\nHELD (${held.length})\n`);
  for (const r of held) console.log(`  ${r.name.padEnd(24)} ${r.reason}`);
}
console.log(`\n${result.disclaimer}\n`);
