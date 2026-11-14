# Helius BD Tracker — the whole thing, explained plainly

**Interface:** `index.html` — one file, no build step. Run `npm run serve`, open `http://localhost:8742`.
**Pipeline:** `pipeline/` — eight agents, real HTTP, real inference on NEAR AI Cloud.
**Also read:** [SELLER-PROFILE.md](SELLER-PROFILE.md) (the ICP) · [PITFALLS.md](PITFALLS.md) (what broke and why)

---

## 1. What problem this solves

Every BD tool does the same three things. It finds a company announcement. It decides
the announcement means someone needs your product. It hands a salesperson a "hot lead".

That middle step is a guess, it is usually wrong, and it is never shown to you.

This tool refuses to make it. It reads public sources, verifies every claim against the
page it actually fetched, scores in plain code, and then **tells you what it could not
establish.** When nothing qualifies, it says so instead of inventing something.

**Who it sells for:** Helius, a Solana infrastructure provider.
**What it sells:** Sender — low-latency Solana transaction landing.
**Who it sells to:** infrastructure and trading-systems owners at Solana-native trading
firms, market makers and exchanges.

---

## 2. It is two separate things

| | What it is | Where it runs |
|---|---|---|
| **The pipeline** | Eight agents, real fetches, real inference | Node, on your machine |
| **The interface** | The queue, the office, the brief | `index.html`, works with or without the pipeline |

The interface **cannot** be the scanner. Its content-security policy blocks every
outbound request, so it could not fetch a source or reach NEAR if it wanted to. Opened
on its own it says so and labels its data **demo dataset**. That is not a limitation
worked around — it is the honest state, displayed.

### Running it

```bash
npm run serve                        # then press "Run scan" in the browser
node scan.js --days 90 --budget 2    # or from the CLI
node monitor.js                      # the account monitor
node pipeline/selftest.js            # 447 assertions, no key, no cost
node scan.js --collectors all --deep # targeted passes, for qualifying a held account
npm run batches                      # rolling 14-day batches, newest first
npm run funnel                       # THE WORKLIST - every account placed, nothing dropped
npm run batch                        # seeds -> surfaces -> status -> product read
npm run status                       # is the company still trading? run this first
npm run products                     # score every account across all 7 Helius motions
node people.js "Flint Labs"          # who owns execution, from declared surfaces
node owners.js "Zeta Markets"        # the same question, via the GitHub org
node classify.js Backpack "Zeta Markets"   # settle an account's product motion
node seeds.js Zeta Backpack          # give an account with NO surface a first one
npm run rescore                      # re-apply current scoring to a saved run, free
node surfaces.js                     # find pages an account links to but we were not reading
node forks.js                        # HX-GA2 v2: operators via the GitHub fork graph
node forks.js --from <saved run>     # re-classify without re-spending the GitHub budget
npm run tracker                      # build the BD tracker workbook (.xlsx)
```

**Without an API key the run aborts.** There is no fallback model, because a model
answering from memory and calling it a scan result is fabrication.

---

## 3. The eight agents

**Five call a model. Three are deliberately plain code, because a model must never
produce a number — and a veto a model could talk itself out of is not a veto.**

| | Agent | Runs on | Job |
|---|---|---|---|
| 1 | Collector | NEAR AI | pulls dated events off a registry-owned page, each with a verbatim quote |
| 2 | Crawler | NEAR AI | HX-GA2 — finds the operators a protocol documents but does not run |
| 3 | Verifier | **code** + NEAR AI | grounding in code; claim-support by model |
| 4 | Skeptic | NEAR AI + **code** | states why the lead might NOT qualify; the veto is applied in code |
| 5 | Enricher | NEAR AI | fills the gate fields, each needing a supporting span |
| 6 | Scorer | **code** | the rubric |
| 7 | Gate | **code** | the caps and the routing layer |
| 8 | Writer | NEAR AI | the internal brief — **never** outreach |

The Skeptic and the Crawler were always in the code — the counter-rationale veto and
`pipeline/operators.js`. They were not on the floor, which meant the one stage that can
kill a lead was the one stage a demo never showed. Both now have a desk and sit on the
document's route.

### The one line that carries the integrity

```js
if (!quoteIsGrounded(c.quote, pageText)) return fail('QUOTE_NOT_IN_SOURCE');
```

The model must return a verbatim span. Code then searches for that span in the page
**we fetched ourselves**. An invented quote is not in the page, so it cannot pass.

Two more in the same spirit: the rubric **clamps** every field to its maximum, so a
model returning `txVolume: 9999` gets 25; and a gate field returned `true` with no
supporting span is **downgraded to false**.

### Nothing is dropped silently

Every rejection carries a reason code, and all of them are visible in the run log:

`NO_SOURCE_URL` · `SOURCE_NOT_WHITELISTED` · `SOURCE_UNREACHABLE` · `QUOTE_NOT_IN_SOURCE` ·
`DATE_OUT_OF_WINDOW` · `DATE_UNVERIFIABLE` · `NO_NAMED_ENTITY` · `BLOCKED_ALIAS` ·
`NOT_SOLANA` · `DUPLICATE` · `MODEL_RETURNED_NOTHING` · `INFERENCE_FAILED` ·
`CLAIM_NOT_SUPPORTED` · `OUTPUT_TRUNCATED` · `REDIRECTED_OFF_WHITELIST` ·
`DOCS_SURFACE_MISMATCH` · `RESEARCH_BLOCKED`

**An empty run is a valid result. A fabricated one is not.**

---

## 4. Where the sources come from

The run is **account-led**. `sourcePlan()` builds the Collector's reading list from the
registry's own **verified** surfaces — never a hand-kept link list — and ranks them by
how much a verdict is allowed to rest on them.

| Class | What it is | Highest verdict it can produce |
|---|---|---|
| `buyer_owned` | a registry account's own blog, careers, status or IR page | **Actionable** |
| `technical_ecosystem` | docs, repos, official protocol pages | **Actionable** |
| `market_context` | DefiLlama, trade press | **Research** |
| `directory` | anything unrecognised | **Research** |

A volume dashboard can **start** research. It can never **end** it. Context pages are
read last and capped at three, so the budget goes on what the buyer says about itself.

### How the page is actually read: small windows, not one slice

The collector used to take a 14,000-character slice of each page and return at most four
candidates. On `status.kraken.com` — 128,512 characters of dated incidents — that threw
away **89% of the page** and produced **one row**, and the run log made it look like a
quiet page rather than a truncated read.

It now reads the whole page in **overlapping windows**: 16 windows of 9,000 characters with
a 600-character overlap covers Kraken exactly, and each window gets its own candidate
budget. A smaller batch is an easier read — the model stops having to pick "the strongest
four" out of forty. The overlap exists so an event whose date sits in one window and whose
quote sits in the next is not lost at the seam, and duplicates are removed in code.

Grounding is unchanged and still runs against the **whole** page, never the window.

| | Before | After |
|---|---|---|
| Sources | 17 | **25** |
| Verified rows | 14 | **81** |
| Rows above No-action | 3 | **7** |
| Non-Solana routing errors | 5 | **0** |
| Cost per run | $0.0197 | $0.1453 |

### Settling what an account actually is

Collecting more evidence about an account you have not classified is the expensive way to
stay confused. `classify.js` settles the question from evidence already on the account's
own pages, and the split is deliberate:

**Code finds the evidence. The model only reads excerpts that are already grounded. Code
makes the decision.** A model asked *"is Backpack a Sender buyer?"* answers from the shape
of the question. A model shown twelve verbatim excerpts and asked what they describe
cannot invent a thirteenth.

Two accounts settled, in opposite directions:

| | Backpack | Zeta Markets |
|---|---|---|
| Corpus read | **392,908 chars** | 41,871 chars |
| Grounded Sender terms | **0** | 3, two of them unambiguous |
| Verdict | **NOT_SENDER**, high confidence | **SENDER_CANDIDATE**, medium |
| Now | UNCLEAR, `senderFit: no` | **PROSPECT, tier 2, grade A** |

**Backpack is ruled out, on evidence.** Nearly 400,000 characters of its own API reference
contain no Jito, no priority fee, no blockhash, no `sendTransaction`, and the word "solana"
twice. Its 35 "liquidation" hits are CEX margin liquidations handled internally — which is
exactly what the context gate exists to catch.

**Zeta is the first account classified SENDER on evidence rather than on sector.** Its SDK
ships `updatePriorityFee()` and `getRecentPrioritizationFees`, and its docs describe
*"crank instructions that keep our exchange moving"* plus a Liquidator. Priority fees and
cranks cannot mean anything but Solana transaction landing.

Three rules make that trustworthy:

- **Inherent vs contextual terms.** `priority fee` and `crank` can only mean Solana
  execution. `liquidator` and `latency` count only with on-chain context in the excerpt.
- **Confidence scales with the corpus.** Under 20,000 characters the answer is
  `INSUFFICIENT_EVIDENCE` — a missing corpus, not an absent signal. Zeta returned exactly
  that until its real docs were found; `docs.zeta.markets/` is a 2,799-char nav page.
- **Legal boilerplate is excluded.** Zeta's terms-and-conditions alone is 46,230
  characters — enough to manufacture a confident verdict out of legal text.

### Starting an account that has no surface at all

Surface discovery reads links off a page an account already owns — so an account with
**no** verified surface can never be started. That is where every candidate org in the
universe map was stuck.

The rule against constructing URLs still holds: we do not turn "Raydium" into
`raydium.io` and hope. A **source** supplies the URL instead. DefiLlama's API returns each
protocol's own declared `url`; `seeds.js` fetches it and admits it only if the page
actually names the company. The directory is a citation for where to look; the fetched
page is the evidence.

Six requested, **three seeded**: Zeta, Phantom and Backpack. Mango declares no URL;
Raydium and Meteora return JS shells with too little text to read. That is the honest
yield.

| Admission test | Why |
|---|---|
| `NOT_IN_DIRECTORY` | not listed on Solana |
| `NO_DECLARED_URL` | listed, but declares no site |
| `TOO_LITTLE_TEXT` | a JS shell is not a surface |
| `NAME_NOT_ON_PAGE` | the directory may be stale or point at a parked domain |

### An article is not a surface

Discovery kept admitting things like `learn.backpack.exchange/articles/what-is-a-sui-wallet-…`
— SEO content about another chain, written once and finished. Re-reading it weekly costs
money and can never produce a new event.

The test is structural rather than textual: **any segment sitting under a collection
path** is an article. `/updates` is an index; `/updates/<anything>` is one post. Docs and
changelogs are judged on text volume instead of dates, because documentation has no dates
— it carries standing conditions.

### Finding surfaces we were not reading

The other ceiling was breadth: most accounts contributed a single page. `surfaces.js`
widens that **without guessing a URL** — it reads the links an account puts on its own
pages, keeps same-site ones, prefers index pages over one-off articles, and admits a
surface only after fetching it and confirming it carries real text and real dates.

Four admitted on the first run, all first-party and all previously invisible:

| Account | Surface | Why |
|---|---|---|
| Jupiter | `developers.jup.ag/changelog` | 18 dated items — the densest dated surface in the registry |
| Jupiter | `developers.jup.ag/blog` | the developer blog, linked from station.jup.ag |
| GSR | `gsr.io/insights` | 12 dated items, linked from their careers page |
| Coinbase | `status.coinbase.com/history.rss` | the full incident log, not the handful the page renders |

### Events, and the one thing that is not an event

Technical documentation carries no dates, because nothing happened. An event-shaped
pipeline therefore throws away the single best piece of evidence there is: a company
describing, in its own docs, how its execution works and what its operators must watch.

So there is a second candidate class. A **standing condition** has no date, is dated by
the fetch, is marked `date_basis: observed_on_fetch`, and is **capped at Research** — it
can fund research, never outreach, because nothing happened to reach out about. It is
only accepted from a first-party surface; an undated news story is still just undated.
Grounding is not relaxed: the quote must still be found verbatim in the fetched page.

This change alone took the last run from 0 rows above No-action to 3.

**A surface is only admitted after it has been fetched and read.** Three accounts are
currently research-blocked for exactly this reason, and that is the system working:

- **Drift Protocol** — `docs.drift.trade` redirects to `docs.velocity.exchange`. Re-checked
  against a research note claiming the page was now Drift-owned: it still redirects, the
  body says Velocity 23 times and Drift once, and the quote the note attributed to it is
  not in the page at all. Stays blocked.
- **Bags.fm** — the site returns four characters of text. It is a JS app with no
  server-rendered copy. Monitoring only.
- **pump.fun / Baton** — HTTP 403. The only readable evidence is a LinkedIn job posting,
  which is login-walled and cannot be verified by fetch, so it is not admitted.

### Finding the operators: read the code, not the docs

HX-GA2 v1 asked a model who ran a protocol's keeper bots, based on the protocol's
documentation. It found nothing, and the reason is structural: **docs describe what the
bots do, never who runs them.** Operators do not publish. They fork a repo, run a binary,
and stay quiet.

**v2 reads the fork graph instead** (`pipeline/forks.js`), and it is almost entirely code.
Every fact comes from the GitHub REST API as a structured field — fork parentage, push
dates, commit authors, profile company and site. No model is involved in discovery at all,
because the API already returns facts and a model could only add a way to be wrong.

The first run against Velocity found `velocity-exchange/keeper-bots-v2` with **99 forks**,
19 of them pushed recently, and 7 fork owners identifiable by company or site. One of
them, `dpiprotocol/dpi-keepers`, describes itself in its own repo as *"Keeper bots for
DPI — order filling and liquidation services"*, forked directly from Velocity's
implementation. That is the first Stream B shape this system has produced from evidence
rather than inference.

**Classification is also code**, against the operator's own fetched site:

| Classification | Meaning |
|---|---|
| `CANDIDATE` | Named org, own site fetches, sells nothing we sell |
| `COMPETITOR` | Their site sells transaction submission or RPC |
| `NOT_A_BUYER` | An institution, or a profile that reads as somebody learning the codebase |
| `THIN_SURFACE` | Site fetches but carries almost no text |
| `UNVERIFIABLE` | No site, a dead site, or **a lookup that never ran** |

That last distinction matters more than it looks. A rate-limited lookup is not a finding —
it is a missing lookup, and the run reports `INCOMPLETE` rather than an empty result.

The crawler also surfaced a fork owner whose employer sells *"Fast Solana Transaction
Submission API"*. Classifying them `COMPETITOR` rather than as a lead is the system
working: discovery and qualification are different jobs, and widening the first is only
safe because the second is enforced in code.

### The account we had filed under the wrong company

The strongest first-party execution evidence in the registry was sitting on a surface
attributed to Drift. It is not Drift's.

`docs.drift.trade/developers/trading-automation/keeper-bots` serves a page titled
**"Keeper Bots | Velocity Protocol"**. It says Velocity eleven times and Drift once — and
that single Drift mention is the navigation link *"Migrate from Drift"*. It is a
competitor's migration documentation.

The keeper-bot dependency is real. Liquidator, JIT Maker and Order Trigger bots submit
on-chain transactions, and the docs tell operators to watch for websocket resubscribes
and **track RPC latency**. But that is **Velocity's** system, documented by Velocity.
Attributing it to Drift would have been exactly the error the gate exists to prevent.

So **Velocity Protocol is now a registry account in its own right** — grade A, first-party,
Sender-routed. Drift stays blocked, with a sharper human task: find a Drift-owned surface
for the engineering fact, and separately establish whether a post-exploit protocol
rebuilding under a new name is still a buying entity at all.

One open question is recorded on the account rather than resolved: the keeper bots are run
by **third-party operators**, so the party feeling the landing pain may be an operator, not
Velocity. The operator is the likelier buyer. That is a named human task.

### Two accounts unblocked, neither of them a buyer

**Titan Exchange** and **Flint Labs** were both unblocked after I fetched and confirmed
their surfaces — and then both reclassified from PROSPECT to UNCLEAR, because having a
readable surface is not the same as being a customer.

- **Titan** ships a Swap API and a routing engine. It sells execution quality rather than
  buying it. Held at UNCLEAR rather than COMPETITOR because the strongest competitive
  language reported in research is *not* in the page I can fetch — the task is to confirm
  it from a Titan-owned page, then reclassify.
- **Flint** describes itself, in its own words, as *"a multi-maker prop AMM for
  USDC-quoted spot. Makers run their own quoting logic."* Flint is the venue. The
  latency-sensitive parties are the **makers quoting on it**, and naming them is the task.
  (The Ergonia parentage reported in research appears nowhere on `flint.trade`, so it is
  recorded as unverified rather than as fact.)

This is the most useful pattern the build has surfaced: **the protocol is rarely the
buyer. The operator or the maker is.**

---

## 5. How a verdict is reached

`assess(row, lens)` computes everything. Nothing is hand-written.

**Step 1 — score out of 100:**

| Factor | Max |
|---|---|
| Transaction-volume signal | 25 |
| Latency sensitivity | 20 |
| Reliability pain | 15 |
| Product fit | 15 |
| Reachability | 15 |
| Recency | 10 |

Minus penalties (e.g. *evidence is a product announcement only*, −8).

**Step 2 — band:** 80+ Actionable · 60–79 Qualify · 40–59 Watch · under 40 No action.

**Step 3 — the caps override the band, and every one shows its reason:**

| Condition | Effect |
|---|---|
| counter-rationale: no evidence of a gap | reclassified to **Research** |
| counter-rationale: incumbent may cover it | reclassified to **Research** |
| source is market context or a directory | cannot exceed **Research** |
| evidence grade C/D | cannot exceed **Research** |
| evidence routes to a different Helius motion | cannot exceed **Research** |
| no infrastructure owner identified | cannot exceed **Qualify** |
| `latency_sensitive = false` | **the Sender lens does not fire** |
| competitor, ecosystem dependency, existing customer | short-circuits before scoring |
| no Solana activity, or a blocked alias | **No action** |

The counter-rationale is a **veto**: it can lower a verdict, never raise one.

### Targeted collectors: tested, and they do not help discovery

The single collector carries fourteen event types and a cap of six candidates, so the model
picks six winners across fourteen competing categories on every read. Splitting it into
five narrow collectors — execution, infrastructure, incident, commercial, hiring — each with
its own budget, looked certain to raise recall.

Measured over the same window and the same 29 sources:

| Config | Rows | Real companies | **Distinct** | Noise | Cost |
|---|---:|---:|---:|---:|---:|
| Broad prompt only | 60 | 60 | **33** | 0 | **$0.1250** |
| Targeted everywhere | 78 | 53 | 28 | 25 | $0.2434 |
| Targeted + routing + filters | 52 | 52 | 30 | 0 | $0.2170 |

**74% more cost for 9% fewer distinct companies.** The targeted run also lost GSR, Zebec,
Zeus Network, Meteora, QuantumAMM and Pump, which the broad prompt found.

The mechanism: a narrow collector capped at six returns its six best signals **within one
category**, often six quotes from the same company's docs. The broad prompt returns its six
best across the page, spreading across more companies. **Targeted collectors buy evidence
depth per account and pay for it in company breadth.**

They earn their place for qualification, not discovery — the targeted execution pass is how
`dpi-keepers` surfaced. So discovery stays broad, and `--deep` runs the targeted set against
an account you already hold.

The experiment also cost the system a filter it did not know it had: the broad
fourteen-category prompt was suppressing listing-table noise. Without it, fifteen token
tickers arrived as companies. `isTokenListing` and `OTHER_CHAIN_ENTITY` now reject those at
verification — noise 25 → 0.

### Rolling batches, not one long sweep

One 90-day scan asked the collector to pull a handful of candidates out of years of
archive and collapsed the result into a single undated number. The scanner now takes an
explicit range, and `npm run batches` walks backwards in 14-day windows:

```
node scan.js --from 2026-10-29 --to 2026-11-12
npm run batches --batches 4 --days 14
```

Each batch is saved as its own run, tagged with its window in the filename, and **merged
into `data/history.json` — append-only, never overwritten.** The merge key is the evidence
itself (`event_date | quote`), not the run that found it, so the same event appearing in
two overlapping batches merges instead of doubling: **290 new pieces of evidence, 307
correctly recognised as already held.**

| Window | Sources | Dated | Standing | Rejected | Cost |
|---|---:|---:|---:|---:|---:|
| 12 Nov → 29 Oct | 29 | 20 | 40 | 254 | $0.1250 |
| 29 Oct → 15 Oct | 29 | 12 | 26 | 276 | $0.0867 |
| 15 Oct → 1 Oct | 29 | 7 | 26 | 281 | $0.0814 |
| 1 Oct → 17 Sep | 29 | 3 | 27 | 279 | $0.0750 |

**One prediction behind the change was wrong, and worth recording.** Narrower windows were
expected to *reduce* `DATE_OUT_OF_WINDOW` rejections. They multiplied them — 12 for the
whole quarter, 388 across three batches — because the acceptance band shrank by 85% while
the pages stayed the same.

The genuine gains were different: **dated rows decay with age** (20 → 12 → 7 → 3), which
is a real freshness signal the single sweep flattened; and the newest batch surfaced
**DPI Keepers at QUALIFY 65** on first-party evidence the 90-day run never lifted above
the floor.

A **standing condition** is still dated by the fetch and marked `observed_on_fetch`. It can
create an opportunity; it can never claim a recent trigger.

#### The full 90 days, and what it showed about the sources

Running seven batches back across the whole quarter settled a question the four-batch run
only hinted at. Dated rows per batch, newest first: **21, 6, 1, 1, 1, 1, 0** — thirty-one
dated findings across ninety days, twenty-one of them in the most recent fortnight.

| Window | Dated | Standing | Cost |
|---|---:|---:|---:|
| 13 Nov → 30 Oct | 21 | 19 | $0.1150 |
| 30 Oct → 16 Oct | 6 | 18 | $0.0820 |
| 16 Oct → 2 Oct | 1 | 16 | $0.0743 |
| 2 Oct → 18 Sep | 1 | 20 | $0.0849 |
| 18 Sep → 4 Sep | 1 | 16 | $0.0773 |
| 4 Sep → 21 Aug | 1 | 21 | $0.0819 |
| 21 Aug → 7 Aug | 0 | 20 | $0.0771 |

**That is not the window logic failing — it is what the sources are.** The registry's
surfaces are *index pages*: a blog front page, a status page, a changelog. An index page
shows the present. Walking a window backwards over a page that holds only the last ten
posts finds nothing, and the rejections say it outright — `DATE_OUT_OF_WINDOW` climbs from
44 in batch 1 to about 90 in every later batch, because the pages keep offering the same
recent dates and the window keeps refusing them.

So a batch timeline built this way is honest but thin: **one real batch, then six batches of
re-read documentation.** Reaching actual history needs *paginated or archived* sources —
`/blog/page/4`, a changelog's older entries, an IR archive — not more windows over the same
front pages. Eleven accounts had a dated event anywhere in the quarter: GSR, NYSE, Kraken,
Coinbase, Backpack, GMO-Z.com Trust, Trade[XYZ], ICE, Jupiter, PDAX and Fireblocks.

**One fix came straight out of it, and it was measured.** The sweep collected **130
standing conditions for 22 distinct facts**, about half its $0.59 cost. The merge deduped them correctly, so the
artefact was fine — but the money was spent at collection. A standing condition is by
definition a fact off a page with **no date on it**, so that page cannot produce a dated row
in any window, and re-reading it six more times buys nothing. The sweep now retires a
surface after the batch that first reads it — but *only* if it produced standing conditions
and no dated row. Anything with even one dated row stays, and so does a surface that
produced nothing at all, because a blog index whose posts were all out of window this time
may be in window later, and retiring it would hide the very history the sweep is after.

The same seven batches, re-run with the retirement rule:

| | before | after |
|---|---:|---:|
| dated rows | 31 | **35** |
| standing rows | 130 | **70** |
| accounts with a dated event | 11 | **14** |
| cost | $0.5924 | **$0.3840** |

**35% cheaper, and no dated evidence lost** — the comparison names every entity in both
runs, and nothing present before is missing after. Three accounts appeared that had not
before: Aria, **Anchorage Digital** and **Metaplanet** — a custodian and a treasury
company, both rank 1–2 institutional buyers on the revenue ranking. The retired surfaces
were undated documentation, exactly as the rule predicted.

### The worklist: opportunities, not leads

The system used to try to prove a company would buy — fit **plus** a named owner **plus** a
dated trigger before anything counted. Nothing ever reached that bar, so eighty verified
rows were reported as nothing, while Solayer Labs advertised the exact role that proves
Sender need, publicly, for months.

That is not the system's job. An **opportunity** is an account where the evidence supports
a credible Helius product conversation, and it needs exactly four things:

```
verified account + plausible buyer segment + one grounded product-fit signal + no disqualifier
```

**No named owner. No dated trigger. No inferred intent.**

| State | Means |
|---|---|
| **opportunity** | a credible product conversation exists |
| **research** | something is there; a specific question needs answering |
| **monitor** | plausible buyer, nothing evidenced yet |
| **disqualified** | competitor, ceased, wrong chain, or **our own customer or partner** |

Every opportunity shows its primary and secondary product, fit score, grounded quote,
source URL, date basis, evidence grade and a **mandatory counter-rationale** — and the
next action is always human work. The system never prepares or sends outreach.

**0 leads became 8 opportunities and 15 research tasks**, from the same registry and the
same evidence rules.

```
Account          : Velocity Protocol
Segment          : DeFi protocols
Primary product  : RPC  (fit 33)
Secondary        : Sender
Evidence         : "a free RPC plan without websockets or getProgramAccounts will not run a bot at all"
Source           : https://docs.velocity.exchange/developers/trading-automation  (2026-11-10)
Counter          : No infrastructure owner identified; the route is research, not a contact.
                   Product fit is evidence of a plausible conversation, never of intent to buy.
NEXT ACTION      : Research the RPC conversation at Velocity Protocol - verify the product
                   stack from their own docs, then identify the owner via github.com/velocity-exchange.
```

### The old five-state funnel, and why it went

The system used to require a proven gap, a named owner, a dated trigger and no
counter-rationale before an account was worth anything. Everything else became `No action`
— 80 rows, zero leads, and a queue that looked empty while Solayer Labs advertised the
exact role that proves Sender need, publicly, for months.

That was outreach-grade certainty used as a discovery filter. A BD team does not need
proof of a purchase decision to put an account on a work list.

| State | Means | Needs |
|---|---|---|
| **outreach_ready** | ready for a human-approved approach | fit + **named owner** + dated trigger |
| **product_opportunity** | clear fit, route identified | fit ≥25 + any route (GitHub org, careers page) |
| **research** | a specific question to answer | a fit **or** a trigger |
| **monitor** | plausible buyer, nothing evidenced | a buyer segment |
| **disqualified** | competitor, ceased, wrong chain, **our own customer** | a stated fact |

A named owner is now required **only** for outreach-ready. Research tasks are questions,
not shrugs: *"Who owns infrastructure at Sanctum? No careers page, GitHub org or named
engineer found."*

Same registry, same evidence rules, same caps. **0 leads became 20 on the worklist.**

### Sixteen products, not seven

The fit engine scored seven motions. Helius's navigation lists **sixteen**, and one of my
seven — "Enterprise" — turned out to be a *pricing tier*, not a product.

| Trading | Infrastructure | Privacy | Read Data |
|---|---|---|---|
| Preconfirmations | RPC Nodes | Solana Privacy Rings | LaserStream |
| Shred Delivery | Helius Validator | | Webhooks & WebSockets |
| Preprocessed Transactions | Validator-as-a-Service | | Parsed Events & Streams |
| Sender | Validator Monetization | | Historical Data |
| Transaction Rebates | | | Token APIs · Wallet API |

Eight conversations were previously undetectable because nothing knew they existed. The
segment list gained **Searchers**, which Helius names as a primary buyer on three product
pages and which was missing entirely.

Each product now carries Helius's own buyer list — *"Who is Shred Delivery for?"* answers
with HFT Desks, MEV Searchers, Memecoin Snipers, DEX Aggregators, Liquidation Engines and
RFQ Desks. That is the targeting taxonomy, written by the seller.

### Check our own customer list first

Reading helius.dev to ground the product definitions turned up something worse than a
missing feature. The registry had **DFlow as a COMPETITOR** — while Helius's own page
carries a testimonial from DFlow's CEO: *"we depend on LaserStream to feed our price
engine."* Wintermute, Ellipsis Labs and Pyth were prospects while listed under *"Some of
our partners."*

Nine rounds of improvement, and nobody had read the seller's own site. Every agent pointed
outward at prospects; none pointed at us. `pipeline/helius.js` now disqualifies anyone on
the customer or partner list before scoring and routes them to account management with the
known contact.

### Discovery: the thing the pipeline could never do

`fetch.js` fetches a URL you already have — it cannot find one. The registry only grew from
itself. `seeds.js` asked which protocols have TVL; `forks.js` asked who copied a repo;
`surfaces.js` asked what a known account links to. **None asked who just raised money,
started hiring, or filed with the SEC** — and those signals live on job boards, in press
releases and in filings, never on the company's own page.

`data/signals/` is the missing input. Every signal needs an org, a type, a date, a source
URL, a quote, a segment, a verification level and a **mandatory counter-rationale** —
validated in code, with bad signals rejected and named. Search-sourced evidence is **capped
at research**, so it can open a question and never authorise an approach.

### The discovery pass: reading rosters for names

The section above described the *shape* of the missing input. `discover.js` is the pass
that actually goes and gets it.

The problem it solves is structural, and three runs of the same fortnight proved it.
`sourcePlan()` builds the run from the surfaces of accounts **already in the registry**, so
the scan can only ever report what changed at a company we already knew. Improving the
collector's prompt made the leads much better — Wintermute, GSR, Ellipsis Labs, Kalshi,
NYSE, ICE instead of explorers and dashboards — and did **nothing** for how many companies
it found, because no prompt can name a company that is not on a page the run fetched. In
the last scan, **100 of 307 rejections** were `DATE_OUT_OF_WINDOW` or `DATE_UNVERIFIABLE`:
the name lists that would lengthen the pipeline were being thrown away for not having a
dated event attached.

So the discovery pass reads **rosters** — a page whose job is to list firms: a perps
category with 88 venues in it, a DEX league table, a validator performance board, a
staking table, a market-maker programme. It **drops the date gate** and keeps every other
discipline:

- every name carries a **verbatim quote, grounded in code** against the fetched page;
- every name carries a **mandatory counter-rationale**, usually *"named in a list with no
  stated activity"*, which is the honest one;
- the whole page is read in **overlapping windows**, so a 62,000-character roster is read
  end to end rather than its first 14,000 characters;
- tickers, asset rows, chains and generic phrases are filtered out;
- Helius's **own customers, partners, logo wall, rivals and Helius itself** are filtered out.

**What it produced, for $0.026:** 9 rosters, **158 companies, 149 of them new to the
registry** — 28 trading, 15 institutional, 51 builder, 47 infra, 3 data, 14 unclear. The
registry held 33 distinct companies before this. Among the new trading-tier names:
HumidiFi (the leading prop AMM), Fogo, Openbook, Mango Markets, BisonFi, Manifest Trade,
Astralane, Bulk, Hxro; and institutionally Gemini, Robinhood, BitMEX, Bitfinex, Bullish,
Sygnum Bank, Maple Finance.

**What it is not.** A candidate here is a **name on a list**. It has evidenced no need for
any Helius product, it is capped at research, it carries `date_basis: undated_roster`
rather than borrowing the fetch date, and it cannot authorise outreach. The dated scan is
what makes a lead. The file says so in its own `disclaimer` field so nothing downstream can
mistake it.

**What it cannot do yet.** It cannot put these names into the registry. A registry entry
needs a **verified first-party surface**, and a roster names a company without linking to
one. Inventing a homepage from a company name is precisely the fabrication this project
exists to prevent — the first draft of `sources.js` guessed six blog URLs and four were
404s. So the output is a research queue a human reads, which is what it claims to be, and
the bridge that resolves each candidate's own site from a cited source is the next build.

```bash
node discover.js                  # all nine rosters, $1 cap
node discover.js --tier trading   # print only the highest-value buyers
```

### Does the company still exist?

Nothing in the pipeline ever asked, and it cost the project its first Qualify.

**Zeta Markets ceased operating in May 2025.** It was classified `SENDER_CANDIDATE` on
grade-A first-party evidence, given a product-fit vector, and promoted to Qualify eighteen
months later. The disclaimer was on `docs.zeta.markets` the whole time — a page fetched a
dozen times. Every agent read it for execution vocabulary; none read it for whether the
company exists.

Everything downstream was *correct*. The SDK really does ship `updatePriorityFee()`. The
docs really do describe cranks and a Liquidator. **Evidence outlives the company.**

`status.js` now runs before anything else is believed — `active · ceased · acquired ·
succeeded`, from the company's own words — and gates both the scorer and the product
engine. A ceased account scores zero across every motion.

It needed a second fix immediately: it excluded **Coinbase**, because Coinbase's status
page says *"the Blast network is shut down"*. The cessation phrase must have the **account
as its subject**, not merely appear on its page.

**Bullet**, named by Zeta as its successor, is registered with **no surfaces and no
inherited evidence**. A successor is a different company until its own pages say so.

### The whole product surface, not just Sender

Asking "does this company need Sender?" and answering "no" eighty times is a narrow
search, not a pipeline. `products.js` asks the better question: **which Helius products
does this company plausibly need, on what evidence, and what is the next best action?**

Every verified account gets a score across all seven motions — Sender, RPC,
LaserStream/Data, Webhooks, Parsed, Validator, Enterprise — not one verdict:

| Account | sender | rpc | laser | webhk | parsed | valid | entpr | Primary | Score | Verdict |
|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---|
| Zeta Markets | 40 | **48** | 25 | 0 | 0 | 14 | 14 | RPC | 74 | **QUALIFY** |
| Kraken | **25** | 14 | 0 | 25 | 0 | 0 | 0 | Sender | 45 | Monitor |
| Coinbase | 0 | 0 | 0 | **21** | 0 | 0 | 0 | Webhooks | 41 | Monitor |
| Velocity | 18 | **33** | 0 | 0 | 0 | 0 | 0 | RPC | 39 | Context |
| Titan | **33** | 26 | 0 | 0 | 0 | 0 | 0 | Sender | 28 | Context |
| Backpack | 0 | 0 | 0 | 0 | **18** | 0 | 0 | none | 18 | Context |

A zero means zero evidence, not "a little". That took three fixes to be true.

**The scoring is two-stage.** Product fit comes from the account's own surfaces. Then
dated **triggers** (hiring, funding, launch, partnership, incident) and **reachability**
modify it — and crucially, they **cannot create a fit**. A funding round at a company with
no evidenced need is still no need; with no fit the score is capped at 19.

**Outreach-ready is reserved.** It needs a strong fit **and** a named owner **and** a dated
trigger. Nothing currently holds all three, so the honest count is **0 outreach-ready,
1 qualify**.

A product fit is a **product opportunity**, never a qualified lead, and never evidence of
intent to buy. The counter-rationale on every row says so.

### Qualify and Actionable are different questions

These were collapsed, which is why the system found real first-party execution evidence and
still reported zero qualified leads.

| | Means | Needs |
|---|---|---|
| **Research** | worth keeping an eye on | a named entity and grounded evidence |
| **Qualify** | **worth assigning a human research task** | ICP fit, Sender-relevant evidence, a trigger or standing condition, a credible research route, no disqualifier |
| **Actionable** | **ready for a human-approved approach** | all of the above **plus a named infrastructure owner** and a dated first-party gap |

Two new fields make the distinction legible:

- **`owner_confidence`** — `named_owner` · `probable_owner` · `route_only` · `none`.
  A fact about the company, looked up on the registry account rather than the row.
- **`outreach_readiness`** — `not_ready` · `research_ready` · `outreach_ready`.
  A fact about the approach. An account can be well qualified and still have nobody to
  send anything to.

The loosening is narrow and deliberate. A standing condition and an unresolved
counter-rationale now cap at **Qualify instead of Research — only** for a registry account
with first-party grade A or B evidence. A market-context source, a grade C source or an
unregistered entity still caps at Research, and **Actionable is untouched**.

**Step 4 — routing, not promotion.** A named registry account with dated Solana evidence
that fails the Sender bar does not become "No action" — it becomes **Routed**, naming the
Helius product it actually belongs to. A Kraken withdrawal delay is a funding-rail
problem, not an execution problem; it is not a Sender lead, but throwing it away loses
real BD signal. Routed sits **below** Qualify and is never a cleared lead.

The guard that matters here: the **event** must be about Solana, not just the account.
A Coinbase outage on Sonic Network was briefly being routed as a Solana task because
Coinbase trades Solana. It is now refused, and there is a test for it.

---

## 6. What it costs

All inference runs on **NEAR AI Cloud** (`google/gemini-2.5-flash-lite`). Prices are
pulled from the live `/models` catalogue at run time and never hardcoded, so the ledger
reflects what was actually charged.

| | Calls | Tokens in / out | Cost |
|---|---|---|---|
| Full 90-day scan, 17 sources | 43 | 140,206 / 14,155 | **$0.0197** |
| Account monitor, 13 accounts | 13 | — | **$0.0063** |
| **One full cycle** | 56 | — | **≈ $0.026** |
| Self-test, 95 assertions | 0 | 0 | **$0.00** |

**Total spend across every priced run of the entire build: under $0.45.**

Cost history is worth seeing, because it was a design decision, not luck:

| Change | Cost per run |
|---|---|
| First working run on a reasoning model | $0.10 |
| Switched to `gemini-2.5-flash-lite` | $0.0092 |
| Added buyer-owned surfaces (5 → 12 rows) | $0.0150 |
| Added Titan + Flint, 15 sources (16 rows) | $0.0184 |
| Added Velocity + standing conditions, 17 sources | $0.0197 |

The reasoning models were burning their entire output budget on reasoning tokens and
returning **empty content** — 2,500 reasoning tokens, zero usable output. Switching model
cut the cost by 91% and made the runs finish.

At these prices a daily scan costs about **$8.76 a year**. Cost is not the constraint on
this build; source quality is.

---

## 7. What results it actually produces

This is the honest part, with the real numbers from the last run.

### A scan

```
run-2026-11-05T21-14-59
Sources fetched : 17
Rows verified   : 14
Rejected        : 41
Verdicts        : RESEARCH 1 · WATCH 1 · NO_ACTION 8 · COMPETITOR 4
Qualified leads : 0
Cost            : $0.0197
```

**Still zero qualified leads** — and the interface says so: *"No qualified lead in this
run — that is a valid result."*

But the run is no longer empty above the floor. The best row is now **Velocity Protocol,
WATCH 57, evidence grade A, first-party, Sender-routed**, on its own documentation:

> *"Several free tiers will not work here, because they disable exactly what a bot
> depends on: websocket subscriptions and getProgramAccounts."*

Four caps are stated on that row, and the second is the interesting one:

1. Standing condition, not a dated event → Research
2. **Counter-rationale: the same page names Helius as already sufficient to get started**
3. Evidence grade A: first-party technical
4. No infrastructure owner identified

Cap 2 is a genuine BD finding, not a defect: Velocity's own docs **already recommend
Helius**. That is an existing-relationship signal, not a cold lead, and the tool surfaced
it from first-party evidence rather than guessing.

Why still zero Actionable, concretely: Sender clears only on `latency_sensitive = true`
*plus* a named infrastructure owner *plus* a dated first-party gap. Velocity has the
first; nobody yet has all three. The gate is not broken — it is refusing to call a
documentation page a lead.

### A bug this run caught, worth recording

The first run with standing conditions produced the build's first-ever **QUALIFY** — and
it was wrong. The entity was *"Solana"*: the chain, not a company. It scored 61 and
sailed through because the counter-rationale rule capped rows we **could** identify to
Research while leaving unidentified rows alone — so a row we could not name outranked one
we could. Both branches now lower the verdict, and a chain name is no longer a named
entity. The false Qualify is gone; the honest Research row remains.

### The account monitor

```
monitor-2026-11-05T17-36-42
Accounts monitored : 13  (of 22 in the registry; the rest have no verified surface)
Dated changes      : 15
Relevance          : 2 Sender-relevant · 4 context · 3 wrong motion ·
                     5 not Solana · 1 research-blocked
Skipped            : 21  (each with a reason)
Research-blocked   : 5   (each with a named human task)
Cost               : $0.0063
```

Fifteen changes is not fifteen leads, and the tool will not let you read it that way.
Two were Sender-relevant. The other thirteen are visible, labelled, and not pretending.

### The five kinds of result

1. **A qualified lead** — scored, capped, with its evidence, its counter-rationale and
   the name of whoever would be approached. Currently: none. The nearest miss is Velocity
   at WATCH 57, held back by a missing infrastructure owner.
2. **A routed task** — a named account with dated Solana evidence that belongs to a
   different Helius motion. Not a lead; a task. Currently none, because the routing layer
   refused the only candidate: a Coinbase outage on **Sonic Network**, which is not Solana.
3. **A research task** — a named account where something is missing. The *Missing* view
   exists entirely for this.
4. **A rejection with a reason code** — 31 of them last run, all inspectable.
5. **A research block with a human task** — five accounts, each naming what a person
   needs to go and find.

A tool that only shows findings is selling you confidence. Four of these five outputs
are the tool telling you what it does not know.

---

## 8. The BD tracker workbook

The interface serves a downloadable **.xlsx** at `/api/tracker.xlsx` — the button is
under the office. Eight tabs, deliberate parity with the Bob W v2 tracker so the same
reader needs no new mental model:

**Cover · Existing & Expansion · Pipeline · Verification Queue · Live Signals ·
Prompt Pack · Solana Universe · Key & Methodology**

It is **built at the moment you click**, from the live registry, the latest scan, the
latest monitor run and the latest operator run. The spreadsheet and the screen cannot
disagree, because they are the same data.

Scores are computed in `tracker/rubric.js` — five dimensions, 25/25/20/15/15:
Automation Dependency, Infrastructure Pain, Identifiability & Contact, Ecosystem
Surface Overlap, Timing Window. Two rules are enforced in code:

- **Identifiability raises, never lowers.** A generic entity scores 0 and is capped at
  Monitor. This is the inversion of the bug that let a row whose organisation was
  "Solana" reach Qualify on 61.
- **A row routed away from Sender says so wherever it is read.** Kraken appears as
  *"Stream F - Displacement (not Sender - RPC/Enterprise)"* on every tab. The routing
  layer catching it is useless if a skim-reader sees "High" and dials.

**Tab 3, the Verification Queue, is the worklist.** Every unverified contact, sorted by
score, with the prompt that fills it and the band change it would produce. Velocity sits
at the top: verifying one contact moves it 64 → 76, High → Critical.

The artifact sandbox blocks downloads, so opened as a bare artifact the panel says so and
gives the command instead of showing a button that does nothing.

## 9. The interface

Geist / Geist Mono on bone, after contentarchitecture.dev: full bleed, 80px gutters,
floating pill nav with the ticker inside it. Every band is the same two-column grid —
argument left (640px), artefact right.

| Band | Left | Right |
|---|---|---|
| Hero | the claim, derived from the live counts | — |
| The office | what the gate does | 3D room + approvals rail |
| Queue | which lens, and what it means | six views over one store |
| Method | how a verdict is reached | the rubric and the caps |
| Output | what the run produces | BD brief, NEAR ledger |

**Six views, one store:** Queue (by score) · Gate (the disqualifier pass) · Evidence
(by source, naming the concentration risk) · Products (showing where Sender *did not*
fire) · Timeline · Missing (what we do not know).

**One scorer, not two.** The page used to keep its own copy of the scoring rules, and the
two drifted — it showed 8 research and 0 routed where the pipeline scored 4 and 1 on the
same rows. A live row now carries the verdict `pipeline/score.js` computed and the page
uses it verbatim. The local implementation only scores the labelled fixture dataset, which
has no pipeline behind it. Because verdicts are stored, `npm run rescore` re-applies
changed rules to a saved run for free rather than making you pay $0.12 to re-collect
evidence that has not changed.

**Nothing hardcodes a date or the word "fixture".** `runLabel()` is the single source of
truth — the hero, the queue header, the brief and the footer all derive from whichever
run is loaded. If a live run is open, nothing on screen says fixture.

**The office:** Three.js, procedural, no floor. Frosted-glass walls, eight agents floating
with haloes, a document that flies desk to desk, a radar that pulses under whoever holds
it, and confetti when the last approval clears. Each agent is a real pipeline stage —
remove one and a stage disappears.

**Where the disclaimers went:** not in the interface. *About this build* in the nav opens
one modal with the real/fixture table, the ICP tiers, the limits and the track positions.
A judge finds it in one click; someone working the queue never scrolls past it.

**Seeing the output:** open an approval, then Preview or Edit — BD brief, technical
discovery brief, outreach email, NEAR settlement. *Save as PDF* uses a print stylesheet
that hides the app. There is no mail server by design: the email opens in your own
client, and **the send is yours.**

---

## 10. Why NEAR

Not a payment sticker. **Every model call runs on NEAR AI Cloud**, which is TEE-verifiable
inference (Intel TDX plus GPU TEE). There is no fallback provider.

A pipeline doing commercial research on named companies and their commercial weaknesses
is a genuine case for attestable private inference: the research is sensitive, and we can
prove where it ran. The ledger in the interface shows the token spend for the run you are
looking at.

---

## 11. What is deliberately not claimed

Keep this list. It is the most defensible thing here.

- No live scan results are claimed beyond what a run actually produced. Right now that is
  zero qualified leads, and the page says so.
- The NEAR Intents 1Click quote is a **fixture**. The DeFi track is not selected.
- The agents do not negotiate, hire one another, or hold a treasury.
- No outreach email is sent. The writer produces an internal brief; the send is a human's.
- No prospect's intent is inferred. A press release cannot tell you what a company wants
  to buy, and the tool says so on the row.
