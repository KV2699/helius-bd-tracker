#!/usr/bin/env node
// THE DISCOVERY PASS - find companies the registry does not have.
//
// The dated scan reads the surfaces of accounts already in the registry, so it
// can only ever report what changed at a company we already knew. This pass
// reads ROSTERS - pages whose purpose is to list firms - and collects names.
// No date gate; every other discipline kept. See pipeline/discover.js.
//
//   node discover.js                       all rosters, $1 cap
//   node discover.js --budget 0.50
//   node discover.js --urls <a>,<b>        read these pages instead
//   node discover.js --tier trading        print only one buyer tier
import { runDiscovery, saveDiscovery, TIERS } from './pipeline/discover.js';
import { NearAI, Ledger, loadPrices } from './pipeline/near.js';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const budget = Number(arg('budget', 1));
const today  = arg('today', new Date().toISOString().slice(0, 10));
const only   = arg('tier', null);

// Every roster below was FETCHED AND VERIFIED on 2026-11-13 before being added,
// and every URL came from a search result or a page we had already read - none
// was constructed or guessed. The character count is what the fetcher actually
// returned, so a page that turns into a JS shell later is visible as a change.
export const ROSTERS = [
  { url: 'https://solanacompass.com/projects/category/defi/perpetual-trading',
    chars: 58436, note: 'perps venues - the page says 88 projects. Highest-value buyer tier.' },
  { url: 'https://solanacompass.com/projects/category/defi/dex-swaps?page=2',
    chars: 62385, note: 'DEXes and swap venues, page 2 of the category.' },
  { url: 'https://solanacompass.com/projects/category/defi',
    chars: 56834, note: 'DeFi protocols at scale - builder tier.' },
  { url: 'https://solanacompass.com/projects/category/infrastructure/validator-performance',
    chars: 50206, note: 'validator operators - the buyers for VaaS and validator monetisation.' },
  { url: 'https://solanacompass.com/statistics/staking',
    chars: 17617, note: 'staking league table - institutional validator operators by stake.' },
  { url: 'https://solanacompass.com/learn/Lightspeed/solanas-next-big-catalyst-in-2026-lightspeed-weekly-roundup',
    chars: 42119, note: 'prop AMMs and venues named in one roundup.' },
  { url: 'https://solanafloor.com/news/solana-foundation-launches-institutional-trading-program-for-hedge-funds-prop-firms-and-market-makers',
    chars: 6460, note: 'Solana Foundation institutional trading programme.' },
  { url: 'https://defillama.com/protocols/Dexes/Solana',
    chars: 4661, note: 'DEX volume league table.' },
  // READ WITH CARE. This roster lists RPC and data vendors, which is the
  // category Helius itself competes in: Syndica, Triton, Figment and QuickNode
  // are rivals, not prospects. It is still worth reading, because the same
  // pages name validator operators and data vendors who BUY infrastructure -
  // but anything infra-tier off this page goes to classify.js before it is
  // treated as a prospect.
  { url: 'https://solanacompass.com/projects/category/infrastructure/rpc-nodes',
    chars: 57432, note: 'RPC vendors - CONTAINS HELIUS COMPETITORS. Classify before prospecting.',
    competitor_risk: true }
];

const urls = arg('urls') ? arg('urls').split(',') : ROSTERS.map(r => r.url);

console.log(`\nDISCOVERY PASS - ${urls.length} roster(s), $${budget} cap`);
console.log('Collecting NAMES, not events. No date gate. Every name is capped at research.\n');

await loadPrices();
const ledger = new Ledger(`discover-${today}`, budget);
const ai = new NearAI(ledger);

const result = await runDiscovery({
  urls, ai, today,
  onEvent: e => process.stdout.write(`  [${e.stage}] ${e.msg}\n`)
});

result.cost = ledger.totals;
result.ledger = ledger.lines;
result.rosters = ROSTERS.filter(r => urls.includes(r.url));
const file = await saveDiscovery(result);

const c = result.counts;
console.log(`\n--- ${result.discoveryId} ---`);
console.log(`Pages read      : ${c.pages}`);
console.log(`Candidates      : ${c.candidates}  (${c.new_to_registry} new to the registry, ${c.already_in_registry} already in it)`);
console.log(`Rejected        : ${c.rejected}`);
console.log(`By tier         : ${TIERS.map(t => `${t} ${c.by_tier[t]}`).join(' · ')}`);
console.log(`Cost            : ${result.cost.calls} calls · $${(result.cost.usd ?? 0).toFixed(4)}`);
console.log(`Saved           : ${file}`);
if (result.budgetStopped) console.log('NOTE: the budget stopped this pass before every roster was read.');

const show = result.candidates.filter(x => !x.in_registry && (!only || x.tier === only));
console.log(`\nNEW TO THE REGISTRY - ${show.length} name(s), highest-value buyer tier first\n`);
for (const x of show) {
  const also = x.also_named_by.length ? `  (+${x.also_named_by.length} other page)` : '';
  console.log(`  ${x.tier.padEnd(13)} ${x.name}${also}`);
  console.log(`  ${''.padEnd(13)} ${x.says}`);
  console.log(`  ${''.padEnd(13)} counter: ${x.counter}`);
}
console.log(`\n${result.disclaimer}\n`);
