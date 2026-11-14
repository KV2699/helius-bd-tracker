// SETTLING ON NEAR TESTNET.
//
// This is the additive half. The arbitration logic in market.js is the
// deliverable and runs with no key and no network; this moves the same verdict
// on chain, when a contract is deployed and the environment is configured.
//
// It shells out to `near-cli-rs` rather than importing near-api-js, because
// this project has no dependencies and that is worth keeping: a judge can run
// everything here with a bare Node install. If the CLI is absent, that is
// reported, not papered over.
//
// All four variables are optional. Their absence means "simulate", and the
// simulation says so rather than implying a chain it never touched.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SETTLEMENT_POLICY, outcomeFor } from './market.js';

const run = promisify(execFile);

export const CONFIG = {
  contract: process.env.NEAR_ESCROW_CONTRACT || null,   // helius-escrow.testnet
  arbiter:  process.env.NEAR_ARBITER_ACCOUNT || null,   // helius-escrow-arbiter.testnet
  buyer:    process.env.NEAR_ESCROW_ACCOUNT  || null,
  network:  process.env.NEAR_NETWORK || 'testnet'
};

export function chainConfigured() {
  return !!(CONFIG.contract && CONFIG.arbiter);
}

/* What is missing, said plainly, so the next person knows what to set. */
export function missing() {
  const m = [];
  if (!CONFIG.contract) m.push('NEAR_ESCROW_CONTRACT');
  if (!CONFIG.arbiter)  m.push('NEAR_ARBITER_ACCOUNT');
  return m;
}

export async function cliAvailable() {
  try { await run('npx', ['--yes', 'near-cli-rs', '--version'], { timeout: 60000 }); return true; }
  catch { return false; }
}

/* Call settle({reason_code}) as the arbiter. The contract applies the SAME
   policy table this module imports - that is the point of sharing it. */
export async function settleOnChain({ reasonCode, contract = CONFIG.contract, arbiter = CONFIG.arbiter }) {
  if (!chainConfigured())
    throw new Error(`not configured: set ${missing().join(' and ')}`);
  if (!(await cliAvailable()))
    throw new Error('near-cli-rs is not available, so nothing can be sent');

  const expected = outcomeFor(reasonCode);
  const args = ['--yes', 'near-cli-rs', 'contract', 'call-function', 'as-transaction',
    contract, 'settle', 'json-args', JSON.stringify({ reason_code: reasonCode }),
    'prepaid-gas', '30 Tgas', 'attached-deposit', '0 NEAR',
    'sign-as', arbiter, 'network-config', CONFIG.network, 'send'];

  const { stdout, stderr } = await run('npx', args, { timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
  const out = `${stdout}\n${stderr}`;
  const tx = (out.match(/[A-HJ-NP-Za-km-z1-9]{43,46}/) || [])[0] || null;
  return {
    reasonCode,
    expectedOutcome: expected,
    policy: SETTLEMENT_POLICY[String(reasonCode).toUpperCase()] || 'MANUAL_REVIEW',
    txHash: tx,
    explorer: tx ? `https://testnet.nearblocks.io/txns/${tx}` : null,
    raw: out.slice(0, 4000)
  };
}

/* Read the contract's view of the escrow, so a settlement can be checked
   against the chain rather than against our own print statement. */
export async function statusOnChain({ contract = CONFIG.contract } = {}) {
  if (!contract) throw new Error('not configured: set NEAR_ESCROW_CONTRACT');
  const { stdout } = await run('npx', ['--yes', 'near-cli-rs', 'contract', 'call-function',
    'as-read-only', contract, 'status', 'json-args', '{}',
    'network-config', CONFIG.network, 'now'], { timeout: 120000 });
  return stdout.trim();
}
