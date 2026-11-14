#!/usr/bin/env node
// Is this company still trading? Checked before anything else is believed.
//   node status.js            every verified account
//   node status.js "Zeta Markets"
import { checkStatus } from './pipeline/status.js';
import { ICP } from './pipeline/icp.js';
import { writeFile, mkdir } from 'node:fs/promises';

const names = process.argv.slice(2).filter(a => !a.startsWith('--'));
const targets = names.length ? names
  : ICP.filter(a => (a.surfaces || []).some(s => s.status === 'verified')).map(a => a.name);

console.log(`\nCompany status - a dead company can have perfect evidence\n`);
const results = [];
for (const n of targets) {
  const r = await checkStatus(n, { onEvent: () => {} });
  results.push(r);
  const flag = r.status === 'active' ? '  ' : '!!';
  console.log(`${flag} ${String(r.status).toUpperCase().padEnd(10)} ${String(r.confidence || '').padEnd(9)} ${String(r.account || n).padEnd(22)}${r.successor ? 'successor: ' + r.successor : ''}`);
  if (r.quote) console.log(`      "${r.quote.slice(0, 160)}"`);
}
const dead = results.filter(r => r.status && r.status !== 'active');
console.log(`\n${results.length} checked · ${dead.length} not operating`);
if (dead.length) console.log(`Excluded from outreach: ${dead.map(d => d.account).join(', ')}`);
const runId = 'status-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
await mkdir('data/runs', { recursive: true });
await writeFile(`data/runs/${runId}.json`, JSON.stringify({ runId, results }, null, 2));
console.log(`\nSaved: data/runs/${runId}.json\n`);
