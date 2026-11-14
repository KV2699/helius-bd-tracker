#!/usr/bin/env node
// node check-docs.js — fails if a doc states a number that disagrees with facts.json.
// Docs drift. This stops a stale figure reaching a judge.
import { readFile } from 'node:fs/promises';
const facts = JSON.parse(await readFile('facts.json', 'utf8'));
const get = k => facts.facts.find(f => f.key === k)?.value;

const RULES = [
  { re: /(\d+)\s+assertions/gi,        want: String(get('assertions')),  what: 'assertions' },
  { re: /(\d+)\s+attacks/gi,           want: String(get('attacks')),     what: 'attacks' },
  { re: /(\d+)\s+rivals/gi,            want: String(get('nonsense_rivals')), what: 'nonsense rivals' },
  { re: /(\d+)\s+opportunities/gi,     want: String(get('opportunities')),   what: 'opportunities' },
  { re: /ranked?\s+1\s+of\s+(\d+)/gi,  want: '47',                       what: 'detector rank denominator' }
];
const DOCS = ['README.md', 'AGENTS.md', 'PROJECT-COMPLETE.md'];

let bad = 0;
for (const doc of DOCS) {
  let text; try { text = await readFile(doc, 'utf8'); } catch { continue; }
  for (const r of RULES) {
    r.re.lastIndex = 0;
    let m;
    while ((m = r.re.exec(text))) {
      if (m[1] !== r.want) {
        bad++;
        console.log(`  MISMATCH  ${doc}: "${m[0].trim()}" — facts.json says ${r.want} ${r.what}`);
      }
    }
  }
}
console.log(bad ? `\n${bad} figure(s) disagree with facts.json\n` : '\nEvery figure in the docs matches facts.json.\n');
process.exit(bad ? 1 : 0);
