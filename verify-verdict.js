#!/usr/bin/env node
// node verify-verdict.js — recompute every verdict in the latest round from the
// archived page, offline, and compare with what the arbiter recorded.
//
// This is the claim that matters: you do not have to trust the arbiter. The
// page it fetched is archived, the check is a string search, and anyone can
// run it again.
import { replay } from './pipeline/arbiter.js';
import { readdir, readFile } from 'node:fs/promises';

const dir = 'data/market';
const files = (await readdir(dir)).filter(f => f.startsWith('round-') && f.endsWith('.json')).sort();
if (!files.length) { console.error('No round on disk. Run: node market-round.js'); process.exit(1); }
const round = JSON.parse(await readFile(`${dir}/${files[files.length - 1]}`, 'utf8'));

console.log(`\nREPLAYING ${round.roundId} — offline, no key, no network\n`);
let bad = 0;
for (const r of round.results) {
  const v = await replay(r);
  const ok = v.pageHashMatches && v.reasonMatches && v.evidenceHashMatches;
  if (!ok) bad++;
  console.log(`  ${ok ? 'MATCHES' : 'DIFFERS'}  ${r.worker.padEnd(13)} ${r.reason.padEnd(20)} ${r.evidenceHash.slice(0, 16)}…`);
  if (!ok) console.log(`           recomputed: ${JSON.stringify(v.recomputed)}`);
}
console.log(`\n${round.results.length} verdicts replayed · ${bad} differ\n`);
console.log('Each one was recomputed from the archived page with the same check the');
console.log('arbiter ran. The arbiter is not trusted here; it is reproduced.\n');
process.exit(bad ? 1 : 0);
