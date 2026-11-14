# Helius BD Tracker

![tests](https://img.shields.io/badge/tests-546%20assertions-brightgreen)
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
| Worklist | **6 opportunities · 40 research · 33 monitor · 19 disqualified** |
| Tests | **546 assertions**, no test framework |

Outreach-ready is **0 — by design.** All six opportunities are blocked on *"no verified
contact"*, because the system will not guess an email address. The blocker is the correct
output, not a gap.

---

## Judge quick start — no key, no install, no network

Every command below runs **offline** on a fresh clone with Node 20+. There is nothing to
install: no dependencies, no build step, no `npm install`.

| Do this | See this |
|---|---|
| `node attack.js` | **25 attacks on the pipeline, all blocked.** Every way we know to get a fabricated lead through — an invented quote, a memecoin as a company, the seller on its own prospect list, a dead company, a guessed homepage, a news article filed as a company's blog, a guessed email address — each run against the real code with the verdict asserted. Fully offline. |
| `node pipeline/selftest.js` | **546 assertions, 0 failures.** No test framework. |
| `node server.js` then open `http://localhost:8742` | The full interface, populated from a **committed snapshot of real runs** (`data/snapshot/`), so it works with no NEAR AI key. The page says whether it is showing live or snapshot data. |
| `node -e "..."` on `data/snapshot/funnel.json` | The actual worklist: 6 opportunities, 40 research, 33 monitor, 19 disqualified, each with a grounded quote, a source URL and a mandatory counter-rationale. |
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
| **Settlement** | NEAR Intents 1Click `dry: true` quote. **Still a fixture.** See *Honest limits*. |

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
| NEAR Intents 1Click quote | **Fixture.** Not wired to the live endpoint. |
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
