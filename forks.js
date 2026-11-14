#!/usr/bin/env node
// HX-GA2 v2: operator discovery through the fork graph.
//   node forks.js            (optionally GITHUB_TOKEN=... for 5,000 req/hr)
import { discoverViaForks, classifyRun } from './pipeline/forks.js';
import { writeFile, mkdir, readFile } from 'node:fs/promises';

// --from <saved run> re-classifies without re-spending the GitHub budget.
const argOf = (n) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : null; };
const from = argOf('from');

console.log(`\nHX-GA2 v2 - Operator discovery via the GitHub fork graph`);
console.log(`Facts come from the GitHub API. No model is involved in discovery.\n`);
try {
  const log = e => console.log(`  [${e.stage}] ${e.msg}`);
  const res = from
    ? await classifyRun(JSON.parse(await readFile(from, 'utf8')), { onEvent: log })
    : await discoverViaForks({ onEvent: log });
  await mkdir('data/runs', { recursive: true });
  await writeFile(`data/runs/${res.runId}.json`, JSON.stringify(res, null, 2));

  console.log(`\n--- ${res.runId} ---`);
  console.log(`Protocols scanned   : ${res.scanned.join(', ') || 'none'}`);
  console.log(`Identifiable owners : ${res.operators.length}`);
  console.log(`New to the registry : ${res.fresh.length}`);
  console.log(`Unreachable         : ${res.skipped.length}`);
  console.log(`Competitors found   : ${(res.competitors || []).length}`);
  console.log(`GitHub calls left   : ${res.rateRemaining ?? 'unknown'}`);
  if (res.incomplete) console.log(`\n!! INCOMPLETE - GitHub rate limit was hit. This is not an empty result.`);
  if ((res.competitors || []).length) {
    console.log(`\nCOMPETITORS - surfaced by the crawler, correctly NOT leads:`);
    for (const c of res.competitors) console.log(`  ${c.org || c.handle} - ${c.why}`);
  }
  if (res.fresh.length) {
    console.log(`\nSTREAM B CANDIDATES - named, reachable, running the code:`);
    for (const o of res.fresh) {
      console.log(`\n  ${(o.org || o.person || o.handle)}`);
      console.log(`    fork      : ${o.fork}  (from ${o.forked_from}, pushed ${o.last_push})`);
      if (o.fork_description) console.log(`    they say  : "${o.fork_description}"`);
      if (o.bio)  console.log(`    bio       : ${o.bio.slice(0, 100)}`);
      console.log(`    reach     : ${[o.site, o.x && '@' + o.x, o.profile_url].filter(Boolean).join('  ')}`);
      if (o.authors.length) console.log(`    commits   : ${o.authors.map(a => `${a.name} (${a.commits})`).join(', ')}`);
    }
  } else {
    console.log(`\nNo identifiable third-party operator. That is a valid result.`);
  }
  console.log(`\nSaved: data/runs/${res.runId}.json\n`);
} catch (e) {
  console.error(`\nAborted: ${e.message}\n`); process.exit(1);
}
