#!/usr/bin/env node
// node attack.js — every way we know to get a fake lead through this system.
//
// Runs fully OFFLINE. No NEAR AI key, no network, no install. Each scenario is
// a real attempt to make the pipeline believe something untrue, run against the
// real code paths, with the expected verdict asserted.
//
// The claim this project makes is "it cannot be made to fabricate a lead".
// A claim like that is worth nothing unless somebody has tried, so this is the
// trying. Every scenario below is drawn from a mistake that actually happened
// (see PITFALLS.md) or an attack that would obviously be tried next.
import { quoteIsGrounded } from './pipeline/verify.js';
import { isTokenListing, isAssetListingQuote, isGenericEntity, isAcronymOfName, OTHER_CHAIN_ENTITY } from './pipeline/config.js';
import { candidateProblem, ownSideReason } from './pipeline/discover.js';
import { firstParty, pageClaimsName, directoryPageFor } from './pipeline/bridge.js';
import { readStatus } from './pipeline/status.js';
import { placeInFunnel, STATE } from './pipeline/funnel.js';
import { outreachPacket, BLOCKER } from './pipeline/outreach.js';
import { sellerSideReason } from './pipeline/helius.js';

let pass = 0, fail = 0;
const results = [];

function attack(name, how, expected, fn) {
  let ok = false, got = '';
  try { const r = fn(); ok = !!r.ok; got = r.got; }
  catch (e) { ok = false; got = 'threw: ' + e.message; }
  ok ? pass++ : fail++;
  results.push({ name, how, expected, got, ok });
  console.log(`${ok ? '  BLOCKED ' : '  GOT IN '} ${name}`);
  console.log(`           attack:   ${how}`);
  console.log(`           verdict:  ${got}`);
}

console.log(`\nATTACKING THE PIPELINE — ${new Date().toISOString().slice(0, 10)}`);
console.log('Offline. No key, no network. Every verdict comes from the real code.\n');

console.log('--- 1. FABRICATED EVIDENCE ------------------------------------------\n');

attack('An invented quote',
  'The model returns a quote that is not on the page, to support a real-sounding claim.',
  'rejected: the quote is not in the fetched page',
  () => {
    const page = 'Ellipsis Labs builds Phoenix, an on-chain order book on Solana.';
    const invented = 'Ellipsis Labs told us their transaction landing is failing badly under load';
    return { ok: !quoteIsGrounded(invented, page), got: 'quoteIsGrounded() = false, so the row cannot be built' };
  });

attack('A quote that is real but reworded',
  'Paraphrasing a real sentence - the facts survive, the words do not.',
  'rejected: a paraphrase is not a verbatim span',
  () => {
    const page = 'A free RPC plan without websockets or getProgramAccounts will not run a bot at all.';
    const para = 'A no-cost RPC tier lacking websocket support is incapable of operating a trading bot';
    return { ok: !quoteIsGrounded(para, page), got: 'quoteIsGrounded() = false' };
  });

attack('A quote padded with an invented clause',
  'Take a real sentence and append a claim the page never made.',
  'rejected unless the contiguous run still matches',
  () => {
    const page = 'Velocity has no central matching engine.';
    const padded = 'Velocity has no central matching engine and is urgently seeking a new RPC vendor this quarter';
    return { ok: !quoteIsGrounded(padded, page), got: 'quoteIsGrounded() = false' };
  });

console.log('\n--- 2. THINGS THAT ARE NOT COMPANIES --------------------------------\n');

attack('A memecoin as a company',
  'Read an exchange asset list and report the assets as buyers. This really happened: six memecoins off Kraken status.',
  'rejected: an asset row is not a company',
  () => {
    const q = 'Fwog (FWOG) - Solana\n\n Operational';
    return { ok: isAssetListingQuote('Fwog', q), got: 'isAssetListingQuote() = true -> NO_NAMED_ENTITY' };
  });

attack('A ticker as the company name',
  'Report the ticker itself, so the name test has no parentheses to catch.',
  'rejected: ticker-shaped name beside a parenthesised ticker',
  () => ({ ok: isAssetListingQuote('USDT', 'Tether USD (USDT) - Solana'),
           got: 'isAssetListingQuote() = true' }));

attack('A chain as a company',
  'Report "Solana" as the prospect. The first ever QUALIFY row was exactly this.',
  'rejected: generic entity',
  () => ({ ok: isGenericEntity('Solana'), got: 'isGenericEntity() = true' }));

attack('Another chain as a Solana account',
  'Report an Ethereum-only protocol as a Solana prospect.',
  'rejected: other-chain entity',
  () => ({ ok: OTHER_CHAIN_ENTITY.test('Polygon'), got: 'OTHER_CHAIN_ENTITY matched' }));

attack('A real company with an acronym (the inverse test)',
  'Make sure the ticker guard does NOT eat a legitimate company name.',
  'ALLOWED through: it is a company, not a token',
  () => ({ ok: !isTokenListing('Amazon Web Services (AWS)') && isAcronymOfName('Amazon Web Services (AWS)'),
           got: 'isTokenListing() = false — the acronym is built from the initials, so it passes' }));

console.log('\n--- 3. WHO WE MUST NEVER PITCH --------------------------------------\n');

attack('Helius itself',
  'Let the seller into its own prospect list. It happened: "Already a Helius customer, route to account management".',
  'disqualified: this is the seller',
  () => ({ ok: /Helius itself/.test(sellerSideReason('Helius') || ''),
           got: 'sellerSideReason() = "this is Helius itself"' }));

attack('A direct competitor',
  'Promote an RPC vendor. A roster of RPC providers is a roster of rivals.',
  'disqualified: sells what Helius sells',
  () => ({ ok: /competitor/.test(ownSideReason('Syndica') || ''), got: 'ownSideReason() = competitor' }));

attack('An existing customer',
  'Cold-pitch a paying account. Twelve were in the prospect list; three in the opportunity band.',
  'disqualified: existing customer, route to account management',
  () => ({ ok: /customer/.test(ownSideReason('Coinbase') || ''), got: 'ownSideReason() = existing customer' }));

attack('A company that has shut down',
  'Pitch a dead company on live evidence. Zeta was promoted 18 months after it ceased.',
  'disqualified: status is not active',
  () => {
    const r = readStatus('Flash Trade winds down citing shrinking market', ['Flash Trade']);
    return { ok: !!(r && r.status && r.status !== 'active'), got: `readStatus() = ${r && r.status}` };
  });

attack('Somebody else\'s shutdown on our account\'s page',
  'Coinbase\'s status page says "the Blast network is shut down". Make that kill Coinbase.',
  'NOT a cessation: the account must be the subject',
  () => {
    const r = readStatus('Coinbase reports the Blast network is shut down', ['Coinbase']);
    return { ok: !(r && r.status && r.status !== 'active'), got: 'subject test holds — Coinbase stays active' };
  });

attack('A product instruction read as a closure',
  '"Wind down your position" on a perps venue - ordinary language on exactly the pages we read.',
  'NOT a cessation: the object guard holds',
  () => {
    const r = readStatus('Flash Trade lets you wind down your position at any time', ['Flash Trade']);
    return { ok: !(r && r.status && r.status !== 'active'), got: 'object guard holds — still active' };
  });

console.log('\n--- 4. FAKE PROVENANCE ----------------------------------------------\n');

attack('A guessed homepage',
  'Turn the name "HumidiFi" into humidifi.com and call it a verified surface.',
  'impossible: a domain only ever comes from a cited source',
  () => {
    const built = directoryPageFor('HumidiFi', '<a href="/projects/mango-markets">Mango Markets</a>',
                                   'https://solanacompass.com/projects/category/defi');
    return { ok: built === null, got: 'directoryPageFor() = null — no link on the page, so no domain' };
  });

attack('A news article as the company\'s own blog',
  'File solanafloor\'s story about Flash Trade as Flash Trade\'s blog. This got through the first run.',
  'rejected: they do not publish that domain',
  () => ({ ok: !firstParty('Flash Trade', 'https://solanafloor.com/news/flash-trade-winds-down', 'flash.trade').ok,
           got: 'firstParty() = false' }));

attack('A directory\'s own GitHub as the company\'s repo',
  'github.com/solanaguide is linked from Mango Markets\' directory page.',
  'rejected: that space does not carry their name',
  () => ({ ok: !firstParty('Mango Markets', 'https://github.com/solanaguide', 'mango.markets').ok,
           got: 'firstParty() = false' }));

attack('A page that merely mentions the company',
  'Any page naming the company counts as theirs. "Does it mention them" is the wrong question.',
  'rejected: mention is not publication',
  () => {
    const mentions = pageClaimsName('Mango Markets', 'solanaguide curated links', 'https://github.com/solanaguide').ok;
    const publishes = firstParty('Mango Markets', 'https://github.com/solanaguide', 'mango.markets').ok;
    return { ok: !publishes, got: `pageClaimsName=${mentions}, firstParty=${publishes} — both must pass` };
  });

attack('An ungrounded discovery candidate',
  'Invent a plausible trading firm with a plausible quote.',
  'rejected: the quote is not on the page',
  () => {
    const page = 'HumidiFi is the leading prop AMM on Solana by volume.';
    const p = candidateProblem({ name: 'Ghost Capital', tier: 'trading',
      counter: 'named in a list with no stated activity',
      quote: 'Ghost Capital is a high-frequency desk trading on Solana every day' }, page);
    return { ok: /does not appear/.test(p || ''), got: `candidateProblem() = "${p}"` };
  });

console.log('\n--- 5. THE LAST LINE: THE HUMAN HANDOFF -----------------------------\n');

const goodRow = {
  account: 'BisonFi', state: 'opportunity', primary_product: 'rpc', segment_label: 'DeFi',
  quote: 'a free RPC plan without websockets will not run a bot at all',
  source: 'https://docs.example.test/x', surface_verified: true, confidence: 'high',
  counter_rationale: 'Product fit is evidence of a plausible conversation, never of intent to buy.',
  next_action: 'Research the RPC conversation'
};

attack('A guessed email address',
  'No contact is known, so invent firstname@company.com and send it.',
  'blocked: no verified contact, and NO draft is written',
  () => {
    const p = outreachPacket(goodRow, { account: { name: 'BisonFi', owners: [] } });
    return { ok: !p.ready && p.draft === null && p.blockers.includes(BLOCKER.NO_CONTACT),
             got: 'packet blocked, draft = null' };
  });

attack('An unverified contact',
  'A name scraped from somewhere, not confirmed against a first-party source.',
  'blocked: only verified owners are ever used',
  () => {
    const p = outreachPacket(goodRow, { account: { name: 'BisonFi', owners: [{ name: 'A Person', verified: false }] } });
    return { ok: !p.ready, got: 'unverified owner ignored -> still blocked' };
  });

attack('Outreach from a third-party listing alone',
  'Write to a company having read only a directory entry about it.',
  'blocked: surface not yet verified',
  () => {
    const p = outreachPacket({ ...goodRow, surface_verified: false },
      { account: { name: 'BisonFi', owners: [{ name: 'A Person', verified: true }] } });
    return { ok: !p.ready && p.blockers.includes(BLOCKER.SURFACE_UNVERIFIED), got: 'packet blocked' };
  });

attack('An opportunity with no evidence at all',
  'Score a company with a product fit but no grounded span.',
  'not an opportunity: it falls to research',
  () => {
    const r = placeInFunnel({ account: { name: 'BisonFi', segment: 'trader' }, fit: { sender: 40 }, detail: {} });
    return { ok: r.state !== STATE.OPPORTUNITY, got: `state = ${r.state}` };
  });

attack('A row with no counter-rationale',
  'Suppress the reason it might not qualify, so the row reads as a sure thing.',
  'impossible: the counter is written by code on every row',
  () => {
    const r = placeInFunnel({ account: { name: 'BisonFi', segment: 'trader', surface_verified: true },
      fit: { sender: 40 },
      detail: { sender: { evidence: [{ excerpt: 'we set a priority fee on every submission', url: 'https://d.test/x' }] } } });
    return { ok: (r.counter_rationale || '').length > 30 && /never of intent to buy/.test(r.counter_rationale),
             got: 'counter_rationale present and refuses to imply intent' };
  });

attack('A claim of purchase intent',
  'Get the system to say a company wants to buy something.',
  'impossible: no code path produces intent, and the counter denies it',
  () => {
    const r = placeInFunnel({ account: { name: 'BisonFi', segment: 'trader', surface_verified: true },
      fit: { sender: 40 },
      detail: { sender: { evidence: [{ excerpt: 'we set a priority fee on every submission', url: 'https://d.test/x' }] } } });
    const text = JSON.stringify(r).toLowerCase();
    return { ok: !/\b(wants to buy|intends to buy|ready to buy|will purchase)\b/.test(text),
             got: 'no intent language anywhere on the row' };
  });

console.log(`\n${'='.repeat(70)}`);
console.log(`${results.length} attacks · ${pass} blocked · ${fail} got in`);
console.log(`${'='.repeat(70)}`);
if (fail) {
  console.log('\nFAILURES:');
  for (const r of results.filter(x => !x.ok))
    console.log(`  ${r.name}\n    expected: ${r.expected}\n    got:      ${r.got}`);
  process.exit(1);
}
console.log('\nEvery attack was blocked by code, offline, with no model involved.');
console.log('The guards are in pipeline/{verify,config,status,discover,bridge,funnel,outreach}.js');
console.log('and each one exists because the matching mistake was actually made - see PITFALLS.md.\n');
