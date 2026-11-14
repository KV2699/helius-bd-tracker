#!/usr/bin/env node
// node judge.js — every offline check, one summary, one exit code.
// No key, no network, no install. This is the command to run first.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

const CHECKS = [
  { name: 'Unit assertions',      cmd: ['pipeline/selftest.js'],        want: /(\d+) passed, 0 failed/ },
  { name: 'Settlement policy',    cmd: ['pipeline/selftest-market.js'], want: /(\d+) passed, 0 failed/ },
  { name: 'Adversarial attacks',  cmd: ['attack.js'],                   want: /(\d+) attacks · (\d+) blocked · 0 got in/ },
  { name: 'Admissibility audit',  cmd: ['audit.js'],                    want: /All criteria met/ },
  { name: 'Bounty round',         cmd: ['market-round.js'],             want: /(\d+) paid · (\d+) refunded/ },
  { name: 'Verdict replay',       cmd: ['verify-verdict.js'],           want: /0 differ/ }
];

console.log('\nVERBATIM — offline verification\n');
const t0 = Date.now();
let failed = 0;
for (const c of CHECKS) {
  process.stdout.write(`  ${c.name.padEnd(22)}`);
  try {
    const { stdout } = await run('node', c.cmd, { timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
    const m = c.want.exec(stdout);
    if (!m) { failed++; console.log('FAIL  (expected output not found)'); continue; }
    console.log(`ok    ${m[0].trim()}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${String(e.message).split('\n')[0].slice(0, 80)}`);
  }
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n  ${CHECKS.length - failed}/${CHECKS.length} passed in ${secs}s`);
console.log(failed
  ? '\n  Something is wrong. The output above says what.\n'
  : '\n  Everything verifiable without a key is verified.\n' +
    '  What this does NOT prove: that a grounded quote means a company needs anything.\n' +
    '  See README "Honest limits", and docs/TESTNET_RUN.md for the on-chain run.\n');
process.exit(failed ? 1 : 0);
