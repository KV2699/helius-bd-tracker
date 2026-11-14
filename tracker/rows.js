// Pipeline rows. EVERY signal below was fetched and read by the pipeline on the
// date shown - nothing here comes from a search summary. Every contact is
// UNVERIFIED, because none has been confirmed from a primary source, and an
// invented name is worse than an empty cell.
export const ROWS = [
  {
    org:'Velocity Protocol', stream:'X', streamName:'Stream X - Expansion', secondary:'A',
    sector:'Perp DEX / order book', motion:'SENDER', expansion:true, multiSurface:'YES',
    surfaces:'RPC, websockets, getProgramAccounts, keeper submission (4)',
    signal:'Own developer docs state: "Several free tiers will not work here, because they disable exactly what a bot depends on: websocket subscriptions and getProgramAccounts." The same docs name Helius as sufficient to get started. The Keeper Bots page lists Liquidator, JIT Maker and Order Trigger.',
    source:'https://docs.velocity.exchange/developers/trading-automation',
    signalType:'Standing condition (undated docs)', signalDate:'05/11/2026',
    contact:'UNVERIFIED - no infra or procurement contact named on any fetched surface. Run HX-GA1.',
    entry:'Expansion / tier upgrade - they are already on a Helius free tier',
    next:'THIS WEEK: do NOT cold-pitch. Pull the existing Helius account record for Velocity and confirm the free-tier relationship. Approach on displacement-from-free - their own docs say free tiers break their bots. Ask who owns RPC spend for the keeper fleet. SEPARATELY run HX-GA2 to name the third-party operators running those bots: they are Stream B and the likelier Sender buyer.',
    verification:'Pipeline fetch, evidence grade A, first-party',
    status:'RETAIN', statusWhy:'existing relationship, active commercial hook',
    days:'Multi-year (standing condition, no expiry)', lastVerified:'UNVERIFIED',
    points:{ automation:25, pain:15, identity:8, overlap:12, timing:4 },
    why:{ automation:'Liquidator, JIT Maker and Order Trigger named in their own docs',
          pain:'Documented websocket + gPA limit, but the same page says Helius free tier is sufficient to start - pain partially covered',
          identity:'Org named and first-party verified; no contact found',
          overlap:'RPC, websockets, gPA, keeper submission',
          timing:'Standing condition - no dated event' }
  },
  {
    org:'Kraken', stream:'F', streamName:'Stream F - Displacement', sector:'Centralised exchange',
    motion:'RPC_ENTERPRISE', multiSurface:'NO', surfaces:'RPC, archival (2)',
    signal:'Status page, live: "Deposit and Withdrawal Delays on Multiple Networks" and "BRL withdrawals via PIX are currently being rejected."',
    source:'https://status.kraken.com', signalType:'First-party dated incident', signalDate:'05/11/2026',
    contact:'UNVERIFIED - run HX-GA1.',
    entry:'Incident-adjacent reliability conversation',
    next:'WITHIN 7 DAYS while the incident is live: route to the RPC/Enterprise team, NOT Sender. A withdrawal delay is a funding rail, not an execution path. Frame as node reliability. Do not pitch Sender.',
    verification:'Pipeline fetch, first-party status page',
    status:'FREE NOW', statusWhy:'incident window closes in days',
    days:'~7 days', lastVerified:'UNVERIFIED',
    points:{ automation:5, pain:18, identity:8, overlap:8, timing:15 },
    why:{ automation:'Exchange - no keeper-bot evidence', pain:'First-party dated incident, multiple networks',
          identity:'Org named, no contact', overlap:'RPC, archival', timing:'Incident live as at the fetch' }
  },
  {
    org:'Ellipsis Labs (Phoenix)', stream:'A', streamName:'Stream A - Protocol / DeFi operator',
    sector:'Perp DEX / order book', motion:'SENDER', multiSurface:'YES',
    surfaces:'RPC, websockets, submission (3)',
    signal:'Own site: "Phoenix Perps brings professional-grade perpetual futures to Solana with low latency, low fees, and consistent performance."',
    source:'https://ellipsislabs.xyz', signalType:'Standing condition', signalDate:'05/11/2026',
    contact:'UNVERIFIED - run HX-GA1.', entry:'Technical discovery only',
    next:'QUALIFY BEFORE APPROACH. The quote is a claim of strength, not a gap - they say latency is solved. Run HX-G2 for any incident or post-mortem contradicting it. Do not approach on this signal alone.',
    verification:'Pipeline fetch, evidence grade B', status:'RETAIN', statusWhy:'no expiring hook',
    days:'Multi-year', lastVerified:'UNVERIFIED',
    points:{ automation:15, pain:5, identity:8, overlap:10, timing:4 },
    why:{ automation:'Perps venue - automation implied, bots not documented',
          pain:'Claims low latency and consistent performance - the opposite of a gap',
          identity:'Org named, no contact', overlap:'RPC, websockets, submission', timing:'Standing condition' }
  },
  {
    org:'Flint Labs', stream:'A', streamName:'Stream A - redirect to Stream B',
    sector:'Perp DEX / prop AMM', motion:'SENDER', multiSurface:'NO', surfaces:'RPC, submission (2)',
    signal:'Own blog: "Flint Perpetual Futures Draft Whitepaper" (04/11/2026) and "Flint is building a fully on-chain perp DEX on Solana" (01/10/2026). Site states: "A multi-maker prop AMM for USDC-quoted spot. Makers run their own quoting logic."',
    source:'https://flint.trade/blog', signalType:'Dated product announcement', signalDate:'04/11/2026',
    contact:'UNVERIFIED - run HX-GA2 to name the makers.',
    entry:'Named makers, not Flint',
    next:'FLINT IS THE VENUE, NOT THE BUYER. Its own copy says makers run their own quoting logic - the makers carry the latency exposure. Run HX-GA2 against flint.trade to name 2-3 makers quoting on Flint and enter THEM as Stream B. The perps launch is a dated timing hook.',
    verification:'Pipeline fetch, first-party', status:'FREE NOW', statusWhy:'perps launch window open',
    days:'~90 days to perps launch', lastVerified:'UNVERIFIED',
    points:{ automation:8, pain:5, identity:8, overlap:8, timing:8 },
    why:{ automation:'Venue, not the automation operator - makers run their own logic',
          pain:'No documented gap', identity:'Org named, no contact',
          overlap:'RPC, submission', timing:'Dated whitepaper, perps pending' }
  },
  {
    org:'Coinbase', stream:'F', streamName:'Stream F - Displacement', sector:'Centralised exchange',
    motion:'RPC_ENTERPRISE', multiSurface:'NO', surfaces:'RPC, archival (2)',
    signal:'Status page: "Delayed Sends and Receives - Sonic Network" (03/11/2026) and "Disabled Sends / Receives - EVMSEI" (04/11/2026).',
    source:'https://status.coinbase.com', signalType:'First-party dated incident', signalDate:'03/11/2026',
    contact:'UNVERIFIED - run HX-GA1.', entry:'None yet',
    next:'HOLD. Both incidents are on OTHER chains - Sonic and EVMSEI, not Solana. The routing layer refused this row for exactly that reason. Re-enter only on a dated Solana-specific incident.',
    verification:'Pipeline fetch, first-party', status:'EXPIRED', statusWhy:'wrong chain, no Solana hook',
    days:'n/a', lastVerified:'UNVERIFIED',
    points:{ automation:5, pain:0, identity:8, overlap:8, timing:12 },
    why:{ automation:'Exchange - no keeper-bot evidence', pain:'Incidents are on other chains - zero by rule',
          identity:'Org named, no contact', overlap:'RPC, archival', timing:'Dated, but on the wrong chain' }
  },
  {
    org:'Wintermute', stream:'C', streamName:'Stream C - Trading firm / MEV infra',
    sector:'Market maker', motion:'SENDER', multiSurface:'NO', surfaces:'Sender, dedicated nodes (2)',
    signal:'Careers surface verified and fetchable. NO dated Solana infrastructure signal captured in the 90-day window.',
    source:'https://www.wintermute.com/careers', signalType:'No dated signal', signalDate:'-',
    contact:'UNVERIFIED - run HX-GA1.', entry:'None yet',
    next:'SPECULATIVE - SECTOR INFERENCE ONLY. A market maker is latency-bound by nature, but nothing fetched evidences a Solana landing gap. Run HX-G1 weekly for a Solana infra role posting or an incident. Do not approach on sector logic.',
    verification:'Surface verified, no signal', status:'RETAIN', statusWhy:'no hook yet',
    days:'n/a', lastVerified:'UNVERIFIED', speculative:true,
    points:{ automation:15, pain:0, identity:8, overlap:8, timing:2 },
    why:{ automation:'Market maker - automation inferred from sector, not documented',
          pain:'No evidence fetched', identity:'Org named, no contact',
          overlap:'Sender, dedicated nodes', timing:'No trigger' }
  },
  {
    org:'GSR', stream:'C', streamName:'Stream C - Trading firm / MEV infra',
    sector:'Market maker', motion:'SENDER', multiSurface:'NO', surfaces:'Sender, dedicated nodes (2)',
    signal:'Careers surface verified and fetchable. NO dated Solana infrastructure signal captured in the 90-day window.',
    source:'https://www.gsr.io/careers', signalType:'No dated signal', signalDate:'-',
    contact:'UNVERIFIED - run HX-GA1.', entry:'None yet',
    next:'SPECULATIVE - SECTOR INFERENCE ONLY. Same treatment as Wintermute: weekly HX-G1, no approach on sector logic.',
    verification:'Surface verified, no signal', status:'RETAIN', statusWhy:'no hook yet',
    days:'n/a', lastVerified:'UNVERIFIED', speculative:true,
    points:{ automation:15, pain:0, identity:8, overlap:8, timing:2 },
    why:{ automation:'Market maker - automation inferred from sector, not documented',
          pain:'No evidence fetched', identity:'Org named, no contact',
          overlap:'Sender, dedicated nodes', timing:'No trigger' }
  },
  {
    org:'Titan Exchange', stream:'?', streamName:'Classification pending - possible competitor',
    sector:'Aggregator / router', motion:'SENDER', multiSurface:'NO', surfaces:'Submission, routing (2)',
    signal:'Developer docs fetchable (8,946 chars); nav carries "Latency and Server Locations"; quickstart: "Fetch a quote and assemble an executable swap transaction."',
    source:'https://titan-exchange.gitbook.io/titan/developer-doc/developers-portal/quickstart',
    signalType:'Standing condition', signalDate:'05/11/2026',
    contact:'UNVERIFIED', entry:'None - classify first',
    next:'CLASSIFY BEFORE ANY APPROACH. Titan ships a Swap API and routing engine; it may SELL execution quality rather than buy it. Research reported a "Titan Prime optimizes transaction landing" claim that is NOT in the page we can fetch - confirm from a Titan-owned page, then reclassify to COMPETITOR or Stream A.',
    verification:'Pipeline fetch, evidence grade A', status:'RETAIN', statusWhy:'no expiring hook',
    days:'Multi-year', lastVerified:'UNVERIFIED',
    points:{ automation:8, pain:5, identity:8, overlap:8, timing:4 },
    why:{ automation:'Aggregator / router - submits, but sells execution',
          pain:'No documented gap', identity:'Org named, no contact',
          overlap:'Submission, routing', timing:'Standing condition' }
  },
  {
    org:'Pyth Network', stream:'D', streamName:'Stream D - Indexer / data consumer',
    sector:'Oracle / data', motion:'RPC_ENTERPRISE', multiSurface:'NO', surfaces:'Data, RPC (2)',
    signal:'Blog: "October at Pyth: $13.67M ARR (+18.9%), 4,451 Terminal signups".',
    source:'https://www.pyth.network/blog', signalType:'Dated business update', signalDate:'03/11/2026',
    contact:'UNVERIFIED', entry:'None yet',
    next:'WRONG MOTION. Growth signal, not an execution gap. Relationship classification is UNCLEAR in the registry - resolve it before spending research time.',
    verification:'Pipeline fetch, first-party', status:'RETAIN', statusWhy:'no expiring hook',
    days:'Multi-year', lastVerified:'UNVERIFIED',
    points:{ automation:5, pain:0, identity:8, overlap:8, timing:8 },
    why:{ automation:'Oracle - no automated submission evidence', pain:'No gap',
          identity:'Org named, no contact', overlap:'Data, RPC', timing:'Dated business update' }
  }
];

// Not rows. Kept visible so nobody re-adds them blind.
export const EXCLUDED = [
  ['Drift Protocol','RESEARCH_BLOCKED','docs.drift.trade redirects to docs.velocity.exchange. The keeper-bot page is titled "Keeper Bots | Velocity Protocol" - Velocity x11, Drift x1, and the single Drift mention is the nav link "Migrate from Drift". The evidence is real and belongs to Velocity.'],
  ['Jito','ECOSYSTEM_DEPENDENCY','Partner / competitive intelligence, not a prospect.'],
  ['Alchemy','COMPETITOR','Sells RPC.'],
  ['QuickNode','COMPETITOR','Sells RPC.'],
  ['Triton','COMPETITOR','Sells RPC.'],
  ['DFlow','COMPETITOR','Sells order flow / execution.'],
  ['Anza','COMPETITOR','Core protocol engineering, not a buyer.'],
  ['pump.fun / Baton','BLOCKED - HTTP 403','Only readable evidence is a login-walled LinkedIn posting that cannot be verified by fetch.'],
  ['Bags.fm','BLOCKED - TOO_LITTLE_TEXT','Site returns 4 characters of text. JS app, no server-rendered copy.'],
  ['Helius','EXISTING_CUSTOMER','Us.']
];
