# Helius BD Tracker

![tests](https://img.shields.io/badge/tests-566%20assertions-brightgreen)
![attacks](https://img.shields.io/badge/attacks-25%20blocked%20%C2%B7%200%20through-brightgreen)
![dependencies](https://img.shields.io/badge/dependencies-none-blue)
![inference](https://img.shields.io/badge/inference-NEAR%20AI%20Cloud-informational)

A business-development scanner for Solana infrastructure sales. Eight agents read
public sources, **verification happens in code**, and the system refuses to turn a
press release into a hot lead.

**All inference runs on [NEAR AI Cloud](https://cloud.near.ai).** There is no other
model path and no fallback. Without a NEAR AI key the pipeline aborts rather than
producing anything.

---

## The problem

Every BD tool in this category does the same thing: it finds an announcement, decides
the announcement means someone needs your product, and hands a salesperson a lead.
That inference is almost always wrong, and it is never shown.

This tool makes the opposite move. Every candidate must survive four checks before a
human ever sees it, the score is computed by code rather than asserted by a model, and
a stated reason the lead might *not* qualify can veto the verdict outright.

**Measured, on real runs** (all figures from runs on disk, $4.36 of the $10 free NEAR AI
credit across 71 priced artefacts):

| | |
|---|---|
| Registry | **88 accounts** — 29 hand-curated, 59 promoted by the bridge |
| Discovery | **158 companies found, 149 new to the registry, for $0.026** |
| Surfaces verified | **135**, each fetched and confirmed as published by that company |
| Worklist | **25 opportunities · 20 research · 33 monitor · 20 disqualified** |
| Tests | **566 assertions**, plus 25 adversarial attacks, all blocked |

Outreach-ready is **0 — by design.** All 25 opportunities are blocked on *"no verified
contact"*, because the system will not guess an email address. The blocker is the correct
output, not a gap.

---

## The audit: we applied our own standard and found a bug

This project implements a finding from **The Evidence Gap** (Donaghue, with Apart Research,
AI Collusion Research Sprint, Oct 2026), which proposed a standard for when a detector's
output counts as evidence. We applied that standard to our own core integrity check,
`quoteIsGrounded()` — the one function this entire system rests on.

**The first failure was ours.** The audit scored 100% / 0% and we nearly shipped it. It was
a tautology: we were testing verbatim sentences lifted out of the page against a substring
search, so it could not fail. That is Pitfall #94 — *a perfect score on a test you designed
is a fact about the test.*

**The real test.** We roughened the positives into what a model actually emits — whitespace
drift, dropped terminators, dropped trailing clauses, smart quotes — and added the hard
negative: **paraphrases of real sentences from the correct page.**

> **48.8% of paraphrases were accepted as grounded.**
> `is` → `remains`, `each` → `every`, `transactions` → `transfers`.

A model that *reworded instead of quoting* was passing the check. Not a fabrication, not a
wrong page — simply not quoting. **573 tests never caught it**, because every grounding
test used either a verbatim quote or an obvious fabrication. Nobody had written the case in
between, which is the case a real model produces.

**The fix.** A truncation only *drops* words that are on the page; a paraphrase
*introduces* words that were never there. So every substantive word must appear in the page
before the tolerance may apply.

| | before | after |
|---|---:|---:|
| real quotes kept | 100% | **100%** |
| paraphrases accepted | 48.8% | **2.3%** |
| other-page prose accepted | 0% | **0%** |

```bash
node audit.js     # offline, no key, 11 frozen pages
```

It passes all six criteria from the paper — the free check plus five parts — including a
ranking **1st of 47** against nonsense tuned to its own firing rate, and **89.1%** disparity
surviving subtraction of the luck level. It also prints what it does *not* establish.

We did not just build a lie detector and assert it works. We published the standard, ran it
against ourselves, found the failure, fixed it, and shipped the test so you can re-run it.

---

## What this is, and where it goes

A verification engine. It refuses to certify a claim it cannot ground in
a page it fetched itself. Today it is pointed at Solana BD research and
produces a worklist a human acts on.

The same engine is the arbitration layer for a research bounty market.
Every question in the Missing view is a job: researchers bid, escrow
holds the funds, and the verifier decides — payment releases on a
passing grounding check, not on delivery of a claim. Settlement routes
through NEAR Intents. The dry quote in this build is that rail, not yet
wired.

Today: the worklist. Next: the market.

The settlement policy that decides whether money moves is **code, and it is
tested offline with no key and no network**:

```js
GROUNDED            -> RELEASE
QUOTE_NOT_IN_SOURCE -> REFUND
CLAIM_NOT_SUPPORTED -> MANUAL_REVIEW
DATE_UNVERIFIABLE   -> REFUND
SOURCE_UNREACHABLE  -> REFUND
ACCOUNT_CEASED      -> REFUND
ACCOUNT_COMPETITOR  -> REFUND
TIMEOUT             -> REFUND
UNKNOWN             -> MANUAL_REVIEW   // never silently pay
```

`node pipeline/selftest-market.js` exercises it. The same table governs the
escrow contract, so if the two disagree the test fails.

---

## Why this architecture: *The Evidence Gap*

This project is the applied implementation of a research finding. **The Evidence Gap**
(Kerrie Donaghue, independent researcher, with Apart Research — AI Collusion Research
Sprint, Oct 2026) audited six collusion detectors that had been built and frozen before
the sprint, re-ran them against the data they were validated on, and then asked what their
validation never did: **can they beat nonsense?**

Two could not be told apart from a crowd of deliberately meaningless rivals — one ranked
65th of 100. A third beat all 283 of its rivals and is still worthless, because what it
looks for and what counts as a chance to look are identical, so it fires every time it can.
A fifth passes everything, but how wrong it looks moves **560-fold** depending on what you
count. The standard check — how often it catches real cases, how often it stays quiet
otherwise — catches none of these.

The rule that came out of it, labelled in the deck as *the rule we learned four times*:

> **Make the detector emit the quote, and read the quote.** A text-only detector that
> can't show its supporting evidence isn't an evidence instrument — it's a guess.

That sentence is `quoteIsGrounded()`. The model is the detector; it must emit a verbatim
span, and **code then reads the page we fetched ourselves to see whether the span is
there**. Four findings from that research map onto four mechanisms here:

| The research found | This system does |
|---|---|
| **The substring trap.** `"tie"` matched inside *"parties"*, *"tier"* and *"patient"*. No tie existed — a word-boundary bug. | Word boundaries on every term match. We hit the identical bug three times: `/send/` matches "**Send**er", which is a product name here. It is Pitfall 79, and twice more since. |
| **The write channel is a read channel.** 30 of 48 crossings flowed through `cache_put`, invisible to detectors watching `get`. | The risky channel is the model's *write* — the structured JSON it emits — not the page it read. So the emitted quote is grounded against the fetched page, and a separate check asks whether the quote supports the claim (`CLAIM_NOT_SUPPORTED`). |
| **Naming is not judging.** Monitors named a planted breach 14/14 times and flagged it only 10/14. *"I can see it, but I can't say it's a breach."* | Every row is forced to a verdict — opportunity, research, monitor, disqualified — and carries a **mandatory counter-rationale**, the stated reason it might not qualify, which can veto the verdict. |
| **Negative controls.** A detector that fires every time it can is a tautology, and you only find out by racing it against nonsense. | The rejection log is the negative control: 2,275 candidates refused, each with a reason code. `node attack.js` races the pipeline against 25 deliberate fabrications and all 25 are blocked. A system that returned "opportunity" for everything would be that tautology. |

### We ran the audit on ourselves, and it failed us

The paper proposes what to ask before a detector's output counts as evidence: a free check
first — *if the rule fires whenever it could fire, stop there* — then five things. So the
standard was applied to this project's own detector, on a frozen corpus of 11 real pages,
offline:

```bash
node audit.js
```

**It found a real defect on its first honest run.** The grounding check was accepting
**48.8% of paraphrases** of real sentences from the *correct* page — `is` → `remains`,
`each` → `every`, `transactions` → `transfers`. The truncation tolerance let the matching
run float past a substituted word, so a model that *reworded instead of quoting* passed the
check this entire project rests on. Not a fabrication. Simply not quoting. **566 tests
never caught it**, because every grounding test used either a verbatim quote or an obvious
fabrication — nobody had written the case in between, which is the case a real model
produces.

Fixed by requiring every substantive word to be on the page before the tolerance applies.
Real quotes kept: 100%. Paraphrases accepted: 48.8% → **2.3%**. It is `PITFALLS.md` #93.

The audit now reports:

| Criterion | Result |
|---|---|
| **Free check** — does it fire whenever it could? | Fires on 39.8% of opportunities. Not a tautology. |
| **1. Opportunity denominator, stated** | n=402 pairs. Reported with its sensitivity: the rate moves **6×** across defensible denominators, and two indefensible ones are named as such. |
| **2. Quiet cases from elsewhere** | 158 real sentences from *other* pages (0.0% fire) plus 86 paraphrases from the *right* page (2.3% fire). |
| **3. Ranked against nonsense** | **1st of 47** rivals tuned to its own firing rate. *(The paper's worst case ranked 65th of 100.)* |
| **4. Luck-adjusted disparity** | 99.2% raw, best rate-matched coin 10.1%, **89.1% survives subtraction.** |
| **5. Shape-preserving rivals** | Five rivals that keep the search and change the string — reversed, shuffled, fixed phrase, wrong page — all collapse. The meaning is in *which* string in *which* page. |

And what it does **not** establish, printed in its own output: that a grounded quote means
a company needs anything. One corpus, one domain of discourse, 11 pages. A second
independent population is the obvious next test and has not been run.

The research audited itself too: *"Applying it to our own prior work forced six corrections
and withdrew two headline figures."* `PITFALLS.md` is the same practice — **94 entries**,
including two bugs introduced by the fix for an earlier bug, one case where a pass printed
a clean zero that was actually a defect, and #94: an evaluation set that scored 100% and
meant nothing.

---

## Judge quick start — no key, no install, no network

Every command below runs **offline** on a fresh clone with Node 20+. There is nothing to
install: no dependencies, no build step, no `npm install`.

| Do this | See this |
|---|---|
| `node audit.js` | **The Evidence Gap admissibility audit, run on our own detector.** Free check, opportunity denominator with sensitivity, independent and adversarial negative families, a ranking against 46 nonsense rivals, luck-adjusted disparity, and shape-preserving nulls. Offline. It found a real defect — see below. |
| `node pipeline/selftest-market.js --live` | The arbitration layer: two workers answer one research bounty. The one who quotes the page verbatim is **paid**; the one who invents a quote is **refunded against**. |
| `node attack.js` | **25 attacks on the pipeline, all blocked.** Every way we know to get a fabricated lead through — an invented quote, a memecoin as a company, the seller on its own prospect list, a dead company, a guessed homepage, a news article filed as a company's blog, a guessed email address — each run against the real code with the verdict asserted. Fully offline. |
| `node pipeline/selftest.js` | **566 assertions, 0 failures.** No test framework. |
| `node server.js` then open `http://localhost:8742` | The full interface, populated from a **committed snapshot of real runs** (`data/snapshot/`), so it works with no NEAR AI key. The page says whether it is showing live or snapshot data. |
| `node -e "..."` on `data/snapshot/funnel.json` | The actual worklist: 25 opportunities, 20 research, 33 monitor, 20 disqualified, each with a grounded quote, a source URL and a mandatory counter-rationale. |
| Read `PROJECT-COMPLETE.md` | The whole project in one file — architecture, every rule, measured results, and what does not work yet. |
| Read `PITFALLS.md` | 89 recorded mistakes and what each one changed. This is the real engineering record. |

**With a NEAR AI key** (free $10 via [NEAR Builders](https://nearbuilders.org/join)) you can
reproduce everything:

```bash
echo 'NEAR_AI_API_KEY=...' > .env && chmod 600 .env
node discover.js                 # rosters -> 158 candidate companies      ~$0.03
node bridge.js --limit 60        # candidates -> registry accounts
node scan.js --from 2026-10-29 --to 2026-11-12 --budget 2
node funnel.js                   # evidence -> worklist
```

Without a key the pipeline **aborts rather than inventing results.** That is the design.

---

## Try it

```bash
# 1. Get a NEAR AI Cloud key - free $10 of credit via NEAR Builders
#    https://nearbuilders.org/join  ->  https://cloud.near.ai
export NEAR_AI_API_KEY=your_key_here

# 2. Run a scan from the command line
node scan.js --days 90 --budget 2

# 3. Or run the interface with the scanner wired in
npm run serve          # http://localhost:8742  ->  press "Run scan"
```

**Do X, see Y:**

| Do this | See this |
|---|---|
| `node pipeline/selftest.js` | 27 assertions proving the guards work. Costs nothing, needs no key. |
| `node scan.js --days 90` *without* a key | The run **aborts** with an instruction. It does not fall back to another model, and it does not invent rows. |
| `node scan.js --days 90` *with* a key | A real run: pages fetched, candidates extracted, rejections logged with reason codes, a JSON run file written to `data/runs/`. |
| `npm run serve`, open the page, press **Run scan** | The eight agents run live; the 3D office animates against real stage events; the queue is replaced by verified rows. |
| Open the page as a published artifact (no server) | The scanner reports itself unavailable and the dataset is labelled **demo dataset**. It never pretends a fixture is a scan. |

---

## How NEAR fits

NEAR is not a payment sticker on this project. It is where the intelligence runs.

| | |
|---|---|
| **Inference** | Every model call goes to `https://cloud-api.near.ai/v1`. Five of the eight agents call it. There is no OpenAI, Anthropic or local model anywhere in the code. |
| **Why that matters** | NEAR AI Cloud is TEE-verifiable inference (Intel TDX + NVIDIA GPU TEE). A BD pipeline reads commercially sensitive research about named companies; running it on attestable private inference is a real property, not a marketing line. |
| **Cost** | Metered from the API's own `usage` numbers, never estimated. A budget cap aborts the run before it can overspend a $10 grant. |
| **Settlement** | NEAR Intents 1Click `dry: true` quote. **Priced, not wired** — the rail a research bounty market would settle on. See *Honest limits*. |
| **Attested** | The attestation endpoint is live at `/api/attestation`. Open **About this build** to see the signing address and hardware quote for the current inference endpoint. |

The attestation is not a claim in a README — it is a live call. The report for the endpoint
serving this project at the time of writing (`data/snapshot/attestation.json`):

```
runtime          dstack-0.5.12
signing address  40599fb284f43953bb356b09080fd803c960fc10285ad90eca462ca711ad4acb (ed25519)
Intel TDX quote  present, 10,012 characters
boot event log   present, 30 measured entries
MRTD             7fe60787222bd394cb516abca2435f22f035ab2cc9c0a4b4b3b148e46297f3d9...
transport        OHTTP — the request itself is sealed to the enclave's key
```

Change the image or the compose file and the measurements change. The panel prints a
failure verbatim if the endpoint moves, because a visible failure is checkable and silence
is not. No NVIDIA GPU payload is present in this response shape, and the panel says so
rather than implying one.

---

## The pipeline

Six stages, in sequence. **Four call a model. Two are deliberately code.**

```
1  COLLECTOR   NEAR AI   reads a fetched page, extracts dated events as JSON
2  VERIFIER    code+AI   grounding in CODE, then claim-support by model
3  ENRICHER    NEAR AI   gate fields, each needing a supporting span
4  SCORER      CODE      the rubric
5  GATE        CODE      caps and the counter-rationale veto
6  WRITER      NEAR AI   internal brief - never outreach
```

Stages 4 and 5 have no model **by design**. A model may propose; only code disposes.
A model never emits a score, a band or a priority anywhere in this system.

### The grounding check is the whole integrity story

The Collector must return a **verbatim span**. Before that candidate goes any further,
`pipeline/verify.js` searches for that span in the page text **we fetched ourselves**:

```js
if (!quoteIsGrounded(c.quote, pageText)) return fail('QUOTE_NOT_IN_SOURCE');
```

A quote the model invented is not in the page, so it cannot pass. This is the guard
that every inherited prompt pack in this lineage was missing.

### Nothing is dropped silently

Every rejection carries a reason code and reaches the UI:

`NO_SOURCE_URL` · `SOURCE_NOT_WHITELISTED` · `SOURCE_UNREACHABLE` ·
`QUOTE_NOT_IN_SOURCE` · `DATE_OUT_OF_WINDOW` · `DATE_UNVERIFIABLE` ·
`NO_NAMED_ENTITY` · `BLOCKED_ALIAS` · `NOT_SOLANA` · `DUPLICATE` ·
`INFERENCE_FAILED` · `MALFORMED_JSON`

**An empty run is a valid result.** A fabricated one is not.

---

## The verdict engine

Score out of 100, then caps override it, and every cap states its reason.

| Factor | Max |
|---|---|
| Transaction-volume signal | 25 |
| Latency sensitivity | 20 |
| Reliability pain | 15 |
| Product fit | 15 |
| Reachability | 15 |
| Recency | 10 |

| Cap | Effect |
|---|---|
| counter-rationale: no evidence of a gap | reclassified to **Research** |
| counter-rationale: incumbent may cover it | reclassified to **Research** |
| no infrastructure owner identified | cannot exceed **Qualify** |
| extension lens, not the primary motion | cannot exceed **Qualify** |
| `latency_sensitive = false` | the Sender lens does not fire at all |
| no Solana activity, or a blocked alias | **No action** |

The counter-rationale is **mandatory** on every row. A row whose Enricher returns no
counter is rejected. That single rule is what stops *"Securitize expanded its
catalogue"* becoming *"Securitize needs Helius."*

**The verdict is not in the schema.** A row carries a rubric, a gate object and a
counter-rule; `assess()` derives the rest. Nobody can promote a row by typing a better
word into it.

---

## The motion

One declared sales motion. The other five lenses are schema demonstrations.

```
PRODUCT  Sender - transaction landing on Solana
BUYER    infrastructure lead at a Solana-native trading firm or exchange
TIERS    1 prop firm / arb desk / MEV operator   -> Sender Max
         2 DEX / aggregator / exchange           -> Sender + LaserStream
         3 wallet / payments / consumer app      -> research only, no outreach
```

Roadmap lenses are selectable so you can see one evidence store re-read for another
Helius product. Nothing in them can exceed **Qualify**, enforced in `score.js`.

---

## Honest limits

Read this before judging the NEAR integration.

| Layer | Status |
|---|---|
| NEAR AI inference | **Real.** Every model call, metered from the API's own usage. |
| Code verification, reason codes, rubric, caps | **Real.** 27 assertions in `pipeline/selftest.js`. |
| Source fetching | **Real HTTP** to a fixed whitelist. No URL is ever constructed by a model. |
| The ten rows shipped in the page | **Demo dataset.** Hand-entered, labelled in the UI, replaced wholesale by a live run. Never merged. |
| NEAR Intents 1Click quote | **Priced, not wired.** The route is costed; nothing settles on it yet. The policy that would decide settlement is tested code. |
| Outreach email | **Removed from the pipeline.** The Writer produces an internal brief only. |

**We are not selecting the Unstoppable DeFi track**, because the 1Click quote is a
fixture and claiming it would be dishonest.

---

## Layout

```
index.html              the interface (single file, no build step)
server.js               serves the interface + /api/run + /api/status
scan.js                 CLI entry point
pipeline/
  config.js             motion, source whitelist, blocked aliases, reason codes
  near.js               NEAR AI client + cost ledger + budget stop
  agents.js             the four model prompts
  fetch.js              real HTTP, whitelist-enforced
  verify.js             grounding, dates, entities, duplicates - all code
  score.js              rubric and caps - the single source of truth
  run.js                the six-stage orchestrator
  selftest.js           27 assertions, no key needed
data/runs/              run output, one JSON per scan
```

---

## Environment

```bash
NEAR_AI_API_KEY              required - the run aborts without it
NEAR_AI_BASE_URL             default https://cloud-api.near.ai/v1
NEAR_AI_MODEL_LIGHT          default zai-org/GLM-5.1-FP8
NEAR_AI_MODEL_HEAVY          default zai-org/GLM-5.1-FP8
NEAR_AI_PRICE_IN_PER_M       optional - set to price the ledger in USD
NEAR_AI_PRICE_OUT_PER_M      optional - without both, the ledger reports tokens only
```

If the price variables are unset the ledger reports **token counts and says so**,
rather than inventing a dollar figure.

Keys live in the environment. Never commit one.

---

## Licence

MIT. See `LICENSE`.
