// Where the Helius buyers live. REGISTRY = fetched and verified by this
// pipeline. CANDIDATE = publicly known to exist, not yet verified - a target
// for HX-G1, never a pipeline row. Hosting posture is UNKNOWN unless a
// first-party page says otherwise.
export const UNIVERSE = [
  { cat:'Perp DEX / order book', orgs:'Velocity Protocol', status:'Registry — docs verified',
    hosting:'Provider-dependent (documented)',
    note:'Own docs name Liquidator, JIT Maker, Order Trigger — and name Helius.' },
  { cat:'Perp DEX / order book', orgs:'Drift Protocol', status:'Registry — RESEARCH_BLOCKED',
    hosting:'UNKNOWN', note:'Docs subdomain serves Velocity. Surface mismatch.' },
  { cat:'Perp DEX / order book', orgs:'Ellipsis Labs (Phoenix)', status:'Registry — blog verified',
    hosting:'UNKNOWN', note:'Claims low latency — a claim of strength, not a gap.' },
  { cat:'Perp DEX / order book', orgs:'Flint Labs', status:'Registry — blog + site verified',
    hosting:'UNKNOWN', note:'Venue. Makers run their own quoting logic — the makers are the buyers.' },
  { cat:'Perp DEX / order book', orgs:'Zeta, Mango, Adrena, other Solana venues', status:'Candidate',
    hosting:'UNKNOWN', note:'Not yet fetched. HX-G1 targets.' },

  { cat:'Keeper-bot / liquidator / JIT operator', orgs:'NONE NAMED YET', status:'GAP — the most valuable empty cell on this tab',
    hosting:'Provider-dependent by nature',
    note:'Every perp DEX in the registry documents bots it does not operate. HX-GA2 fills this.' },

  { cat:'AMM / aggregator / router', orgs:'Jupiter', status:'Registry — blog verified', hosting:'UNKNOWN', note:'' },
  { cat:'AMM / aggregator / router', orgs:'Orca', status:'Registry — blog verified', hosting:'UNKNOWN', note:'' },
  { cat:'AMM / aggregator / router', orgs:'Titan Exchange', status:'Registry — docs verified',
    hosting:'Sells execution — likely not a buyer', note:'Classification pending. May be a competitor.' },
  { cat:'AMM / aggregator / router', orgs:'Raydium, Meteora, Lifinity', status:'Candidate', hosting:'UNKNOWN', note:'' },

  { cat:'Trading firm / market maker', orgs:'Wintermute', status:'Registry — careers verified',
    hosting:'Likely self-hosted (unevidenced)', note:'No dated Solana signal yet. Speculative.' },
  { cat:'Trading firm / market maker', orgs:'GSR', status:'Registry — careers verified',
    hosting:'Likely self-hosted (unevidenced)', note:'No dated Solana signal yet. Speculative.' },
  { cat:'Trading firm / market maker', orgs:'Jump, Amber, Flow Traders, Keyrock, Auros', status:'Candidate',
    hosting:'Likely self-hosted', note:'Displacement motion if a gap is ever evidenced.' },

  { cat:'MEV / block infrastructure', orgs:'Jito', status:'Registry — ECOSYSTEM_DEPENDENCY, excluded',
    hosting:'Self-hosted', note:'Partner / competitive intelligence, not a prospect.' },

  { cat:'Oracle / data', orgs:'Pyth Network', status:'Registry — blog verified, relationship UNCLEAR', hosting:'UNKNOWN', note:'' },
  { cat:'Oracle / data', orgs:'Switchboard, Chainlink Solana', status:'Candidate', hosting:'UNKNOWN', note:'' },

  { cat:'Exchange with Solana rails', orgs:'Kraken', status:'Registry — status page verified',
    hosting:'Self-hosted', note:'Buys RPC/Enterprise, NOT Sender.' },
  { cat:'Exchange with Solana rails', orgs:'Coinbase', status:'Registry — status page verified',
    hosting:'Self-hosted', note:'Buys RPC/Enterprise, NOT Sender. Recent incidents were on other chains.' },
  { cat:'Exchange with Solana rails', orgs:'Binance, Gemini, Bybit, OKX', status:'Candidate',
    hosting:'Self-hosted', note:'' },

  { cat:'Consumer app / wallet', orgs:'pump.fun / Baton', status:'Registry — BLOCKED (HTTP 403)', hosting:'UNKNOWN', note:'' },
  { cat:'Consumer app / wallet', orgs:'Bags.fm', status:'Registry — BLOCKED (4 chars of text)', hosting:'UNKNOWN', note:'' },
  { cat:'Consumer app / wallet', orgs:'Phantom, Backpack, Solflare, Jupiter Mobile', status:'Candidate', hosting:'UNKNOWN', note:'' },

  { cat:'Competitor — never a prospect', orgs:'Alchemy, QuickNode, Triton, DFlow, Anza',
    status:'Registry — COMPETITOR', hosting:'—', note:'Short-circuits before scoring.' }
];
