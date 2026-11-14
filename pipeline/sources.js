// The seed list the Collector reads. Every URL below was FETCHED AND VERIFIED
// on 2026-11-04 before being added. Never let a model invent one, and never
// guess a path - the first draft of this file guessed six blog URLs and four
// were 404s.
//
// Rebuilt after run-2026-11-04T21-10-13 returned 0 qualified leads. The
// diagnosis was not a pipeline fault: the sources were Solana CORE DEVELOPMENT
// (Anza, Agave releases, SIMD proposals), so latency_sensitive was false on
// every row and the Sender lens never fired once. Sender sells to firms running
// a book, so the seeds now point at trading venues and volume data.
import { ICP } from './icp.js';

// Context pages - volume dashboards and trade press. They corroborate; they can
// never clear the gate on their own (SOURCE_TYPE_CAP pins them at Research), so
// the run reads them LAST and only a handful of them.
export const CONTEXT_URLS = [
  'https://defillama.com/chain/Solana',
  'https://defillama.com/protocols/Dexes/Solana',
  'https://blockworks.com',
  'https://solanafloor.com',
  'https://cryptobriefing.com/tag/solana/',
  // Added 2026-11-13 after the whiteboard put revenue in latency-sensitive
  // trading. Both pages were FETCHED AND VERIFIED before being added, and both
  // name trading firms the registry did not hold - prop AMMs and market makers,
  // the rank 1-4 buyers. They stay market_context, so they are capped at
  // Research and can only corroborate.
  'https://solanacompass.com/learn/Lightspeed/solanas-next-big-catalyst-in-2026-lightspeed-weekly-roundup',
  'https://solanafloor.com/news/solana-foundation-launches-institutional-trading-program-for-hedge-funds-prop-firms-and-market-makers'
];

// The run is ACCOUNT-LED. Sources come from the registry's own verified
// surfaces, in the order of how much a verdict is allowed to rest on them:
// what the buyer says about itself, then the technical ecosystem, then context.
// A surface that is not marked verified is never fetched, and a research-blocked
// account contributes nothing.
export function sourcePlan({ contextLimit = CONTEXT_URLS.length } = {}) {
  const buyer = [], tech = [];
  for (const a of ICP) {
    if (a.blocked) continue;
    for (const sf of (a.surfaces || [])) {
      if (sf.status !== 'verified') continue;
      const BUYER_KINDS = ['blog','careers','status','ir','company','site'];
      const bucket = BUYER_KINDS.includes(sf.kind) ? buyer : tech;
      bucket.push({ url: sf.url, account: a.name, kind: sf.kind,
                    source_type: bucket === buyer ? 'buyer_owned' : 'technical_ecosystem' });
    }
  }
  const ctx = CONTEXT_URLS.slice(0, contextLimit)
    .map(url => ({ url, account: null, kind: 'context', source_type: 'market_context' }));
  const plan = [...buyer, ...tech, ...ctx];
  const seen = new Set();
  return plan.filter(p => !seen.has(p.url) && seen.add(p.url));
}

// Kept so --urls and older callers still work. The default run uses sourcePlan().
export const SEED_URLS = [
  // BUYER-OWNED SURFACES - where a firm talks about its own stack. These are
  // the only pages that can say "our transaction landing is failing", which is
  // the sentence the Sender lens actually needs. Verified 2026-11-05.
  'https://www.jito.network/blog',              // 2.8k  MEV / block building
  'https://www.wintermute.com/careers',         // 4.2k  market maker hiring
  'https://www.gsr.io/careers',                 // 7.1k  market maker hiring
  'https://docs.drift.trade',                   // 5.5k  perps venue docs
  'https://www.pyth.network/blog',              // 5.6k  low-latency oracle

  // trading venues - the declared buyer's own words
  'https://www.drift.trade/updates',            // 5.3k  perps venue, product updates
  'https://station.jup.ag/blog',                // 3.1k  largest Solana aggregator
  'https://blog.orca.so',                       // 4.4k  AMM
  // volume and liquidity evidence - where transaction_volume_evidence comes from
  'https://defillama.com/chain/Solana',         // 5.5k  chain-level volume and TVL
  'https://defillama.com/protocols/Dexes/Solana', // 3.0k DEX league table
  // trade press that covers trading, not protocol engineering
  'https://blockworks.com',                      // 12.4k institutional/trading desk
  'https://solanafloor.com',                    // 12.4k Solana ecosystem + volume
  'https://cryptobriefing.com/tag/solana/'      // 7.7k  general corroboration
];

// Dropped after testing, with the reason, so nobody re-adds them blind:
//   solana.com/news          HTTP 429 - rate limited on every attempt
//   theblock.co/tag/solana   HTTP 403 - blocks this user agent
//   jup.ag/blog              HTTP 404 - guessed path, does not exist
//   raydium.io/blog          HTTP 404 - guessed path
//   zeta.markets/blog        HTTP 404 - guessed path
//   blog.marginfi.com        DNS failure
//   blockworks.co/category/solana HTTP 404 - guessed path; use the root
//   anza.xyz/blog            fetches fine, but it is core dev, not a buyer
//   github.com/anza-xyz/agave/releases  same - protocol engineering
