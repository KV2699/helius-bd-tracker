#!/usr/bin/env node
// node market-round.js            two workers, one bounty, offline
// node market-round.js --testnet  the same round, settled on NEAR testnet
//
// A buyer posts a research question. Two workers answer it. The arbiter fetches
// each cited page itself, runs the grounding check, and settles on the result.
// The honest worker is paid. The one who reworded instead of quoting is not.
import { adjudicate, replay } from './pipeline/arbiter.js';
import { SETTLEMENT_POLICY } from './pipeline/market.js';
import { writeFile, mkdir } from 'node:fs/promises';

const testnet = process.argv.includes('--testnet');

// The bounty is a real question from the scanner's own Missing view: we do not
// know how Velocity's keeper bots are paid, and the answer is on their page.
const BOUNTY = {
  id: 'b1',
  question: 'How are Velocity Protocol\'s keeper bots compensated?',
  source_url: 'https://docs.velocity.exchange/developers/trading-automation',
  reward: '3 NEAR'
};

// Two workers. Neither is told what the arbiter will do.
const WORKERS = [
  { id: 'honest',
    account: 'helius-worker-81631.testnet',
    behaviour: 'quotes the page verbatim',
    quote: 'They are paid a per-action reward by the protocol' },
  { id: 'paraphraser',
    account: 'helius-worker-81631.testnet',
    behaviour: 'rewords it — the failure the audit found',
    quote: 'They remain paid a per-action reward by the protocol, and most need no capital beyond transfers fees' }
];

console.log(`\nVERIFIED RESEARCH BOUNTY — ${testnet ? 'TESTNET' : 'OFFLINE'}`);
console.log(`\nBounty  ${BOUNTY.question}`);
console.log(`Source  ${BOUNTY.source_url}`);
console.log(`Reward  ${BOUNTY.reward}\n`);
console.log('The arbiter fetches that page itself. It never sees a worker\'s copy of it.\n');

const results = [];
for (const w of WORKERS) {
  const v = await adjudicate({ bountyId: `${BOUNTY.id}-${w.id}`, url: BOUNTY.source_url, quote: w.quote });
  const r = await replay(v);
  results.push({ worker: w, verdict: v, replay: r });

  console.log(`WORKER "${w.id}" — ${w.behaviour}`);
  console.log(`  delivered   "${w.quote.slice(0, 78)}${w.quote.length > 78 ? '…' : ''}"`);
  console.log(`  arbiter     fetched the page, ran quoteIsGrounded, no model involved`);
  console.log(`  verdict     ${v.reason}  ->  ${v.outcome}`);
  console.log(`  evidence    page ${v.pageHash.slice(0, 12)}…  hash ${v.evidenceHash.slice(0, 16)}…`);
  console.log(`  replayable  ${r.reasonMatches && r.evidenceHashMatches ? 'yes — recomputed from the archived page' : 'NO'}`);
  console.log(`  paid        ${v.outcome === 'RELEASE' ? w.account : v.outcome === 'REFUND' ? 'nobody — buyer refunded' : 'nobody — held for a human'}\n`);
}

const released = results.filter(r => r.verdict.outcome === 'RELEASE').length;
const refunded = results.filter(r => r.verdict.outcome === 'REFUND').length;
console.log(`${results.length} deliveries · ${released} paid · ${refunded} refunded`);
console.log(`The difference is in the page, not in who asked.\n`);

await mkdir('data/market', { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const out = {
  roundId: `round-${stamp}`, generatedAt: new Date().toISOString(),
  mode: testnet ? 'testnet' : 'offline',
  bounty: BOUNTY, policy: SETTLEMENT_POLICY,
  results: results.map(r => ({ worker: r.worker.id, behaviour: r.worker.behaviour,
    quote: r.worker.quote, ...r.verdict, replay: r.replay })),
  note: 'The arbiter fetched each source URL itself through the whitelist fetcher and ran ' +
        'quoteIsGrounded against the page it fetched. No reason code was supplied by hand. ' +
        'Every verdict is replayable from the archived page with node verify-verdict.js.'
};
const file = `data/market/${out.roundId}.json`;
await writeFile(file, JSON.stringify(out, null, 2));
console.log(`Saved ${file}`);

if (testnet) {
  console.log('\nTestnet settlement is driven by scripts/settle-on-chain.sh, which signs as the');
  console.log('arbiter account. It is a separate step because signing needs a human.\n');
}
