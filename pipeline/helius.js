// Helius's own customer and partner list, read from helius.dev/use-case/trading
// on 2026-11-12.
//
// This is the "check Tab 1 first" rule, and the registry was failing it. DFlow
// was classified a COMPETITOR while Helius's own page carries a testimonial
// from DFlow's CEO about using LaserStream. Wintermute, Ellipsis Labs and Pyth
// were prospects while appearing under "Some of our partners".
//
// Cold-pitching your own customer is the worst outcome this system can produce,
// and it was one scan away from doing it four times.
export const HELIUS_SOURCE = 'https://www.helius.dev/use-case/trading';
export const HELIUS_READ_ON = '2026-11-12';

// Named testimonial, with a person and a title - these are users.
// NAMED TESTIMONIALS - a person, a title, and a quote. These are users.
export const CUSTOMERS = [
  { name:'Solana Company', person:'Cosmo Jiang', title:'General Partner, Pantera Capital (HSDT board observer)',
    product:'native SOL staking', quote:'When it comes to SOL staking, Helius is truly differentiated' },
  { name:'Solana', person:'Anatoly Yakovenko', title:'Co-founder & CEO', product:'platform',
    quote:"They've done an amazing job at streamlining and removing complexity from app development on the network" },
  { name:'DFlow', person:'Nitesh Nath', title:'Co-founder & CEO', product:'LaserStream',
    quote:'we depend on LaserStream to feed our price engine with the freshest, fastest onchain data' },
  { name:'DFlow', person:'Jeff Delonge', title:'CTO', product:'LaserStream',
    quote:'LaserStream was a drop-in replacement, and fully compatible with our Yellowstone consumption patterns' },
  { name:'Keyrock', person:'Jeremy De Groodt', title:'Co-founder & CTO', product:'Pythnet operations / nodes',
    quote:'Helius has been instrumental in kickstarting our Pythnet operations' },
  { name:'Phantom', person:'Jorge Valdeiglesias', title:'Staff Software Engineer', product:'RPC / staked connections',
    quote:'we handled extreme congestion and enabled our users to complete more than 10 million transactions in just one day' },
  { name:'Zeta Markets', person:'Tristan Frizza', title:'Founder & CEO', product:'data / indexing',
    quote:'Being able to save countless hours of data engineering work and costly AWS bills is a big advantage for us' },
  { name:'Loopscale', person:'Luke Truitt', title:'CEO & Co-founder', product:'RPC + Webhooks',
    quote:'Helius has been a game-changer for us with extremely reliable RPCs alongside Webhooks' },
  { name:'Backpack', person:'Armani Ferrante', title:'CEO & Co-founder', product:'RPC / APIs',
    quote:'They power a great portion of our infrastructure at Backpack' },
  { name:'Squads', person:'Stepan Simkin', title:'CEO & Co-founder', product:'LaserStream WebSockets',
    quote:'Helius is an absolutely essential piece of infrastructure' },
  { name:'Crossmint', person:'Alfonso Gomez Manas', title:'Co-founder', product:'infrastructure',
    quote:'A big percentage of Crossmint products couldn\'t exist without Helius' },
  { name:'Chainalysis', person:'Jonathan Levin', title:'CEO & Co-founder', product:'RPC / data',
    quote:'enabling our team to access reliable data that meets the demands of an enterprise-grade platform' },
  { name:'Huma Finance', person:'Erbil Karaman', title:'Co-founder', product:'support / RPC',
    quote:'Huma dapp is now working faster and more reliably on Solana' },
  { name:'Vector.fun', person:'Richard Wu', title:'Co-founder', product:'RPC',
    quote:'besides providing best-in-class Solana RPCs, they\'ve basically given us white-glove service' },
  { name:'daos.fun', person:'Baoskee', title:'Co-founder', product:'RPC',
    quote:'Helius was the only provider that responded immediately on a Saturday night' },
  { name:'Flipcash', person:'Tanner Philp', title:'COO', product:'dedicated gRPC plugin',
    quote:'Helius runs a dedicated gRPC plugin that we use for large, real-time data consumption' },
  { name:'Unruggable', person:'Bill Papas', title:'Founder', product:'RPC',
    quote:'Helius\'s RPC service delivers same-slot latency with ready-to-use frontend links' },
  { name:'Brale', person:'Cody Lambert', title:'Software Engineer', product:'RPC + staked connections',
    quote:'The moment we switched our RPCs to Helius and started sending transactions through staked connections, all of our problems disappeared' },
  { name:'SendAI', person:'Aryan', title:'Co-founder', product:'LaserStream',
    quote:'LaserStream was a seamless drop-in replacement for Geyser. It integrated perfectly with Jupiter infra' },
  { name:'BitGo', person:'Gbenga Omosuyi', title:'Head of Strategic Partnerships', product:'Validator',
    quote:'Helius\'s validator is a natural fit for our Solana staking suite' },
  { name:'Bitwise Asset Management', person:'Hong Kim', title:'CTO', product:'Validator-as-a-Service',
    quote:'We\'re thrilled to partner with Helius in building our own Solana validator for the Bitwise Solana Staking ETF' }
];

// The customer logo wall on helius.dev/solana-rpc-nodes. No testimonial, but
// Helius publishes them as customers - which makes every one of them an
// EXPANSION conversation, never a cold lead.
export const LOGOS = [
  'Solana', 'Phantom', 'Jupiter', 'Bybit', 'Moonshot', 'pump.fun', 'Backpack',
  'Pudgy Penguins', 'Bloomberg', 'Drift', 'Wintermute', 'Coinbase', 'Squads',
  'DexScreener', 'Tensor', 'Raydium', 'Exodus', 'Magic Eden', 'Helium', 'Crossmint',
  'Solana Foundation', 'Zeta', 'Loopscale', 'Sling Money', 'Trust Wallet', 'Orca',
  'Helio', 'Meteora', 'Sphere', 'Drip', 'Solflare', 'Shopify', 'Discord', 'Brave',
  'Hivemapper', 'Ledger'
];

// Listed under "Some of our partners".
export const PARTNERS = ['Wintermute', 'Jump Crypto', 'Galaxy', 'Ergonia', 'Tokka Labs',
                         'Selini Capital', 'Ellipsis Labs', 'Pyth'];

// Custodians named on the validator page.
export const CUSTODIANS = ['BitGo', 'Fireblocks', 'Anchorage'];

// Helius's OWN per-product buyer lists - "Who is X for?" - verbatim from each
// product page. This is the targeting taxonomy, written by the seller.
export const PRODUCT_BUYERS = {
  preconfirmations: ['Prop AMMs & HFTs', 'Snipers', 'Copy traders', 'Liquidation bots', 'Searchers'],
  shreds:           ['HFT Desks', 'MEV Searchers', 'Memecoin Snipers', 'DEX Aggregators',
                     'Liquidation Engines', 'RFQ Desks'],
  preprocessed:     ['DEX aggregators', 'Trading terminals', 'Launchpads', 'Copy traders',
                     'DeFi applications', 'Telegram trading bots'],
  laserstream:      ['Traders & market makers', 'Searchers & MEV Bots', 'Memecoin sniper bots',
                     'Wallets', 'Real-time portfolio trackers', 'Onchain analytics'],
  webhooks:         ['Wallets', 'Portfolio trackers', 'Crypto social apps', 'NFT marketplaces',
                     'Analytics platforms', 'Gaming & virtual worlds'],
  privacy:          ['Institutions', 'Fintech Wallets', 'Payment cards', 'RWA Settlement',
                     'Trading & Treasury', 'Collateral Management'],
  validator:        ['Custodians', 'Asset managers', 'ETF issuers', 'Exchanges', 'Institutional stakers']
};

// Privacy Rings names its own buyers in the docs, and they are the most
// specific list Helius publishes: "regulated entities, such as fintechs,
// payroll platforms, remittance companies, neobanks, and institutions".
export const PRIVACY_BUYERS = ['Private on-off ramp (CEXs, fiat-to-crypto processors)',
  'Payments and remittances (payroll platforms, remittance companies)', 'Payment cards',
  'Fintechs and institutions', 'Trading, treasury and RWAs', 'Agentic commerce',
  'Neobanks', 'Regulated entities needing policy and compliance controls'];

// Fintech sub-cases Helius names on its fintech page.
export const FINTECH_CASES = ['Cross-border Payments', 'Neobanks', 'Stablecoin Accounts',
                              'Wealth Management', 'Buy Now, Pay Later', 'Trade Finance'];

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function heliusRelationship(name) {
  const n = norm(name);
  const c = CUSTOMERS.find(x => norm(x.name) === n || n.includes(norm(x.name)) || norm(x.name).includes(n));
  if (c) return { relationship: 'EXISTING_CUSTOMER',
                  evidence: { ...c, basis: `testimonial from ${c.person}, ${c.title}` },
                  source: HELIUS_SOURCE };
  const p = PARTNERS.find(x => norm(x) === n || n.includes(norm(x)) || norm(x).includes(n));
  if (p) return { relationship: 'PARTNER', evidence: { name: p, basis: 'listed under "Some of our partners"' }, source: HELIUS_SOURCE };
  // The logo wall. Helius publishes these as customers, so they are expansion
  // conversations - not cold leads. This is the check the registry was missing
  // when it had Loopscale, Backpack, Orca and Meteora as prospects.
  const l = LOGOS.find(x => norm(x) === n || (norm(x).length > 4 && n.includes(norm(x))));
  if (l) return { relationship: 'EXISTING_CUSTOMER',
                  evidence: { name: l, basis: 'on the customer logo wall at helius.dev/solana-rpc-nodes' },
                  source: 'https://www.helius.dev/solana-rpc-nodes' };
  const cust = CUSTODIANS.find(x => norm(x) === n);
  if (cust) return { relationship: 'PARTNER', evidence: { name: cust, basis: 'named custodian on the validator page' },
                     source: 'https://www.helius.dev/validator' };
  return null;
}

// The gate: never cold-approach someone already on the list.
export const isOwnSide = name => !!heliusRelationship(name);

// What a lead is WORTH. From helius.dev/pricing, read 2026-11-13. This is the
// missing half of qualification: a product fit with no sense of contract size
// cannot be prioritised against another.
export const PLANS = [
  { name:'Free',         usd:0,    credits:'1M',    note:'testing only - not a lead' },
  { name:'Developer',    usd:49,   credits:'10M',   note:'small projects' },
  { name:'Business',     usd:499,  credits:'100M',  note:'LaserStream gRPC unlocks here' },
  { name:'Professional', usd:999,  credits:'200M',  note:'data add-ons, cheaper shreds' },
  { name:'Enterprise',   usd:null, credits:'1B+',   note:'custom, 4-hour SLA' }
];

// Add-ons, which are where the real contract value sits.
export const ADD_ONS = [
  { name:'Shred Delivery', usd:1000, unit:'per month per IP', note:'$800 on Professional' },
  { name:'Dedicated nodes', usd:2900, unit:'per month', note:'gRPC, Jito bundle simulation, colocation' },
  { name:'LaserStream data add-on', usd:400, unit:'per month for 5TB',
    note:'scales to $6,000 for 100TB; Professional tier only' }
];

// Rough value signal per motion, for prioritising two equal fits.
export const MOTION_VALUE = {
  shreds: 'high - $1,000/mo/IP on top of a plan',
  laserstream: 'high - Business tier minimum, $499/mo, plus data add-ons from $400',
  preconfirmations: 'medium - any paid plan, metered per message',
  preprocessed: 'medium - any paid plan, 0.1 credits/msg',
  sender: 'low entry, high volume - included on all plans, paid in SOL tips per send',
  rebates: 'revenue share - earns the customer SOL rather than costing them',
  rpc: 'tiered - $49 to $999, Enterprise custom',
  validator: 'very high - institutional staking, 0% fees, revenue from scale not price',
  vaas: 'very high - white-label validator for custodians, ETF issuers, DATs',
  validator_monetization: 'high - existing validator operators',
  privacy: 'enterprise - Custom Rings for regulated entities',
  historical: 'tiered with RPC', parsed: '10 credits/request', token_api: 'tiered with RPC',
  webhooks: '1 credit per push', wallet_api: 'tiered with RPC'
};

// DIGITAL ASSET TREASURY COMPANIES. An entire buyer segment the registry did
// not have: public companies holding SOL on the balance sheet. At end-2025,
// 19 disclosed DATs held over 20 million SOL - about 3.5% of total supply -
// and they buy Validator and Validator-as-a-Service, not Sender.
export const DAT_SEGMENT = {
  label: 'Digital Asset Treasury companies, ETF issuers and institutional asset managers',
  evidence: 'Solana Company (NASDAQ: HSDT) selected Helius as its native staking provider; Bitwise built its Solana Staking ETF validator with Helius',
  products: ['validator', 'vaas', 'validator_monetization', 'privacy'],
  buyers: ['Digital asset treasury companies (DATs)', 'ETF issuers', 'Institutional asset managers',
           'Qualified custodians', 'Public companies holding SOL'],
  custodianIntegrations: ['BitGo', 'Anchorage', 'Coinbase', 'Fireblocks'],
  contact: 'sales@helius.xyz for custom staking solutions'
};

// Competitors, and what Helius says they lack - useful for a displacement
// conversation, and for never pitching one of them.
export const COMPETITOR_GAPS = {
  QuickNode: ['no dedicated RPC nodes', 'no transaction parsing API', 'no webhooks', '99.84% uptime'],
  Alchemy:   ['no dedicated RPC nodes', 'no transaction parsing API', 'no webhooks', '120 RPS', '99.85% uptime'],
  Triton:    ['named as a comparison provider on helius.dev']
};

// THE SELLER, AND ITS RIVALS. Neither is a prospect.
//
// The first discovery pass offered Helius itself as a candidate, and 36 of its
// 71 infrastructure-tier names came off a roster of RPC vendors - Syndica,
// Chainstack, Blockdaemon, GetBlock, dRPC, Allnodes, Google, AWS. Those are
// the companies Helius competes with for the same budget. Pitching one is not
// a wasted call, it is a leak.
//
// Names below are only those actually encountered on a verified roster or on
// helius.dev's own comparison pages. Nothing here is from memory.
export const SELLER_NAMES = [
  'helius', 'helius labs', 'helius.dev', 'helius rpc'
];

export const COMPETITORS = [
  // Named on helius.dev's own comparison pages.
  'quicknode', 'alchemy', 'triton', 'triton one',
  // Found on the RPC-provider roster, 2026-11-13. Each sells Solana RPC,
  // dedicated nodes or streaming data - the same line items Helius sells.
  'syndica', 'chainstack', 'blockdaemon', 'getblock', 'drpc', 'drpc platform',
  'allnodes', 'instantnodes', 'fastnode', 'all that node', 'orbitflare',
  'ironforge', 'goldsky', 'hello moon', 'blockjoy', 'latitude.sh',
  'cherry servers', 'ainodes', 'aisol', 'solstice labs', 'figment', 'luganodes',
  'google', 'google cloud', 'amazon web services', 'aws', 'infstones'
];

const flat = n => String(n || '').toLowerCase().replace(/[^a-z0-9. ]/g, '').replace(/\s+/g, ' ').trim();

// A name may arrive carrying its own acronym - "Amazon Web Services (AWS)" -
// and that defeated an exact match against either half: the flattened form is
// "amazon web services aws", which is neither "amazon web services" nor "aws".
// AWS then walked into the worklist as an RPC Nodes opportunity at fit 21,
// while being on the competitor list twice over. So check the name, the part
// before the bracket, and the bracketed acronym on its own.
const nameForms = name => {
  const raw = String(name || '').trim();
  const m = /^(.+?)\s*\(([^)]{1,20})\)\s*$/.exec(raw);
  const forms = [flat(raw)];
  if (m) { forms.push(flat(m[1]), flat(m[2])); }
  return forms.filter(Boolean);
};

// Why this name is on Helius's own side of the table, or null if it is not.
// Checked BEFORE any prospect gate, because the worst outcome in this system
// is cold-pitching a company that is already paying, partnered, or rival.
export function sellerSideReason(name) {
  for (const n of nameForms(name)) {
    if (SELLER_NAMES.includes(n)) return 'this is Helius itself';
    if (COMPETITORS.includes(n))  return 'competitor: sells Solana RPC, nodes or streaming data';
  }
  return null;
}

// REVENUE RANK, from the seller's own list prices and billing model.
// Ranked 1 (highest revenue) to 10. Two leads with an equal evidence score are
// not equally valuable: the one whose product sits higher here is worth more.
// Source: helius.dev/pricing, read 2026-11-13. Helius publishes no revenue by
// product, so this is an ordering from price and buyer, not a disclosed figure.
export const REVENUE_RANK = {
  rpc_enterprise: 1,            // custom contracts, 1B+ credits, 4h SLA
  dedicated_nodes: 2,           // from $2,900/mo per node, often several per desk
  laserstream: 3,               // $400-6,000/mo on top of a Business+ plan
  shreds: 4, preconfirmations: 4, sender_max: 4,  // $800-1,000/mo per IP
  rpc: 5,                       // Professional $999 / Business $499 self-serve
  vaas: 6, validator_monetization: 6,             // B2B, fewer larger deals
  rpc_developer: 7,             // $49/mo plus credit overages - the funnel
  webhooks: 8, parsed: 8, historical: 8, token_api: 8, wallet_api: 8,
  preprocessed: 8,              // metered credits, never sold alone
  validator: 9,                 // 0% commission; the moat, not the fee
  privacy: 10, rebates: 10      // acquisition and goodwill
};

// The revenue tier a product sits in, for prompt and prioritisation copy.
export const revenueTier = product => {
  const r = REVENUE_RANK[product];
  if (r === undefined) return 'unranked';
  if (r <= 4) return 'top';        // latency-sensitive trading: pays the bills
  if (r <= 6) return 'mid';        // self-serve paid tiers and B2B validator
  return 'funnel';                 // metered APIs, staking, free products
};

// The highest-revenue product in a fit vector, so an account can be sorted by
// what it could actually be sold rather than by how many products it touches.
export const topRevenueProduct = products => {
  const ranked = (products || []).filter(p => REVENUE_RANK[p] !== undefined);
  if (!ranked.length) return null;
  return ranked.sort((a, b) => REVENUE_RANK[a] - REVENUE_RANK[b])[0];
};
