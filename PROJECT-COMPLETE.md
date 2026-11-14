# Helius BD Tracker — the complete project in one file

**NEAR Hackathon 2026 · submitted 14 Nov 2026 · all inference on NEAR AI Cloud**

This single file is written to be handed to another AI or another engineer with no other
context. It contains the problem, the architecture, every rule that governs the system,
the real measured results, the mistakes that shaped the design, and how to run it.

Everything stated here is true of the code as committed. Where a number comes from a run,
the run is named. Where something does not work yet, it says so.

---

## 1. What it is, in one paragraph

A business-development lead scanner for **Helius**, a Solana infrastructure provider. It
reads public web sources, finds companies Helius could sell to, and produces a worklist a
human acts on. It never sends outreach, never infers that a company intends to buy, and
never invents a company, a URL, a quote, a date or a contact. **An empty run is a valid
result; a fabricated one is not.** Five of its agents run on NEAR AI Cloud; the scorer,
the gate and the skeptic's veto are deliberately plain code, because a model must never
produce a number that decides anything.

## 2. The problem it refuses to have

Every BD tool does the same three steps: find an announcement, assume the announcement
means someone needs your product, hand a salesperson a "lead". That middle inference is
usually wrong and is never shown to the user.

This system separates the three things that tool collapses:

| Question | Answered by | Can it authorise an approach? |
|---|---|---|
| Does this company exist, and is it a company? | `identity_confirmed`, set in code | No |
| Do we publish-verify a page they own? | `surface_verified`, a confidence flag | No |
| Is there evidence they have this problem? | the dated scan, with a grounded quote | Yes, as a *conversation* |
| Do they intend to buy? | **nothing. The system never answers this.** | — |

## 3. Architecture

```
ROSTERS (pages that list firms)
   │   discover.js  ── no date gate, grounded quotes, 12 names per window
   ▼
DISCOVERY CANDIDATES          158 found, 149 new to the registry, $0.026
   │   bridge.js   ── domain from a CITED source, surfaces fetched + verified
   ▼
REGISTRY ACCOUNTS             88 accounts (29 hand-curated + 59 promoted)
   │   scan.js / batches.js  ── 14-day windows, 179 surfaces, 8 agents
   ▼
EVIDENCE (dated + standing)   every row carries a verbatim grounded quote
   │   funnel.js   ── 4 states, mandatory counter-rationale
   ▼
WORKLIST                      25 opportunities · 20 research · 33 monitor · 20 disqualified
   │   outreach.js ── packet a HUMAN approves; no recipient ever invented
   ▼
HUMAN sends it from their own mail client. There is no mail server in this project.
```

### The eight agents

| # | Agent | Runs on | Job |
|---|---|---|---|
| 1 | Collector | NEAR AI Cloud | Reads a page, extracts dated events with verbatim quotes |
| 2 | Verifier | NEAR AI Cloud | Judges whether a quote supports the claim made from it |
| 3 | Monitor | NEAR AI Cloud | Detects dated changes on a known account's own surfaces |
| 4 | Discovery | NEAR AI Cloud | Judges whether an entity is a plausible buyer |
| 5 | Enricher | NEAR AI Cloud | Answers six factual questions about a verified event |
| 6 | Writer | NEAR AI Cloud | Writes the internal brief for a qualified row |
| 7 | Discoverer | NEAR AI Cloud | Reads a roster for company **names**, no date gate |
| — | **Scorer** | **code** | Arithmetic. A model never scores. |
| — | **Gate** | **code** | Applies caps and disqualifiers |
| — | **Skeptic's veto** | **code** | A counter-rationale can overturn a verdict |

## 4. The rules that make it trustworthy

These are not aspirations; each is enforced in code and covered by tests.

1. **Grounding.** The model returns a verbatim span. Code then searches the page *we*
   fetched for that span. A quote the model invented is not in the page, so it cannot
   pass. (`quoteIsGrounded`)
2. **Code does arithmetic, the model never scores.** Rubrics clamp with `Math.min`.
3. **Never construct a URL.** Only URLs actually fetched, or supplied by a cited source,
   are ever used. The first draft of `sources.js` guessed six blog URLs and four were 404s.
4. **Mandatory counter-rationale** on every row — the stated reason it might *not*
   qualify — and it can veto the verdict.
5. **Every rejection carries a reason code.** Nothing is dropped silently.
6. **Status gate.** A company that has ceased scores zero regardless of evidence, and the
   cessation phrase must have the account as its **subject**.
7. **The seller and its rivals are not prospects.** Helius itself, and competitors like
   Syndica, Chainstack, Blockdaemon, QuickNode, are excluded before any prospect gate.
8. **Existing customers and partners are excluded** — the full 36-name logo wall.
9. **Sharded reading.** Pages are read in overlapping windows (9,000 chars, 600 overlap)
   so nothing is silently truncated.
10. **Undated first-party docs** are "standing conditions": dated by fetch, marked
    `date_basis: observed_on_fetch`, and capped at Research. They can create an
    opportunity; they can never claim a recent trigger.
11. **The system never sends anything.** Outreach is a packet a human approves.
12. **No recipient is ever invented.** No guessed `name@company.com`, ever.

## 5. The two-flag rule (the most important design decision)

"Verified account" was doing two different jobs at once: confirming a company is real, and
confirming we had read its own pages. Requiring both to enter the pipeline meant real
companies named by credible sources — HumidiFi, Gemini, Robinhood, BisonFi — were blocked
before a human had looked at them. Discovery became a dead end.

```
identity_confirmed   SET BY CODE, with evidence. The name is a real company: not a
                     token, a chain, a product or a generic phrase, and it appears in a
                     credible cited source with a quote grounded against that source.

surface_verified     A CONFIDENCE FLAG. A page the company publishes has been fetched
                     AND it names the company. False is a normal state: it lowers
                     confidence and sets the next action. It never hides an account.
```

**Opportunity = identity confirmed + plausible buyer segment + one grounded product-fit
signal + no disqualifier.** It does *not* require `surface_verified`.

What that flag still gates: **outreach**. You cannot write to a company about its
infrastructure having read only somebody else's directory entry.

## 6. What Helius actually sells (the seller's own facts)

Sixteen products, scored individually. Revenue is concentrated — from the published price
list, not from a disclosed figure:

| Rank | Product | Price | Buyer |
|---|---|---|---|
| 1 | Enterprise contracts | custom, 1B+ credits, 4h SLA | exchanges, wallets, trading desks |
| 2 | Dedicated RPC nodes | from **$2,900/mo per node** | HFT, bots (often several each) |
| 3 | LaserStream gRPC + data | **$400–6,000/mo** on top of a plan | heavy streaming users |
| 4 | Shreds / Preconfs / Sender Max | **$800–1,000/mo per IP** | latency-sensitive traders |
| 5 | Professional / Business plans | $999 / $499 per month | growing startups |
| 6 | Validator-as-a-Service | B2B, not listed | custodians, ETF issuers, DATs |
| 7 | Developer plan | $49/mo + overages | the funnel into paid tiers |
| 8 | Metered APIs (webhooks, DAS, …) | 0.1–10 credits/call | never sold alone |
| 9 | SOL staking (14M+ SOL) | 0% commission | the moat, not the fee |
| 10 | Free / ecosystem / Privacy Rings | free | acquisition |

So a lead that fits ranks 1–4 is worth far more than one that fits 7–8, and the collector
hunts them first. `REVENUE_RANK` and `topRevenueProduct()` encode this.

## 7. Measured results

All figures from runs on disk. Total spend across **71 priced artefacts: $4.36** of the
$10 free NEAR AI credit.

### Discovery (one pass, 9 rosters)
```
158 companies, 149 new to the registry      $0.0259, 45 model calls
trading 28 · institutional 15 · builder 51 · infra 47 · data 3 · unclear 14
```
The registry held **33 distinct companies** before this pass. New top-tier names include
HumidiFi (the leading prop AMM), Fogo, Openbook, Mango Markets, BisonFi, Manifest Trade,
Astralane, Bulk, Hxro, and institutionally Gemini, Robinhood, BitMEX, Bitfinex, Bullish,
Sygnum Bank, Maple Finance, Anchorage Digital, Metaplanet.

### Bridge (discovery → registry)
```
60 considered · 59 promoted · 39 surface-verified · 135 surfaces verified
1 held: Flash Trade (a third-party report says it ceased — held for a human, not dropped)
69 third-party links rejected as "not a surface this company publishes"
```

### The 90-day sweep, and what it proved about the sources
Seven 14-day batches. Dated rows per batch, newest first: **21, 6, 1, 1, 1, 1, 0**.

That is not the window logic failing. The registry's surfaces are **index pages** — a blog
front page, a status page, a changelog — and an index page shows the present.
`DATE_OUT_OF_WINDOW` climbs from 44 in batch 1 to ~90 in every later batch: the pages keep
offering the same recent dates and the window keeps refusing them. Real history needs
*paginated or archived* sources, not more windows.

### A cost fix, measured rather than assumed
The sweep collected **130 standing conditions for 22 distinct facts** — half its cost. A
standing condition is by definition a fact from a page with no date, so that page can never
yield a dated row in any window. Surfaces like that now retire after the batch that first
reads them, but only if they produced **no dated row**.

| | before | after |
|---|---|---|
| dated rows | 31 | **35** |
| standing rows | 130 | **70** |
| accounts with a dated event | 11 | **14** |
| cost | $0.5924 | **$0.3840 (−35%)** |

Compared name by name: **no dated entity lost**, three gained. A cost fix that quietly
dropped evidence would have been worse than the waste it removed.

### Current worklist
```
25 opportunities · 20 research tasks · 33 to monitor · 20 disqualified
```

## 8. Mistakes that shaped the design

The full record is `PITFALLS.md` (89 entries). The ones that changed the architecture:

- **Zeta Markets was promoted to Qualify 18 months after it ceased operating.** The
  disclaimer was on a page fetched a dozen times; every agent read it for execution
  vocabulary and none read it for whether the company existed. → `status.js`. Then it
  excluded Coinbase, because Coinbase's status page says "the Blast network is shut down"
  → the cessation phrase must have the account as its **subject**.
- **89% of Kraken's status page was being silently discarded** (128,512 chars → one
  14,000-char slice, cap of four candidates). → sharded overlapping windows.
- **Twelve existing Helius customers were in the prospect list**, three in the opportunity
  band (Coinbase, Backpack, Loopscale). → the full logo-wall gate.
- **The research claimed Drift owned a docs page.** Fetching it showed "Keeper Bots |
  Velocity Protocol" — Velocity ×11, Drift ×1 ("Migrate from Drift"). The quote was absent
  entirely. The account was never Drift. → verify the surface resolves to the company named.
- **A prompt that named a buyer type invited the buyer's assets.** Adding "memecoin
  snipers" to the hunt order returned Fwog, Gigachad, Goatseus Maximus and OFFICIAL TRUMP,
  scraped off Kraken's asset list. → test the *quote*, not the name: an asset row always
  puts a ticker straight after the name.
- **"Amazon Web Services (AWS)" was rejected as a memecoin.** A ticker is a new string; an
  acronym is built from the initials in front of it. Every looser rule let `Goatseus
  Maximus (GOAT)` back in, so strict initials shipped with the limit documented.
- **A clean zero that was a bug.** `shardText()` returns `{i, of, from, to, text}`; passing
  the object where the prompt wanted the string sent `[object Object]` to every call. The
  model correctly reported no companies and the pass printed `0 candidates, 0 rejected`
  with no error — indistinguishable from an honest empty run.
- **Helius was an account on its own worklist**, printed as "Already a Helius customer →
  route to account management". Wrong twice.
- **"Latest" meant the last file written, and a sweep walks backwards**, so the UI showed
  three-month-old evidence as the live run with the correct window printed beside it.
- **Targeted collectors were tested and rejected**: 74% more cost, 9% *fewer* distinct
  companies. Kept behind `--deep` rather than deleted, with the negative result recorded.
- **`/send/` matches "Sender"** — a substring bug that has now bitten three separate tests
  in this project.

## 9. Why NEAR, specifically

NEAR is not a payment sticker here — it is where the intelligence runs.

- **Every model call goes to NEAR AI Cloud** (`https://cloud-api.near.ai/v1`, model
  `google/gemini-2.5-flash-lite`). There is **no fallback provider**: if the key is absent
  the run aborts rather than inventing results.
- Prices are fetched from `/models` at run time, so the ledger is real rather than assumed.
- NEAR AI Cloud is **TEE-verifiable inference**, and a pipeline doing commercial research
  on named companies is exactly the case for attestable private inference: the research is
  commercially sensitive, and we can prove where it ran.
- A verified finding: **no NEAR-hosted model offers server-side web search** (checked, 63
  models, 0 with the capability). So fetching is done locally and the model only ever reads
  text we supply — which is also what makes the grounding check possible.

## 10. How to run it

```bash
# NEAR AI key in .env (chmod 600, gitignored). No key, no run — by design.
echo 'NEAR_AI_API_KEY=...' > .env && chmod 600 .env

node discover.js                              # rosters -> candidate names
node bridge.js --limit 60                     # candidates -> registry accounts
node scan.js --from 2026-10-29 --to 2026-11-12 --budget 2
node batches.js --batches 7 --days 14 --budget 1
node funnel.js                                # evidence -> worklist
node server.js                                # the interface, on :8742
node pipeline/selftest.js                     # 566 assertions
```

Every command is dependency-free Node (including the XLSX writer: zip + CRC32 + inline
strings). `npm install` is not required.

## 11. What does not work yet, stated plainly

- **`outreach_ready` is 0 by design right now.** All 25 opportunities are blocked on *"No
  verified contact"*, because no named infrastructure owner has been verified at any cold
  account except Flint Labs (David Gorski, CTO, ex-Jito/Jump). The system will not guess
  an address, so the blocker is the correct output.
- **Source-depth discovery is not built.** The sweep proved the registry reads index pages,
  not archives. Finding `/blog/page/2`, `/changelog/archive`, GitHub releases and commit
  history is the next build and the single highest-value one.
- **The bridge resolves a domain for about 65% of candidates.** The rest are promoted with
  `surface_verified: false` and "find the official surface" as the next action.
- **The escrow IS deployed and exercised on NEAR testnet** —
  `helius-escrow-81631.testnet`. Buyer funded, worker delivered a paraphrase, worker's
  attempt to settle in its own favour was reverted, arbiter refunded. Transactions in
  `docs/TESTNET_RUN.md`.
- **NEAR Intents 1Click settlement is still priced, not wired.** Settlement above is in
  testnet NEAR; the cross-chain 1Click route is costed and never settled on. This is why
  the DeFi track is not claimed.
- **`dpi.market` does not resolve**; DPI Protocol is carried on other evidence.

## 12. File map

| File | What it holds |
|---|---|
| `pipeline/agents.js` | All agent prompts, including the revenue-ranked hunt order |
| `pipeline/helius.js` | The seller's own facts: 21 customers, 36-name logo wall, prices, `REVENUE_RANK`, competitors |
| `pipeline/products.js` | 16 products, each with inherent + contextual term lists |
| `pipeline/discover.js` | The discovery pass (rosters → names, no date gate) |
| `pipeline/bridge.js` | Discovery → registry. Cited domains, ownership checks, two flags |
| `pipeline/funnel.js` | Four states, 8 segments, the opportunity rule |
| `pipeline/outreach.js` | The human handoff. Blockers, drafts, never sends |
| `pipeline/status.js` | active / ceased / acquired / succeeded, with the subject test |
| `pipeline/score.js` | Rubrics, caps, `sanitiseGate` — all arithmetic, no model |
| `pipeline/verify.js` | Grounding and every rejection reason |
| `pipeline/fetch.js` | Fetching, whitelist, `shardText` overlapping windows |
| `pipeline/sources.js` | The source plan, registry-derived |
| `pipeline/selftest.js` | 566 assertions, no test framework |
| `PITFALLS.md` | 89 recorded mistakes and what each one changed |
| `HELIUS-BD-FOR-DUMMIES.md` | The long-form plain-English guide |
| `JUDGE-SCORECARD.md` | Self-assessment against the judging criteria |

---

*Written 14 Nov 2026. Every number above comes from a run on disk; nothing is projected.*
