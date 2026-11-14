#!/usr/bin/env node
// node pipeline/selftest-market.js            offline, no key, no network
// node pipeline/selftest-market.js --live     + fetch a real page and settle twice
// node pipeline/selftest-market.js --on-chain + settle on NEAR testnet, if configured
//
// THE ARBITRATION LAYER FOR A RESEARCH BOUNTY MARKET.
//
// The verifier already decides whether a claim is grounded in a page it fetched
// itself. This asks the next question: what should that verdict do to money?
//
// A buyer funds an escrow and posts a research question. A worker delivers a
// claim with a quote and a URL. The arbiter - which IS the verifier - fetches
// that URL, searches it for the quote, and settles. Payment releases on a
// passing grounding check, not on delivery of a claim.
//
// The settlement policy lives in pipeline/market.js and is imported here, by
// the on-chain client, and by the contract. If they disagree, this test fails.
import { SETTLEMENT_POLICY, OUTCOMES, outcomeFor, Escrow, STATE, arbitrate } from './market.js';
import { quoteIsGrounded } from './verify.js';

const live = process.argv.includes('--live');
const onChain = process.argv.includes('--on-chain');

let pass = 0, fail = 0;
const t = (name, cond) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`);
};


/* The most sentence-like span on a page: long enough to be evidence, mostly
   lowercase (so it is prose rather than a nav label), and with no line breaks. */
function pickSentence(text) {
  const candidates = String(text).replace(/\s+/g, ' ').match(/[A-Z][^.!?]{60,200}[.!?]/g) || [];
  const scored = candidates
    .map(s => s.trim())
    .filter(s => (s.match(/\b[a-z]{3,}\b/g) || []).length >= 8)
    .filter(s => !/copy as markdown|view as markdown|skip to|cookie|sign in/i.test(s))
    .sort((a, b) => (b.match(/\b[a-z]{3,}\b/g) || []).length - (a.match(/\b[a-z]{3,}\b/g) || []).length);
  return scored[0] || String(text).replace(/\s+/g, ' ').slice(0, 140).trim();
}

const BUYER = 'helius-escrow-buyer.testnet';
const WORKER = 'helius-escrow-worker.testnet';
const ARBITER = 'helius-escrow-arbiter.testnet';
const fresh = () => new Escrow({ buyer: BUYER, worker: WORKER, arbiter: ARBITER, amount: 5,
                                 question: 'Does Velocity document a latency dependency in its own docs?' });

console.log('\nTHE SETTLEMENT POLICY — offline, no key, no network\n');

/* ---- the policy itself ------------------------------------------------- */
t('GROUNDED releases to the worker',          SETTLEMENT_POLICY.GROUNDED === 'RELEASE');
t('QUOTE_NOT_IN_SOURCE refunds the buyer',    SETTLEMENT_POLICY.QUOTE_NOT_IN_SOURCE === 'REFUND');
t('CLAIM_NOT_SUPPORTED goes to a human',      SETTLEMENT_POLICY.CLAIM_NOT_SUPPORTED === 'MANUAL_REVIEW');
t('an unreachable source refunds',            SETTLEMENT_POLICY.SOURCE_UNREACHABLE === 'REFUND');
t('a ceased company refunds',                 SETTLEMENT_POLICY.ACCOUNT_CEASED === 'REFUND');
t('a competitor refunds',                     SETTLEMENT_POLICY.ACCOUNT_COMPETITOR === 'REFUND');
t('only RELEASE ever pays the worker',
  Object.entries(SETTLEMENT_POLICY).filter(([, v]) => v === 'RELEASE').map(([k]) => k).join() === 'GROUNDED');
t('every outcome is one of three',            Object.values(SETTLEMENT_POLICY).every(v => OUTCOMES.includes(v)));

/* ---- the default must never be "pay" ----------------------------------- */
t('an unknown reason code never releases',    outcomeFor('SOMETHING_NEW') === 'MANUAL_REVIEW');
t('an empty reason code never releases',      outcomeFor('') === 'MANUAL_REVIEW');
t('a worker cannot invent a paying code',     outcomeFor('DEFINITELY_GROUNDED_TRUST_ME') === 'MANUAL_REVIEW');
t('reason codes are case-insensitive',        outcomeFor('grounded') === 'RELEASE');

/* ---- the state machine -------------------------------------------------- */
{
  const e = fresh();
  t('a funded escrow starts FUNDED',          e.state === STATE.FUNDED);

  let threw = null;
  try { e.settle(ARBITER, 'GROUNDED'); } catch (err) { threw = err.message; }
  t('nothing settles before delivery',        threw === 'E_WRONG_STATE');

  threw = null;
  try { e.deliver(BUYER, { url: 'https://x.test/', quote: 'x'.repeat(30) }); } catch (err) { threw = err.message; }
  t('only the worker can deliver',            threw === 'E_NOT_WORKER');

  e.deliver(WORKER, { url: 'https://x.test/', quote: 'a quote long enough to be evidence here' });
  t('a delivery moves it to DELIVERED',       e.state === STATE.DELIVERED);

  threw = null;
  try { e.settle(WORKER, 'GROUNDED'); } catch (err) { threw = err.message; }
  t('the worker cannot settle its own job',   threw === 'E_NOT_ARBITER');

  threw = null;
  try { e.settle(BUYER, 'QUOTE_NOT_IN_SOURCE'); } catch (err) { threw = err.message; }
  t('the buyer cannot settle either',         threw === 'E_NOT_ARBITER');

  const r = e.settle(ARBITER, 'GROUNDED');
  t('the arbiter releases to the worker',     r.outcome === 'RELEASE' && r.paidTo === WORKER);

  threw = null;
  try { e.settle(ARBITER, 'QUOTE_NOT_IN_SOURCE'); } catch (err) { threw = err.message; }
  t('an escrow settles exactly once',         threw === 'E_WRONG_STATE');
}
{
  const e = fresh();
  e.deliver(WORKER, { url: 'https://x.test/', quote: 'a quote long enough to be evidence here' });
  const r = e.settle(ARBITER, 'QUOTE_NOT_IN_SOURCE');
  t('a failed check refunds the buyer',       r.outcome === 'REFUND' && r.paidTo === BUYER);
  t('the refunded state is recorded',         e.status().state === STATE.REFUNDED);
}
{
  const e = fresh();
  e.deliver(WORKER, { url: 'https://x.test/', quote: 'a quote long enough to be evidence here' });
  const r = e.settle(ARBITER, 'CLAIM_NOT_SUPPORTED');
  t('an unsupported claim pays nobody',       r.outcome === 'MANUAL_REVIEW' && r.paidTo === null);
}

/* ---- the arbiter is the verifier, not a model --------------------------- */
{
  const page = { ok: true, pageText: 'Velocity has no central matching engine, so keeper bots carry the load.',
                 fullChars: 71, url: 'https://docs.velocity.exchange/x' };
  const stub = async () => page;
  const good = await arbitrate({ url: page.url, quote: 'Velocity has no central matching engine' },
                               { fetchSource: stub, quoteIsGrounded });
  t('a grounded quote is GROUNDED',           good.reason === 'GROUNDED');
  const bad = await arbitrate({ url: page.url, quote: 'Velocity is urgently shopping for a new RPC vendor' },
                              { fetchSource: stub, quoteIsGrounded });
  t('an invented quote is QUOTE_NOT_IN_SOURCE', bad.reason === 'QUOTE_NOT_IN_SOURCE');
  const dead = await arbitrate({ url: 'https://nope.test/', quote: 'x'.repeat(40) },
                               { fetchSource: async () => ({ ok: false, error: 'HTTP_404' }), quoteIsGrounded });
  t('an unreachable source is SOURCE_UNREACHABLE', dead.reason === 'SOURCE_UNREACHABLE');
  t('the arbiter calls no model',
    !/NearAI|cloud-api\.near\.ai/.test((await import('node:fs')).readFileSync('pipeline/market.js', 'utf8')));
}

/* ---- the policy agrees with itself wherever it is written --------------- */
{
  const fs = await import('node:fs');
  const readme = fs.readFileSync('README.md', 'utf8');
  const inReadme = Object.entries(SETTLEMENT_POLICY)
    .every(([k, v]) => new RegExp(`${k}\\s*->\\s*${v}`).test(readme));
  t('the README table matches the code',      inReadme);

  let contractAgrees = true;
  try {
    const rs = fs.readFileSync('contracts/escrow/src/lib.rs', 'utf8');
    contractAgrees = Object.entries(SETTLEMENT_POLICY).every(([k, v]) => {
      const m = new RegExp(`"${k}"[\\s\\S]{0,120}?(RELEASE|REFUND|MANUAL_REVIEW)`).exec(rs);
      return !m || m[1] === v;
    });
  } catch { /* no contract on disk yet - the simulation is the deliverable */ }
  t('the contract, if present, matches too',  contractAgrees);
}

console.log(`\n${pass} passed, ${fail} failed\n`);

/* ---- the live leg ------------------------------------------------------- */
if (live) {
  console.log('--- LIVE: one real page, two settlements --------------------------\n');
  const { fetchSource } = await import('./fetch.js');
  const URL_ = 'https://docs.velocity.exchange/developers/trading-automation';

  const page = await fetchSource(URL_, { skipWhitelist: true });
  if (!page.ok) {
    console.log(`  the page did not fetch (${page.error}). The policy is unchanged; only this demo needs the network.\n`);
  } else {
    // Pick real prose, not navigation. A page's chrome ("Copy as Markdown",
    // "Trading Automation Trading Automation") matches a naive sentence regex
    // and makes a nonsense demo, so require a run of ordinary lowercase words.
    const sentence = pickSentence(page.pageText);
    console.log(`  fetched ${page.fullChars.toLocaleString()} chars from ${page.url}\n`);

    const honest = fresh();
    honest.deliver(WORKER, { url: URL_, quote: sentence, claim: 'Velocity documents its own execution path.' });
    const v1 = await arbitrate(honest.delivery, { fetchSource, quoteIsGrounded });
    const r1 = honest.settle(ARBITER, v1.reason);
    console.log(`  WORKER A quotes the page verbatim`);
    console.log(`    "${sentence.slice(0, 96)}${sentence.length > 96 ? '…' : ''}"`);
    console.log(`    verdict ${v1.reason} -> ${r1.outcome}, paid to ${r1.paidTo}\n`);

    const liar = fresh();
    liar.deliver(WORKER, { url: URL_,
      quote: 'Velocity told us their transaction landing is failing and they are shopping for a new vendor this quarter',
      claim: 'Velocity urgently needs Sender.' });
    const v2 = await arbitrate(liar.delivery, { fetchSource, quoteIsGrounded });
    const r2 = liar.settle(ARBITER, v2.reason);
    console.log(`  WORKER B invents a quote that would be worth paying for`);
    console.log(`    "Velocity told us their transaction landing is failing…"`);
    console.log(`    verdict ${v2.reason} -> ${r2.outcome}, paid to ${r2.paidTo}\n`);

    const ok = r1.outcome === 'RELEASE' && r2.outcome === 'REFUND';
    console.log(`  ${ok ? 'The honest worker was paid. The fabricator was not.' : 'UNEXPECTED: check the output above.'}\n`);
    if (!ok) fail++;
  }
}

/* ---- the on-chain leg --------------------------------------------------- */
if (onChain) {
  console.log('--- ON-CHAIN --------------------------------------------------------\n');
  try {
    const { settleOnChain, chainConfigured } = await import('./escrow-chain.js');
    if (!chainConfigured()) {
      console.log('  Not configured. Set NEAR_ESCROW_CONTRACT, NEAR_ARBITER_ACCOUNT and');
      console.log('  NEAR_ESCROW_KEY to settle on testnet. Simulated above instead.\n');
    } else {
      const r = await settleOnChain({ reasonCode: 'QUOTE_NOT_IN_SOURCE' });
      console.log(`  settled on testnet: ${r.txHash}\n  ${r.explorer}\n`);
    }
  } catch (e) {
    console.log(`  on-chain settlement unavailable: ${e.message}`);
    console.log('  The policy above is unchanged. This leg is additive.\n');
  }
}

console.log('THE BOUNDARY, stated plainly:');
console.log('  The arbitration logic above is real, tested, and runs with no key and no network.');
console.log('  The settlement rail is NEAR Intents - priced, not wired. Nothing has moved money.');
console.log('  On-chain escrow is the next build; the policy table is already shared with it.\n');

process.exit(fail ? 1 : 0);
