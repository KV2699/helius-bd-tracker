// The HX prompt pack. HX-GA2 also runs as a real agent (pipeline/operators.js).
export const PROMPTS = [
{ id:'HX-G1', tool:'Grok / web', when:'Every Thursday', freq:'Weekly',
  job:'Find new automation operators, RPC migrations and public infrastructure complaints on Solana (last 7 days)',
  text:`Search X/Twitter and the open web for the LAST 7 DAYS ONLY. Find posts or announcements about:
(1) New keeper bot, liquidator, JIT maker or order-trigger operators launching on Solana - including solo operators and small teams
(2) Solana protocols migrating RPC provider, or announcing self-hosted node infrastructure
(3) Public complaints about Solana RPC latency, websocket subscription limits, getProgramAccounts limits, dropped or failed transaction sends
(4) Funding rounds at Solana trading firms, market makers or bot operators
(5) New perp DEX, order book or automated market infrastructure launching on Solana

Return per signal: Organisation | Signal type | Date | Source URL | One sentence
Exclude: [paste last week's organisation names]
Do NOT invent. If a signal has no date or no URL, do not return it.
If no verified signal: return nothing.`,
  notes:'Paste last week’s org names into the exclusion field. Verify every output with HX-P1 before entry.' },

{ id:'HX-G2', tool:'Grok / web', when:'Every Thursday, after HX-G1', freq:'Weekly',
  job:'Incidents and post-mortems, last 30 days only. Enforces the wrong-chain rule.',
  text:`Search the LAST 30 DAYS ONLY for Solana infrastructure incidents and post-mortems.
A protocol complaining about RPC latency is a high-intent signal that goes stale fast -
do not widen this window to find more volume, because older incidents are already handled.
(1) Status-page incidents at exchanges, venues or protocols that name SOLANA specifically - not another chain
(2) Published post-mortems citing congestion, failed transaction landing, stalled liquidations, or bad debt from unprocessed transactions
(3) Protocol forum or governance posts about keeper bot failures or RPC cost
(4) Any protocol publicly naming its RPC provider - in either direction

For each: Organisation | Chain affected | Signal type | Date | Source URL | Quote
CRITICAL: if the incident is on a chain OTHER than Solana, mark it [WRONG CHAIN - do not enter].
An outage on another chain is not a Solana signal, however latency-sensitive the organisation is.
Exclude: [paste last week's organisation names]`,
  notes:'The wrong-chain rule exists because a Coinbase outage on Sonic Network was briefly routed as a Solana task.' },

{ id:'HX-P1', tool:'Perplexity', when:'Immediately after HX-G1 and HX-G2', freq:'Weekly',
  job:'Verify source, date, surface ownership and contact before anything enters the tracker',
  text:`For each signal below [paste HX-G1 + HX-G2 output], return:
(1) The ORIGINAL first-party source URL and exact publication date - the organisation's own blog, docs, status page, repo or careers page. Not secondary coverage, not an aggregator.
(2) Confirm the URL resolves to the organisation named. If it redirects to a DIFFERENT company, flag [SURFACE MISMATCH - do not enter] and name the company it actually resolves to.
(3) The verbatim quote from that page supporting the signal, 25-200 characters.
(4) Full name and current job title of the most senior infrastructure or engineering contact - cite source URL and date.
(5) Confirm the signal is still live.

Return ONLY results with a first-party URL and a date.
Flag anything else [UNVERIFIED - do not enter pipeline].`,
  notes:'Step (2) is the Drift/Velocity rule. docs.drift.trade serves Velocity Protocol documentation.' },

{ id:'HX-GA1', tool:'Gemini / Perplexity', when:'On new prospect entry, or from the Tab 3 queue', freq:'On demand',
  job:'Organisation deep scan - automation, hosting posture, documented pain, named contacts',
  text:`Research [ORGANISATION] as a potential Helius customer. Return:
(1) Does it run automated on-chain transaction submission? Name the bots - liquidator, JIT maker, order trigger, matching engine, arbitrage. Cite the organisation's own docs or repo.
(2) Does it self-host RPC nodes, use a managed provider, or is this unknown? Name the provider if stated first-party. Mark UNKNOWN rather than guessing.
(3) Any first-party documented limit or complaint: getProgramAccounts, websocket subscriptions, RPC latency, failed sends, rate limits.
(4) Named contacts with source URL + date: Head of Infrastructure / Infrastructure Engineer; CTO or Head of Engineering; whoever owns infrastructure spend.
(5) Helius surfaces touched: RPC, websockets, getProgramAccounts, indexing, webhooks, priority/staked sends, archival. Count them.
(6) Timing triggers: funding, mainnet launch, migration, live incident - dated.
(7) Is this organisation a COMPETITOR (sells RPC, routing or execution)? If it sells transaction landing, say so plainly - it is not a prospect.

Mark every unverifiable field UNVERIFIED. Do not infer a contact from a company name. Do not guess hosting posture.`,
  notes:'Fills the Identifiability dimension: 8 to 20 points. Highest-leverage single action per Tab 3.' },

{ id:'HX-GA2 v2', tool:'Agent (pipeline/forks.js) - GitHub API', when:'Weekly; or on any protocol publishing automation it does not run', freq:'Weekly',
  job:'OPERATOR DISCOVERY VIA THE FORK GRAPH. v1 read protocol docs and found nothing, because docs describe what the bots DO, never who runs them.',
  text:`[PROTOCOL] publishes keeper bots, liquidators or JIT makers. Find the THIRD-PARTY OPERATORS.

DO NOT read the protocol's docs. Read the code.

(1) Locate the reference implementation for [PROTOCOL]'s keeper bots. Include ARCHIVED repos - a protocol mid-migration archives its old automation, and that is exactly where the forks are.
(2) Pull the FORK GRAPH. List every repository forked from it.
(3) Keep only forks PUSHED in the last 18 months. A fork nobody has touched in two years is a bookmark, not an operator.
(4) For each live fork: the owner's GitHub profile - company, site, X handle, bio - and the top COMMIT AUTHORS on the fork.
(5) Resolve the company NAME to a company SITE by looking it up as a GitHub org through the API. Never guess a domain from a company name.
(6) Fetch that site and classify: does it SELL transaction submission or RPC? Then it is a COMPETITOR, not a prospect.
(7) Check the protocol's Discord or governance forum for operator or liquidator role announcements.

Return: Operator | GitHub handle | Affiliated org | Type | Evidence URL (fork, profile or commit) | Last push | Classification

Classifications: CANDIDATE (named org, own site fetches, sells nothing we sell) | COMPETITOR | NOT_A_BUYER (institution, or a profile that reads as somebody learning the codebase) | THIN_SURFACE | UNVERIFIABLE.
If a lookup could not run - rate limit, dead site - say UNVERIFIABLE and say why. A missing lookup is not a finding.
If no third-party operator can be verified from code: "ZERO OPERATORS FOUND IN CODE. Map remains empty."`,
  notes:'Runs as code against the GitHub API - no model touches discovery. 60 req/hr unauthenticated; set GITHUB_TOKEN for 5,000. node forks.js, or --from <saved run> to re-classify without re-spending the budget.' },

{ id:'HX-G3', tool:'Grok / X search', when:'Every Thursday, with G1 and G2', freq:'Weekly',
  job:'DISPLACEMENT - protocols already running bots and unhappy with their current provider. The ones we were never looking for.',
  text:`Search X/Twitter and Solana developer forums for the LAST 30 DAYS ONLY.
Find developers or protocols explicitly complaining about their current infrastructure provider
(Helius, QuickNode, Triton, Alchemy, or self-hosted).

Search for phrases like:
- "QuickNode rate limits"
- "Triton RPC latency"
- "getProgramAccounts timing out"
- "Solana RPC dropping transactions"
- "switching RPC provider"
- "our keeper bot is missing fills"

Return per signal: Organisation | Complaint summary | Current provider (if named) | Date | Source URL | One sentence

Do NOT return generic Solana congestion tweets - a chain-wide complaint names no buyer.
Only return complaints from a named builder, protocol or bot operator.
If the complaint names HELIUS as the current provider, flag it [EXISTING ACCOUNT - route to support and account management, NOT to cold outreach].`,
  notes:'The gap this fills: we were only looking for NEW bot launches. A protocol already running bots and publicly unhappy is a warmer buyer than one that launched yesterday.' },

{ id:'HX-CG1', tool:'ChatGPT / Claude', when:'After research is complete', freq:'On demand',
  job:'Score the prospect against the Tab 7 rubric and return a completed score card',
  text:`Score the following Helius prospect. Return a completed score card with the points awarded per dimension AND a one-line justification for each.

HELIUS RUBRIC (100 points):
- Automation Dependency (0-25): first-party documented keeper bots/liquidators/JIT makers = 25. Automated submission documented, roles unnamed = 18. Perp or order-book venue, automation implied = 15. Aggregator/router = 8. No evidence = 0-5
- Infrastructure Pain (0-25): first-party documented limit or complaint (getProgramAccounts, websockets, RPC latency, failed sends) = 25. First-party dated Solana incident = 18-22. Third-party congestion report = 12. Claims strength, no gap = 5. Incident on another chain = 0
- Identifiability & Contact (0-20): named org + VERIFIED contact with URL = 20. Named org, unverified contact = 12. Named org, no contact = 8. Generic entity (a chain, a sector, an ecosystem) = 0 AND CAP THE ROW AT MONITOR
- Ecosystem Surface Overlap (0-15): count of RPC, websockets, gPA, indexing, webhooks, priority sends, archival. 5+=15, 4=12, 3=10, 2=8, 1=4
- Timing Window (0-15): live incident or migration = 15. Dated event <30 days = 12. 30-90 days = 8. Standing condition, no date = 4. No trigger = 0-2

Bands: Critical 75-100 | High 50-74 | Monitor 25-49 | Under 25 = do not enter

RULES YOU MUST APPLY:
- A more identifiable organisation must never score LOWER than a less identifiable one on comparable evidence.
- If the organisation already has a Helius relationship, flag EXPANSION and require the Next Action to be expansion or displacement, never cold outreach.
- If the organisation sells RPC, routing or transaction landing, return COMPETITOR and stop scoring.
- Do not award Infrastructure Pain points for an incident on a non-Solana chain.

PROSPECT DATA: [paste HX-GA1 / HX-GA2 output]`,
  notes:'The tracker computes this in code (tracker/rubric.js). Use the prompt only for prospects researched outside the pipeline.' },

{ id:'HX-C1', tool:'Claude', when:'Final step before adding a row', freq:'On demand',
  job:'Write the Tab 2 row in exactly the tracker column order',
  text:`Using the scored prospect below, write the pipeline row. One field per line, this exact order:

Organisation | Score | Band | Stream (A Protocol / B Keeper-bot operator / C Trading firm / D Indexer / E Wallet / F Displacement / X Expansion) | Sector | Multi-Surface (YES/NO) | Surfaces Overlap | Entry Signal (max 3 sentences, must include the verbatim quote, the first-party source URL and the date) | Signal Type | Signal Date (DD/MM/YYYY) | Contact (append VERIFIED + URL + date, or UNVERIFIED + which prompt verifies it) | Entry Point | Next Action (specific, timed, names who to contact and what to say) | Verification Method | Data Status | Days Remaining | Last Verified

If any field cannot be filled from the source material, write UNVERIFIED and name the prompt that fills it.
Do not invent a contact name, a date or a URL.
If the signal has no date, mark it a STANDING CONDITION, date it by the fetch, and cap the row at Monitor.
If the row routes away from Sender, append "(not Sender - <motion>)" to the Stream cell.`,
  notes:'Output is copy-paste ready for Tab 2.' }
];
