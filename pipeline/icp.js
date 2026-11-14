// The target-account registry.
//
// RULE: a surface appears here only if it was FETCHED and confirmed to return
// real text. The pipeline never constructs or guesses a URL. An account with no
// fetchable surface is RESEARCH_BLOCKED - an honest state, not a lead.
//
// Relationship classification happens BEFORE scoring, because a competitor with
// perfect evidence is still not a prospect.

import { readFileSync } from 'node:fs';

export const RELATIONSHIP = {
  PROSPECT: 'PROSPECT',
  PARTNER: 'PARTNER',
  COMPETITOR: 'COMPETITOR',
  ECOSYSTEM_DEPENDENCY: 'ECOSYSTEM_DEPENDENCY',
  EXISTING_CUSTOMER: 'EXISTING_CUSTOMER',
  UNCLEAR: 'UNCLEAR'
};

// Which Helius motion a piece of evidence belongs to. A reliability signal is
// NOT automatically Sender: deposits, withdrawals, validators, staking and
// custody are a different sale.
export const MOTION_ROUTE = {
  SENDER: ['transaction submission','transaction landing','landing rate','jito','bundle','bundles',
           'priority fee','priority fees','sendtransaction','market making','market maker',
           'arbitrage','liquidation','liquidations','keeper bot','keeper bots','execution latency','fill rate',
           'failed transaction','failed transactions','dropped transaction','transaction drops',
           'congestion','landing','jit maker','swqos','staked connection'],
  RPC_ENTERPRISE: ['deposit','deposits','withdrawal','withdrawals','validator','validators','staking',
                   'custody','node reliability','wallet infrastructure','market data','archival']
};

export function routeMotion(text) {
  const t = String(text || '').toLowerCase();
  const sender = MOTION_ROUTE.SENDER.filter(k => t.includes(k));
  const other  = MOTION_ROUTE.RPC_ENTERPRISE.filter(k => t.includes(k));
  if (sender.length) return { motion: 'SENDER', matched: sender.slice(0, 4) };
  if (other.length)  return { motion: 'RPC_ENTERPRISE', matched: other.slice(0, 4) };
  return { motion: 'UNROUTED', matched: [] };
}

/* Evidence grades, from the 5 Nov research report.
   A = first-party technical (docs, eng blog, GitHub, status page)
   B = first-party role/product (careers, product docs, announcement)
   C = credible third-party research
   D = directory / aggregator / weak attribution
   E = inference - never acceptable                                           */
export const GRADE_BY_SURFACE = {
  docs:'A', github:'A', status:'A', eng_blog:'A',
  careers:'B', product:'B', announcement:'B', blog:'B',
  research:'C', press:'C',
  directory:'D', aggregator:'D'
};
export const GRADE_CAP = { A:'ACTIONABLE', B:'QUALIFY', C:'RESEARCH', D:'RESEARCH', E:'NO_ACTION' };

export const ICP = [
  /* ---- PROSPECTS with a verified surface ---------------------------- */
  // Added 2026-11-05. The strongest first-party execution evidence in the whole
  // registry was sitting on a surface we had filed under the wrong company.
  // Velocity owns docs.velocity.exchange, runs the keeper-bot system forked
  // from Drift v2, and documents the latency dependency in its own words.
  // The account was never Drift. It is Velocity.
  { name:'Velocity Protocol', segment:'defi', aliases:['velocity','velocity protocol','velocity dex','velocity exchange'],
    tier:2, rel:RELATIONSHIP.PROSPECT, github:'velocity-exchange',
    repos:['keeper-bots-v2','jit-proxy','relay','keepyrs','keep-rs'],
    why:'Runs the keeper-bot system (Liquidator, JIT Maker, Order Trigger) that submits on-chain transactions. Its own docs tell operators to watch for websocket resubscribes and track RPC latency.',
    surfaces:[ {kind:'docs', url:'https://docs.velocity.exchange/developers/trading-automation', status:'verified'},
               {kind:'docs', url:'https://docs.velocity.exchange/developers/trading-automation/keeper-bots', status:'verified'} ],
    senderFit:'possible', evidenceGrade:'A',
    note:'Fetched 2026-11-05: 8,878 chars, title "Trading Automation | Velocity Protocol". Contains "track RPC latency" and a troubleshooting section on RPC credit exhaustion. NOTE the open question: the bots are run by THIRD-PARTY operators, so the party feeling the landing pain may be an operator, not Velocity itself.',
    humanTask:'Identify named keeper-bot operators on Velocity. The operator, not the protocol, is the likelier Sender buyer.' },

  // Demoted 2026-11-05 from #1 Qualify. The docs surface that carried the
  // A-grade keeper-bot / JIT / RPC-latency evidence now serves ANOTHER
  // COMPANY'S documentation. Velocity states its program was forked from
  // Drift Protocol v2, which explains the redirect - and is exactly why the
  // content must not be attributed to Drift.
  { name:'Drift Protocol', segment:'defi', aliases:['drift','drift protocol'], tier:2, rel:RELATIONSHIP.PROSPECT,
    why:'Solana perps venue. Liquidations and keeper workflows are latency-bound.',
    surfaces:[ {kind:'blog', url:'https://www.drift.trade/updates', status:'verified'},
               {kind:'site', url:'https://www.drift.trade', status:'verified'} ],
    blockedSurfaces:[ {kind:'docs', url:'https://docs.drift.trade',
                       resolvedTo:'https://docs.velocity.exchange/protocol',
                       reason:'DOCS_SURFACE_MISMATCH',
                       finding:'Docs subdomain serves Velocity Protocol documentation. Velocity states its program was forked from Drift Protocol v2.'},
                      {kind:'docs', url:'https://docs.drift.trade/developers/trading-automation',
                       resolvedTo:'https://docs.velocity.exchange/developers/trading-automation',
                       reason:'DOCS_SURFACE_MISMATCH',
                       // Re-checked 2026-11-05 against a research note claiming this page
                       // was now Drift-owned and carried "track your RPC latency".
                       // Neither held: the page says Velocity 23 times and Drift once,
                       // and that phrase does not appear in the fetched text at all.
                       finding:'Re-checked 2026-11-05. Still redirects to Velocity. Body mentions Velocity 23 times, Drift once. The phrase "track your RPC latency" is NOT present in the fetched page; the nearest real line is "track RPC latency", and it is on a Velocity page.'},
                      {kind:'docs', url:'https://docs.drift.trade/developers/trading-automation/keeper-bots',
                       resolvedTo:'https://docs.velocity.exchange/developers/trading-automation/keeper-bots',
                       reason:'DOCS_SURFACE_MISMATCH',
                       // The decisive check. Page <title> is "Keeper Bots | Velocity
                       // Protocol". Velocity 11 times, Drift once - and that one mention
                       // is the nav item "Migrate from Drift". This is a COMPETITOR'S
                       // migration documentation, not a Drift-owned surface.
                       finding:'Title is "Keeper Bots | Velocity Protocol". Velocity x11, Drift x1 - and the single Drift mention is the nav link "Migrate from Drift". The keeper-bot dependency is real, but it is documented by Velocity, about Velocity.'} ],
    blocked:'RESEARCH_BLOCKED', blockedReason:'DOCS_SURFACE_MISMATCH',
    senderFit:'unknown', evidenceGrade:'unverified',
    humanTask:'Find a DRIFT-owned surface for the keeper-bot dependency. The engineering fact is real; the documentation of it currently belongs to Velocity. Separately: establish whether post-exploit Drift is still a buying entity at all.',
    note:'Do not attribute Velocity content to Drift. Site and /updates remain Drift-branded; the prior Sender evidence is not verifiable from the docs surface.' },

  { name:'Ellipsis Labs', aliases:['ellipsis labs','ellipsis','solfi','phoenix'], tier:1, rel:RELATIONSHIP.PARTNER,
    why:'Prop execution systems on Solana.',
    surfaces:[ {kind:'blog', url:'https://ellipsislabs.xyz', status:'verified'} ],
    note:'Ellipsis Labs is NOT the same entity as SolFi or Phoenix. Confirm which team owns execution before outreach.' },

  { name:'Wintermute', aliases:['wintermute'], tier:1, rel:RELATIONSHIP.PARTNER,
    why:'Algorithmic market maker with a Solana book.',
    surfaces:[ {kind:'careers', url:'https://www.wintermute.com/careers', status:'verified'} ],
    note:'Wintermute is NOT Tessera V. Do not conflate the firm with a prop AMM it may operate.' },

  { name:'GSR', segment:'trader', aliases:['gsr','gsr markets'], tier:1, rel:RELATIONSHIP.PROSPECT,
    why:'Crypto market maker and liquidity provider.',
    surfaces:[ {kind:'careers', url:'https://www.gsr.io/careers', status:'verified'},
               // linked from their careers page; 5,659 chars, 12 dated items
               {kind:'blog', url:'https://www.gsr.io/insights', status:'verified', discovered:'2026-11-10'} ] },

  { name:'Jupiter', segment:'defi', aliases:['jupiter','jup','jupiter exchange'], tier:2, rel:RELATIONSHIP.PROSPECT,
    why:'Largest Solana aggregator by routed volume.',
    surfaces:[ {kind:'blog', url:'https://station.jup.ag/blog', status:'verified'},
               // the developer surfaces, linked from station.jup.ag. The
               // changelog carries 18 dated items - the densest dated surface
               // in the whole registry.
               {kind:'changelog', url:'https://developers.jup.ag/changelog', status:'verified', discovered:'2026-11-10'},
               {kind:'docs', url:'https://developers.jup.ag/blog', status:'verified', discovered:'2026-11-10'} ] },

  { name:'Orca', segment:'defi', aliases:['orca'], tier:2, rel:RELATIONSHIP.PROSPECT,
    why:'Solana AMM with sustained volume. Monitor, not a lead.',
    surfaces:[ {kind:'blog', url:'https://blog.orca.so', status:'verified'} ] },

  { name:'Pyth Network', aliases:['pyth','pyth network'], tier:2, rel:RELATIONSHIP.PARTNER,
    why:'Low-latency oracle. May be a dependency of trading venues rather than a Sender buyer.',
    surfaces:[ {kind:'blog', url:'https://www.pyth.network/blog', status:'verified'} ] },

  /* ---- route to a DIFFERENT Helius motion --------------------------- */
  { name:'Kraken', segment:'exchange', aliases:['kraken'], tier:2, rel:RELATIONSHIP.PROSPECT, route:'RPC_ENTERPRISE',
    why:'Exchange with Solana deposit/withdrawal infrastructure.',
    surfaces:[ {kind:'status', url:'https://status.kraken.com', status:'verified'} ],
    note:'Deposit/withdrawal delays are NOT transaction-landing pain. Route to RPC/Enterprise, not Sender.' },

  { name:'Coinbase', segment:'exchange', aliases:['coinbase'], tier:2, rel:RELATIONSHIP.PROSPECT, route:'RPC_ENTERPRISE',
    why:'Validator, staking and custody infrastructure on Solana.',
    surfaces:[ {kind:'status', url:'https://status.coinbase.com', status:'verified'},
               // The RSS history is the FULL incident log, structured and dated,
               // rather than the handful the status page renders.
               {kind:'status', url:'https://status.coinbase.com/history.rss', status:'verified', discovered:'2026-11-10'} ],
    note:'Validator/staking/custody is a different sale from Sender.' },

  /* ---- NOT prospects. Classified before scoring. -------------------- */
  { name:'Jito', segment:'infrastructure', aliases:['jito','jito labs','jitosol','jto'], tier:null, rel:RELATIONSHIP.ECOSYSTEM_DEPENDENCY,
    why:'Block building and MEV infrastructure. Sender routes through Jito.',
    surfaces:[ {kind:'blog', url:'https://www.jito.network/blog', status:'verified'} ],
    note:'Partner / competitor-adjacent. Never a cold Sender prospect.' },

  { name:'Solana Foundation', aliases:['solana foundation','solana labs'], tier:null, rel:RELATIONSHIP.ECOSYSTEM_DEPENDENCY,
    why:'Ecosystem foundation.', surfaces:[] },

  { name:'DFlow', aliases:['dflow'], tier:null, rel:RELATIONSHIP.EXISTING_CUSTOMER,
    why:'Routing and transaction-landing overlap with Sender.', surfaces:[],
    note:'Determine partner vs competitor before any contact.' },

  { name:'Alchemy',   aliases:['alchemy'],   tier:null, rel:RELATIONSHIP.COMPETITOR, why:'RPC vendor.', surfaces:[] },
  { name:'QuickNode', aliases:['quicknode'], tier:null, rel:RELATIONSHIP.COMPETITOR, why:'RPC vendor.', surfaces:[] },
  { name:'Triton',    aliases:['triton'],    tier:null, rel:RELATIONSHIP.COMPETITOR, why:'RPC vendor.', surfaces:[] },
  { name:'Anza',      aliases:['anza'],      tier:null, rel:RELATIONSHIP.COMPETITOR, why:'Solana client team.', surfaces:[] },
  { name:'Helius',    aliases:['helius'],    tier:null, rel:RELATIONSHIP.EXISTING_CUSTOMER, why:'Us.', surfaces:[] },

  /* ---- named in research, NO fetchable surface ---------------------- */
  // Seeded 2026-11-10. Neither had any surface at all until the DefiLlama
  // directory supplied a declared URL, which was then fetched and confirmed to
  // name the company. Both are UNCLEAR until a human classifies them: a wallet
  // and an exchange are plausible RPC buyers and implausible Sender buyers.
  // CLASSIFIED 2026-11-10 from 41,871 chars of their own docs. Their SDK ships
  // updatePriorityFee() and getRecentPrioritizationFees, and their docs
  // describe "crank instructions that keep our exchange moving" plus a
  // Liquidator. Priority fees and cranks can only mean Solana transaction
  // landing - this is the first account classified SENDER on evidence rather
  // than on sector.
  // From the DefiLlama batch, 2026-11-11.
  //
  // Save looked like a Stream B operator: its landing page reads "Owner: Save
  // Liquidator Permissionless". Its OWN DOCS say the opposite:
  //   "We rely on third party liquidators, which means anyone can become a
  //    liquidator."
  // That is a program-account owner in a protocol table, not a bot fleet. Save
  // is the VENUE - the same pattern as Velocity, Zeta and Flint. The operators
  // are the third parties running liquidations against it.
  // Its liquidator repo (solendprotocol/liquidator) is ARCHIVED, last pushed
  // 2022, 69 forks and only one touched since May 2025. A dead seam.
  { name:'Save', aliases:['save','save finance','solend'], tier:3, rel:RELATIONSHIP.UNCLEAR,
    status:'active', segment:'defi', github:'solendprotocol',
    why:'Solana lending venue, formerly Solend. Relies on third-party liquidators rather than running them.',
    surfaces:[ {kind:'site', url:'https://save.finance/', status:'verified', discovered:'2026-11-11'},
               {kind:'docs', url:'https://docs.save.finance', status:'verified', discovered:'2026-11-11'},
               {kind:'docs', url:'https://docs.save.finance/developers/liquidators', status:'verified', discovered:'2026-11-11'} ],
    senderFit:'no', evidenceGrade:'A',
    humanTask:'Not an operator. The Sender buyers here are the third-party liquidators running against Save - but its liquidator repo is archived since 2022 with one live fork, so this seam is cold. Deprioritise unless a newer liquidator surfaces.',
    note:'Caught by reading the docs after the landing page suggested otherwise. "Owner: Save Liquidator" is an account label, not a bot.' },

  // From the DefiLlama batch, 2026-11-11. The largest readable corpus in the
  // registry: 181,770 characters across site, docs, blog and a careers page.
  { name:'Loopscale', aliases:['loopscale','loopscale lending'], tier:3, rel:RELATIONSHIP.UNCLEAR,
    status:'active', segment:'defi',
    why:'Solana lending protocol with substantial first-party documentation and an engineering careers page.',
    surfaces:[ {kind:'site', url:'https://loopscale.com/', status:'verified', discovered:'2026-11-11'},
               {kind:'docs', url:'https://docs.loopscale.com/introduction/overview', status:'verified', discovered:'2026-11-11'},
               {kind:'blog', url:'https://blog.loopscale.com/home', status:'verified', discovered:'2026-11-11'},
               {kind:'careers', url:'https://careers.loopscale.com/', status:'verified', discovered:'2026-11-11'} ],
    senderFit:'unknown', evidenceGrade:'unverified',
    humanTask:'Classify from the 105k chars of docs and blog now registered. The careers page is the owner route.' },

  // From the DefiLlama batch, 2026-11-11. Its own blog carries "The Complete
  // Guide to Solana RPC Providers" - a venue writing a buyer's guide to RPC is
  // evidence of RPC interest in its own words.
  { name:'Sanctum', aliases:['sanctum','sanctum infinity','sanctum validator lsts'], tier:3,
    rel:RELATIONSHIP.UNCLEAR, status:'active', segment:'infrastructure',
    why:'Solana liquid-staking infrastructure. Publishes a guide to Solana RPC providers.',
    surfaces:[ {kind:'site', url:'https://sanctum.so/', status:'verified', discovered:'2026-11-11'},
               {kind:'blog', url:'https://sanctum.so/blog', status:'verified', discovered:'2026-11-11'},
               {kind:'docs', url:'https://learn.sanctum.so/docs', status:'verified', discovered:'2026-11-11'},
               {kind:'eng', url:'https://research.sanctum.so/', status:'verified', discovered:'2026-11-11'} ],
    senderFit:'unknown', evidenceGrade:'unverified',
    // VERIFIED 2026-11-11. The guide is real: 18,113 chars, published 12 Jan
    // 2026, reviewing six providers including Triton One, and it mentions
    // Helius by name. Recorded as EVIDENCE, not as a monitored surface - it is
    // one article, and the article-is-not-a-surface rule still holds.
    // Read it honestly: this is content marketing as much as evaluation. A
    // company publishing a buyer's guide is thinking about RPC. It is not
    // proof it is shopping.
    evidence:[{ kind:'article', date:'2026-01-12',
                url:'https://sanctum.so/blog/complete-guide-solana-rpc-providers-2026',
                title:'The Complete Guide to Solana RPC Providers in 2026',
                note:'Covers "performance tradeoffs, multi-RPC strategy, and how to orchestrate reliable infrastructure at scale". Mentions Helius.' }],
    humanTask:'Product fit scored VALIDATOR 33 as primary - correct for liquid staking, and the engine routed it without being told. The RPC guide (12 Jan 2026, mentions Helius) is a conversation opener for the RPC motion, not evidence of a gap. Ask whether they wrote it as a buyer or as a marketer.' },

  // STREAM B OPERATOR, found by the fork-graph crawler 2026-11-11.
  // dpiprotocol/dpi-keepers is forked from velocity-exchange/keeper-bots-v2 and
  // describes itself: "Keeper bots for DPI - order filling and liquidation
  // services." The GitHub profile states the chain in their own words:
  // "Trade Dubai Property Index perpetual futures on Solana."
  //
  // This is the first account in the registry that OPERATES automation rather
  // than publishing it - the buyer profile Sender is actually sold to.
  // dpi.market does not fetch, so the GitHub org is the verified surface and
  // the website is recorded as blocked rather than guessed at.
  { name:'DPI Protocol', aliases:['dpi','dpi protocol','dpiprotocol'], tier:2,
    rel:RELATIONSHIP.PROSPECT, status:'active', segment:'institutional', github:'dpiprotocol',
    repos:['dpi-keepers'], forkedAutomation:true,
    why:'Runs keeper bots for order filling and liquidation on Solana, forked from Velocity\'s reference implementation.',
    // The README is the readable surface. A GitHub HTML page renders almost no
    // text through a fetch, so scoring DPI from github.com/... found nothing
    // while the evidence sat in the README: "Keeper Bots for DPI Protocol -
    // Order Filling & Liquidation Services".
    surfaces:[ {kind:'docs', url:'https://raw.githubusercontent.com/dpiprotocol/dpi-keepers/master/README.md', status:'verified', discovered:'2026-11-11'},
               {kind:'repo', url:'https://github.com/dpiprotocol/dpi-keepers', status:'verified', discovered:'2026-11-11'},
               {kind:'company', url:'https://github.com/dpiprotocol', status:'verified', discovered:'2026-11-11'} ],
    blockedSurfaces:[ {kind:'site', url:'https://dpi.market', reason:'SOURCE_UNREACHABLE',
                       finding:'Declared on their GitHub profile but does not resolve. Not guessed at, not substituted.'} ],
    senderFit:'possible', evidenceGrade:'A',
    owners:[], 
    // OWNER SEARCH 2026-11-11: none found. CAVEAT WORTH KNOWING - a fork
    // inherits the upstream commit history, so GitHub's contributor list for
    // dpi-keepers is mostly Drift/Velocity people (wphan, lowkeynicc, Sina
    // Khalili, moosecat), not DPI's. Only commits made AFTER the fork point are
    // DPI's own, and the contributors endpoint does not distinguish them.
    humanTask:'Owner discovery found nobody at DPI. baronweyls is the top author on commits made after the fork (9), with LukasDeco and Jack Waller - but GitHub\'s contributor list is polluted by inherited upstream history, so verify by commit date, not by the contributor ranking. FIRST: confirm dpi.market is live. It does not resolve, which may mean pre-launch or dead - and after Zeta, status comes before effort.',
    note:'Found via the fork graph, not a directory. The protocol is rarely the buyer; this is the operator.' },

  // Named by Zeta as its successor: "Bullet is a new network purpose-built for
  // trading which extends many of the things that Zeta achieved."
  // Registered with NO surfaces and NO inherited evidence. Zeta's grade-A
  // execution evidence belongs to Zeta, which is gone. Bullet earns its own or
  // it stays here with nothing.
  { name:'Bullet', aliases:['bullet','bullet exchange','bullet network'], tier:null,
    rel:RELATIONSHIP.UNCLEAR, status:'active', segment:'trader',
    why:'Named successor to Zeta Markets. No first-party surface verified yet.',
    surfaces:[], blocked:'RESEARCH_BLOCKED', blockedReason:'NO_SURFACE_FOUND',
    senderFit:'unknown', evidenceGrade:'unverified',
    predecessor:'Zeta Markets',
    humanTask:'Find a Bullet-owned surface. Zeta names it but links no URL from the pages we read, and we do not guess domains. Note zetamarkets/bullet-bs58 exists on Zeta\'s GitHub org - that is a lead to the org, not a verified surface.',
    note:'Evidence does NOT transfer from Zeta. A successor is a different company until its own surfaces say otherwise.' },

  // CEASED. Verified 2026-11-11 from Zeta's OWN documentation:
  //   "Disclaimer: Zeta Markets has ceased operating as of May 2025."
  //   "Zeta Markets has since been discontinued and stopped operations.
  //    Bullet is a new network purpose-built for trading..."
  // This account was classified SENDER_CANDIDATE on grade-A evidence and
  // promoted to the project's first QUALIFY, eighteen months after it shut.
  // The notice was on docs.zeta.markets the whole time; every agent read that
  // page for execution vocabulary and none read it for whether the company
  // still exists. Evidence outlives the company.
  // Bullet is NOT given Zeta's evidence. It must earn its own.
  { name:'Zeta Markets', segment:'defi', aliases:['zeta','zeta markets'], tier:2, rel:RELATIONSHIP.PROSPECT, github:'zetamarkets',
    status:'ceased', successor:'Bullet',
    statusEvidence:{ quote:'Disclaimer: Zeta Markets has ceased operating as of May 2025.',
                     source:'https://docs.zeta.markets/', verified:'2026-11-11' },
    // The execution-relevant repos on their own org, ranked by relevance not
    // recency. READMEs are read from raw.githubusercontent.com, which is not on
    // the GitHub API rate limit.
    repos:['zeta-market-maker','sdk','zeta-abi','zeta-trade-indexer','pyth-history','fuze'],
    why:'Ships updatePriorityFee() and getRecentPrioritizationFees in its SDK; docs describe crank instructions and a Liquidator.',
    surfaces:[ {kind:'site', url:'https://www.zeta.markets/', status:'verified', discovered:'2026-11-10'},
               {kind:'docs', url:'https://docs.zeta.markets/', status:'verified', discovered:'2026-11-10'},
               // docs.zeta.markets/ is a 2,799-char navigation page. These are
               // the actual documentation: llms.txt is a whole-site summary and
               // the SDK is where any execution language would live.
               {kind:'docs', url:'https://docs.zeta.markets/llms.txt', status:'verified', discovered:'2026-11-10'},
               {kind:'docs', url:'https://docs.zeta.markets/build-with-zeta/sdks/typescript-sdk', status:'verified', discovered:'2026-11-10'} ],
    senderFit:'possible', evidenceGrade:'A',
    // OWNER SEARCH RUN 2026-11-11 against github.com/zetamarkets (declared in
    // their own docs). 39 repos; the four execution-relevant ones are fuze,
    // zeta-market-maker, zeta-abi and zeta-transaction-indexer. Five
    // contributors considered, ZERO naming an infrastructure role on their
    // profile. Zeta stays at RESEARCH - the execution evidence is settled, the
    // owner is not.
    humanTask:'Owner search found nobody. "filipzeta" contributes to zeta-market-maker and zeta-abi and is plainly a Zeta employee, but their GitHub profile carries no bio, name or company - confirm the role from a Zeta-owned surface before any approach. Note also that zeta-market-maker was last pushed in 2023, so ask whether it is still operated.',
    // WIDENED OWNER SEARCH 2026-11-11: 10 Zeta-declared surfaces read - site,
    // docs, llms.txt, the TypeScript SDK page and five repository READMEs.
    // ZERO people named with an infrastructure role, zero relevant postings.
    // Zeta declares no careers or team page at all; the only contact route it
    // publishes is an X account.
    // Every README "reads as published for others to run", which answers the
    // open question: zeta-market-maker is a reference implementation ("Maker
    // bot with ability to provide liquidity to Zeta DEX"), not evidence that
    // Zeta operates a maker. fuze is marked DEPRECATED.
    ownerSearch:{ date:'2026-11-11', org:'zetamarkets', considered:5, found:0,
                  surfacesRead:10, creditedPeople:0, postings:0,
                  repos:['zeta-market-maker','sdk','zeta-abi','zeta-trade-indexer','pyth-history','fuze'],
                  stance:'all repos read as published for others to run',
                  lead:'filipzeta (contributes to zeta-market-maker and zeta-abi; profile has no bio, name or company)' },
    note:'docs.zeta.markets/ itself is a 2,799-char nav page - the evidence is in llms.txt and the TypeScript SDK. Classified SENDER_CANDIDATE, medium confidence, on 2 unambiguous terms (crank, priority fee).' },

  // CLASSIFIED 2026-11-10 and RULED OUT for Sender. 392,908 characters of their
  // own API reference contain zero grounded Solana-execution terms: no Jito, no
  // priority fee, no blockhash, no sendTransaction, and "solana" twice. The 35
  // instances of "liquidation" are CEX margin liquidations handled internally,
  // which is what the context gate exists to catch.
  { name:'Backpack', aliases:['backpack','backpack exchange'], tier:3, rel:RELATIONSHIP.UNCLEAR, segment:'exchange',
    why:'Centralised exchange. API is orders, margin and borrow - no Solana execution surface.',
    surfaces:[ {kind:'site', url:'https://backpack.exchange/', status:'verified', discovered:'2026-11-10'},
               {kind:'docs', url:'https://docs.backpack.exchange/', status:'verified', discovered:'2026-11-10'} ],
    senderFit:'no', evidenceGrade:'A',
    humanTask:'Not a Sender account - do not re-enter it as one. If anyone wants to pursue Backpack it is an RPC/Enterprise conversation about exchange rails, and that needs separate evidence we do not have.',
    note:'Classified NOT_SENDER at high confidence: 392,908 chars read, 0 grounded Sender terms. Evidence of absence, not absence of evidence.' },

  { name:'Titan Exchange', segment:'defi', aliases:['titan','titan exchange','titandex'], tier:3, rel:RELATIONSHIP.UNCLEAR,
    // Reclassified 2026-11-05. Unblocking the surface was right; calling it a
    // PROSPECT was not. Titan ships a Swap API and a routing engine - it sells
    // execution quality. A company whose product IS transaction landing is not
    // a Sender buyer. Held as UNCLEAR rather than COMPETITOR because the
    // strongest competitive language ("Titan Prime optimizes transaction
    // landing") is NOT in the page I can fetch - it was in a research note.
    why:'Ships a Swap API and routing engine. Sells execution quality rather than buying it.',
    // Unblocked 2026-11-05. The readable surface is the GitBook, not titandex.io.
    // Fetched: 8,946 chars, Titan-owned, nav carries "Latency and Server Locations".
    surfaces:[ {kind:'docs', url:'https://titan-exchange.gitbook.io/titan/developer-doc/developers-portal/quickstart', status:'verified'} ],
    senderFit:'no', evidenceGrade:'A',
    humanTask:'Confirm from a Titan-owned page whether Titan sells transaction-landing optimisation. If it does, reclassify to COMPETITOR.',
    note:'titandex.io returns a 310-char JS shell and docs.titandex.io does not resolve; the GitBook is the live surface.' },

  { name:'Flint Labs', segment:'trader', aliases:['flint labs','flint'], tier:3, rel:RELATIONSHIP.UNCLEAR,
    // Reclassified 2026-11-05 on Flint's own words: "A multi-maker prop AMM for
    // USDC-quoted spot. Makers run their own quoting logic." Flint is the VENUE.
    // The parties who feel landing pain are the makers quoting on it. Flint
    // itself is building a DEX, not running a book that needs to land faster.
    why:'Venue, not a trading desk. Its own copy says makers run their own quoting logic - so the makers, not Flint, are the latency-sensitive party.',
    // Unblocked 2026-11-05. flint.trade fetches (1,752 chars) and the blog carries
    // dated posts (4 Nov, 5 Oct, 1 Oct 2026). docs.flint.trade does NOT resolve.
    surfaces:[ {kind:'blog', url:'https://flint.trade/blog', status:'verified'},
               {kind:'company', url:'https://flint.trade', status:'verified'} ],
    senderFit:'no', evidenceGrade:'B',
    // OWNER SEARCH 2026-11-11: six people named with infrastructure roles on
    // flint.trade itself - the only account in the registry with a named
    // owner. David Gorski, Co-Founder/CTO, prev. Jito Labs and Jump Trading,
    // is the infrastructure owner by any reading. Joshua Watts (CEO) is
    // correctly NOT counted: a CEO is not an infrastructure role.
    // This does NOT make Flint a Sender prospect - their own copy still says
    // makers run their own quoting logic - but it removes the reason the row
    // could never be worked.
    owners:[ {person:'David Gorski', role:'Co-Founder, CTO', note:'prev. Jito Labs, Jump Trading',
              source:'https://flint.trade/', verified:'named on their own site, read 2026-11-11'},
             {person:'Sina Khalili', role:'Software Engineer', note:'prev. Drift Labs',
              source:'https://flint.trade/', verified:'named on their own site, read 2026-11-11'},
             {person:'Peter Keay', role:'Software Engineer', note:'prev. Anza, Google',
              source:'https://flint.trade/', verified:'named on their own site, read 2026-11-11'} ],
    humanTask:'Owner found: David Gorski, Co-Founder/CTO (ex-Jito, ex-Jump) - named on flint.trade. Flint itself is still the VENUE, so the question for him is who the makers are, not whether Flint buys Sender. Confirm the title is current before any approach.',
    note:'Earlier NO_SURFACE_FOUND was wrong - the host is flint.trade, not flintlabs. docs.flint.trade does not resolve. The Ergonia parentage reported in research is NOT stated anywhere on flint.trade, so it is recorded as unverified, not as fact.' },

  { name:'Bags.fm', segment:'wallet', aliases:['bags','bags.fm'], tier:3, rel:RELATIONSHIP.PROSPECT,
    why:'Hiring for low-latency transaction flows.',
    surfaces:[], blocked:'RESEARCH_BLOCKED', blockedReason:'TOO_LITTLE_TEXT',
    senderFit:'unknown', evidenceGrade:'unverified',
    humanTask:'Find a readable Bags.fm surface or careers listing.',
    note:'Re-checked 2026-11-05: bags.fm returns 4 characters of text. It is a JS app with no server-rendered copy. Monitoring only, no execution evidence found.' },

  { name:'pump.fun', segment:'wallet', aliases:['pump','pump.fun','baton corporation'], tier:3, rel:RELATIONSHIP.PROSPECT,
    why:'Hiring for low-latency transaction flows.',
    surfaces:[], blocked:'RESEARCH_BLOCKED', blockedReason:'HTTP_403',
    senderFit:'unknown', evidenceGrade:'unverified',
    humanTask:'Find a readable Baton Corporation / pump.fun surface.',
    note:'pump.fun returns HTTP 403. Baton Corporation is the parent - do not conflate with the pump.fun bundler ecosystem.' }
];

/* ---- PROMOTED ACCOUNTS -------------------------------------------------
   The array above is hand-curated on purpose: every entry carries a judgement
   somebody made. The bridge cannot write into it, so promoted accounts live in
   data/registry-additions.json and are merged here at load.

   Each one arrives with BOTH FLAGS, and they mean different things:
     identity_confirmed  the name was grounded in a cited source, in code
     surface_verified    a page the company publishes has been fetched and
                         confirmed as theirs

   surface_verified false is a normal state. It lowers confidence and sets the
   next action; it never keeps an account out of the registry, because losing a
   real company for want of a docs page is the expensive mistake. Only accounts
   with at least one verified surface contribute SOURCES to a scan - there is
   nothing to read otherwise - but all of them are placed by the funnel.

   Nothing here is trusted blindly: an entry without a name, or one that
   collides with a hand-curated account, is dropped. */
const norm0 = s => String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();

export const PROMOTED = (() => {
  try {
    const added = JSON.parse(readFileSync('data/registry-additions.json', 'utf8'));
    const handNames = new Set(ICP.map(a => norm0(a.name)));
    return (added.accounts || [])
      .filter(a => a && a.name && !handNames.has(norm0(a.name)))
      .map(a => ({
        name: a.name,
        segment: a.segment || null,
        aliases: a.aliases?.length ? a.aliases : [a.name],
        tier: a.tier ?? 3,
        rel: a.rel || RELATIONSHIP.PROSPECT,
        status: a.status || 'active',
        identity_confirmed: a.identity_confirmed !== false,
        surface_verified: a.surface_verified === true,
        surfaces: (a.surfaces || []).filter(sf => sf.url && sf.status === 'verified'),
        why: a.why || 'Named on a roster and promoted on identity.',
        evidenceGrade: a.surface_verified ? 'first_party_unread' : 'unverified',
        humanTask: a.next_action || null,
        origin: 'bridge',
        note: a.note || null
      }));
  } catch { return []; }
})();

// The registry the rest of the system reads: hand-curated accounts first, then
// everything the bridge has promoted.
ICP.push(...PROMOTED);

const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();

export function lookupICP(entity) {
  const e = norm(entity);
  if (!e) return null;
  // Longest alias first, so "jito labs" wins over "jito".
  const all = ICP.flatMap(c => c.aliases.map(a => ({ c, a: norm(a) })))
                 .sort((x, y) => y.a.length - x.a.length);
  const hit = all.find(({ a }) => e === a || e.startsWith(a + ' ') || e.endsWith(' ' + a) || e.includes(' ' + a + ' '));
  return hit ? hit.c : null;
}

export function isProspectable(rel) {
  return rel === RELATIONSHIP.PROSPECT || rel === RELATIONSHIP.UNCLEAR;
}

/* Sender-intent vocabulary. CODE scores product fit from this, so a model
   cannot inflate the tier by choosing a flattering word. */
export const SENDER_TERMS = ['transaction landing','landing rate','sendtransaction','priority fee','priority fees',
  'jito','bundle','bundles','tip account','staked connection','swqos','transaction submission',
  'failed transaction','failed transactions','dropped transaction','transaction drops','keeper bot','keeper bots'];
export const LATENCY_TERMS = ['latency','low-latency','low latency','execution speed','slippage','market making',
  'market maker','arbitrage','liquidation','liquidations','high frequency','hft','fill rate','jit maker'];
export const STREAM_TERMS = ['laserstream','shreds','geyser','yellowstone','grpc stream','websocket stream','account updates'];
export const GENERIC_TERMS = ['rpc','webhook','webhooks','node','endpoint','api'];

export function productFitPoints(text) {
  const t = String(text||'').toLowerCase();
  const hit = terms => terms.filter(x => t.includes(x));
  const sender = hit(SENDER_TERMS), latency = hit(LATENCY_TERMS),
        stream = hit(STREAM_TERMS), generic = hit(GENERIC_TERMS);
  if (sender.length)  return { points:15, basis:'sender-specific language', matched:sender.slice(0,4) };
  if (latency.length) return { points:12, basis:'latency-sensitive execution', matched:latency.slice(0,4) };
  if (stream.length)  return { points:8,  basis:'streaming / state visibility', matched:stream.slice(0,4) };
  if (generic.length) return { points:3,  basis:'generic infrastructure mention', matched:generic.slice(0,4) };
  return { points:0, basis:'no product-relevant evidence', matched:[] };
}


/* Surface status for the registry badge: what a BD person may trust. */
export function surfaceReport(account) {
  return {
    verified: (account.surfaces || []).filter(s => s.status === 'verified').map(s => s.kind),
    blocked:  (account.blockedSurfaces || []).map(s => `${s.kind} -> ${s.resolvedTo || s.reason}`),
    status:   account.blocked || 'ACTIVE',
    reason:   account.blockedReason || null,
    humanTask: account.humanTask || null
  };
}
