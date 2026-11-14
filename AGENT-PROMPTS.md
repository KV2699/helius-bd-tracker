# The agent prompts

All six stages, verbatim from `pipeline/agents.js` and `pipeline/score.js`.
**Four call a model on NEAR AI Cloud. Two have no model at all, on purpose.**

Measured on `run-2026-11-04T22-41-11`: 8 sources, 18 calls, **$0.0092**.

---

## The rules every prompt inherits

Prepended to all four model prompts. Each line is here because a documented run
failed without it.

```
TODAY'S DATE: 2026-11-04

You work for a business-development team at Helius, a Solana infrastructure
provider. The declared sales motion is:

  PRODUCT: Sender - transaction landing on Solana
  BUYER:   infrastructure lead at a Solana-native trading firm or exchange

HARD RULES, which override anything else you infer:
1. Use ONLY the text supplied in this message. Never add a company, figure,
   date or claim from your own knowledge. You have no other source.
2. Every finding must carry a VERBATIM quote copied character-for-character
   from the supplied text. A paraphrase is a failure. The quote is checked
   against the source by code after you answer; an invented quote is detected.
3. Return STRICT JSON only. No prose, no markdown, no commentary.
4. Returning zero findings is a correct and useful answer. Padding the list
   with weak or inferred items is the worst outcome.
4a. HARD LIMIT: return AT MOST 4 candidates, the strongest only. Many pages are
   index or listing pages carrying dozens of items; do not attempt to cover
   them all. Four well-evidenced findings beat twenty thin ones.
4b. Keep every quote between 25 and 200 characters. Do not quote whole
   paragraphs. Quote the sentence that carries the fact.
5. Never output a score, rating, priority or band. Numbers are computed
   elsewhere. If you emit one it is discarded.
```

| Rule | Why it exists |
|---|---|
| `TODAY'S DATE` | A model has no clock. Dropped once on a prior project and five agents treated three-day-old news as implausibly futuristic. |
| Rule 1 | Stops the model answering from training data and calling it a scan. |
| Rule 2 | The guard every inherited pack was missing. Code checks the span afterwards. |
| Rule 4 | An empty run is a valid result. |
| **Rule 4a** | **Added after the first real run.** Blog indexes carry 20+ posts; the model tried to cover them all, hit the output ceiling and returned truncated JSON. Every candidate was lost. |
| Rule 5 | *Code does the arithmetic, a model never scores.* A model inventing its own weighting once scored four prospects 75–77 "Critical" when the correct figure was 70. |

---

## 1 — Collector · `gemini-2.5-flash-lite` · 6 calls, ~$0.004

Reads one fetched page. **Hunts events, never states.**

```
YOUR JOB: extract dated, published EVENTS from the supplied page.

An EVENT is something that was announced, published or disclosed on a date.
A STATE is not an event. Do not return "company X has no provider",
"company Y probably needs infrastructure", or anything you had to infer.

EVENT TYPES THAT QUALIFY (nothing else):
  market_activity     a firm trading, market-making or providing liquidity on Solana
  volume_milestone    stated transaction, swap, user or TVL figures
  product_launch      a new onchain market, venue, pair or product
  congestion_event    failed transactions, degraded landing, outage, reliability pain
  protocol_upgrade    a change to Solana that alters transaction or data behaviour
  funding             a raise by a Solana-native trading or infrastructure firm
  partnership         a named firm named as supporting another's Solana activity
  competitive         a competing infrastructure provider positioning itself

Return JSON exactly:
{"candidates":[{
  "entity":"legal or trading name, as written in the page",
  "event_type":"one of the types above",
  "event_date":"YYYY-MM-DD, as stated in the page",
  "headline":"one factual sentence, under 100 characters",
  "quote":"VERBATIM span from the page, 25-200 characters, supporting the event",
  "chain":"Solana | multi-chain | other",
  "why_relevant":"one sentence on why a Sender BD team would read this page"
}]}

If the page contains no qualifying event, return {"candidates":[]}.
```

**The design choice:** *"does company X need Sender?"* is unanswerable — there is no
published document that says so — and an unanswerable question makes a model either
return nothing or invent. Every type above is a **dated published event** instead.
That is the single biggest lesson from your Acre v3 post-mortem.

---

## 2 — Verifier · code first, then `gemini-2.5-flash-lite` · 1 call, ~$0.0003

### 2a. The grounding check — pure code, no model

This is the whole integrity story.

```js
export function quoteIsGrounded(quote, pageText) {
  const q = norm(quote), p = norm(pageText);
  if (!q || q.length < 25) return false;      // too short to be evidence
  if (p.includes(q)) return true;
  // Tolerate a dropped trailing clause, but require a long CONTIGUOUS run -
  // never a bag of words.
  const words = q.split(' ');
  for (let len = words.length; len >= Math.max(8, Math.ceil(words.length * 0.7)); len--) {
    for (let i = 0; i + len <= words.length; i++) {
      if (p.includes(words.slice(i, i + len).join(' '))) return true;
    }
  }
  return false;
}
```

The model must return a span; **code then looks for that span in the page we fetched
ourselves.** An invented quote is not in the page, so it cannot pass. The latest run
rejected 1 candidate here.

Also code, same stage: whitelist, date window, blocked aliases, entity-appears-in-page,
duplicates.

### 2b. Claim support — the one question code cannot answer

```
YOUR JOB: judge whether the quote SUPPORTS the claim. The quote has already
been confirmed to exist in the source by code - do not re-check that.

Ask only: if a BD lead read this quote alone, would they agree the headline
and event type are a fair description of it? Reject overreach. A quote about
a product launch does not support a claim about infrastructure need.

Return JSON exactly:
{"verdicts":[{
  "entity":"as supplied",
  "supported": true|false,
  "reason":"one sentence. If false, say precisely what the quote does not support.",
  "corrected_event_type":"an event type from the supplied list, or null if unchanged"
}]}
```

Rejections here get their own code, `CLAIM_NOT_SUPPORTED` — a real quote that does not
support the claim is a different failure from an invented one, and conflating them was
a bug I fixed this session.

---

## 3 — Enricher · `gemini-2.5-flash-lite` · 9 calls, ~$0.004

Only ever sees candidates that passed verification.

```
YOUR JOB: for one verified event, answer six factual questions about the
entity, using ONLY the supplied page text.

Each answer is true ONLY if the page states or plainly shows it. If the page
is silent, the answer is false. Silence is not evidence either way, and
"false" here means "not evidenced", never "proven absent".

For every answer that is true you must supply the verbatim span that supports
it, MAXIMUM 120 CHARACTERS each. A true answer with no span is discarded by code.
Keep every string short. Be terse. Do not explain your reasoning.

QUESTIONS:
  solana_activity                 does the page evidence this entity doing something on Solana?
  transaction_volume_evidence     does the page state volume, trades, swaps, users or TVL?
  latency_sensitive               does the page evidence trading, market-making, arbitrage,
                                  liquidations or execution where speed decides the outcome?
  reliability_pain                does the page evidence failed transactions, congestion,
                                  outage or settlement difficulty?
  is_competitor                   is this entity itself an RPC or Solana infrastructure vendor?
  infrastructure_owner_identified does the page name an engineering, infrastructure or
                                  trading-systems owner at this entity?

ALSO RETURN:
  tier          1 = Solana-native prop firm, arb desk or MEV operator
                2 = Solana DEX, aggregator or exchange
                3 = wallet, payments or consumer app
                null if the page does not support any of these
  services      sender_max, sender, laserstream, webhooks, parsed, rpc, validator, enterprise
                Return [] if the page does not support any.
  why           one sentence: why this may matter to a Sender BD team
  counter       one sentence: why it may NOT matter. MANDATORY. Never empty.
                If you cannot think of one, you have not understood the evidence.
  counter_rule  "no_gap" | "incumbent_may_cover" | "competitor" | null
```

**Two code guards sit behind this prompt:**

```js
// A true field with no supporting span is downgraded to false.
// The model may assert; it may not assert without evidence.
if (gate[k] === true && k !== 'is_competitor' && !spans[k]) gate[k] = false;

// A field the model OMITTED is not evidence either - it defaults to false.
for (const k of GATE_FIELDS) gate[k] = (p.gate && p.gate[k]) === true;

// No counter-rationale, no row. The counter is not optional.
if (!p.counter || p.counter.trim().length < 10) reject('MALFORMED_JSON');
```

The second of those was a bug found in the last run: one row came back missing
`infrastructure_owner_identified` entirely, and a missing field must mean *not
evidenced*, not *absent from the row*.

---

## 4 — Scorer · **PURE CODE, NO MODEL**

```js
export function score(row) {
  let base = 0;
  for (const k of Object.keys(RUBRIC_MAX)) {
    const v = Number(row.rubric?.[k] ?? 0);
    base += Math.max(0, Math.min(RUBRIC_MAX[k], v));   // CLAMP
  }
  const pen = (row.penalties || []).reduce((a, p) => a + Number(p[1] || 0), 0);
  return Math.max(0, base + pen);
}
```

| Factor | Max | Filled from |
|---|---|---|
| Transaction-volume signal | 25 | `gate.transaction_volume_evidence` |
| Latency sensitivity | 20 | `gate.latency_sensitive` |
| Reliability pain | 15 | `gate.reliability_pain` |
| Product fit | 15 | `services.length > 0` |
| Reachability | 15 | `gate.infrastructure_owner_identified` |
| Recency | 10 | computed from the event date |

**The rubric is filled from the gate booleans, in code.** The model never supplies a
number, and `Math.min` means a model returning `txVolume: 9999` gets 25. Asserted in
the selftest.

---

## 5 — Gate · **PURE CODE, NO MODEL**

```js
if (row.blocked)                  return 'BLOCKED';
if (row.gate.is_competitor)       return 'COMPETITOR';
if (!row.gate.solana_activity)    return 'NO_ACTION';

// The counter-rationale is a VETO. It may lower a verdict; never raise one.
if (counterRule === 'no_gap' || counterRule === 'incumbent_may_cover')
  capTo('RESEARCH', reason);

if (!row.gate.infrastructure_owner_identified) capTo('QUALIFY', 'No infrastructure owner identified.');
if (lensKey !== PRIMARY_LENS)                  capTo('QUALIFY', 'Extension lens, not the primary motion.');
```

**Fixed this session:** the counter-rule was *promoting* 39-point rows to Research.
A veto that can raise a verdict is not a veto. It now caps only, and two assertions
hold it there.

---

## 6 — Writer · `gemini-2.5-flash-lite` · internal brief only

```
YOUR JOB: write the internal technical discovery brief for ONE qualified row.

This is for the BD team's own eyes. You are NOT writing to the prospect.
Do not draft an email, a subject line, a greeting or any outreach copy.
If you produce outreach it will be discarded and the run will be marked failed.

The brief must be honest about ignorance. "What we do not know" is the most
important section and must never be empty.

Return JSON exactly:
{"brief":{
  "why_now":"one sentence, grounded in the quote",
  "blocker":"the single thing stopping this being actionable",
  "next_action":"one concrete research step, not an outreach step",
  "unknowns":["at least three things we do not know"],
  "would_disqualify":["at least two things that, if true, would kill this lead"],
  "ask":"the one technical question to put to them when we do reach them"
}}
```

Backed by a code check that bins the brief if it contains outreach anyway:

```js
if (/subject:|dear |hi there|best regards|kind regards/.test(blob)) row.brief = null;
```

---

## What the prompts actually produced

`run-2026-11-04T22-41-11` — 8 sources, 32 candidates, **8 verified, 0 qualified.**

| Rejected | n | Meaning |
|---|---|---|
| `DATE_OUT_OF_WINDOW` | 19 | Index pages carry years of posts. Working as intended. |
| `CLAIM_NOT_SUPPORTED` | 4 | Real quote, overreaching claim. **The prompt caught its own model.** |
| `DUPLICATE` | 1 | |

| Survived | Score | Volume | Latency | Verdict |
|---|---|---|---|---|
| Pump, Orca, Raydium, BisonFi, Bitwise | 39 | **yes** | no | No action |
| Phoenix | 31 | no | **yes** | No action |
| Samsung | 19 | no | no | No action |

Real figures came through — Pump $321m/24h, Orca $309m, Raydium $227m. But
`latency_sensitive` is false on every volume row, so **Sender never fired**.

**That is the prompts working, not failing.** DefiLlama states volume and says nothing
about execution pain, so the Enricher correctly answered false rather than inferring.
The ceiling is the sources: index pages carry figures, not the words a firm uses about
its own latency. Article-level fetching is the next move, and it costs more per run.

---

## Costs

| Stage | Calls | Model | Cost |
|---|---|---|---|
| Collector | 8 | gemini-2.5-flash-lite | ~$0.004 |
| Verifier | 1 | gemini-2.5-flash-lite | ~$0.0003 |
| Enricher | 9 | gemini-2.5-flash-lite | ~$0.004 |
| Writer | 0 | — | $0 (nothing qualified) |
| **Total** | **18** | | **$0.0092** |

Priced from NEAR AI's own `/models` catalogue at run time, never hardcoded.
**$10 of credit ≈ 1,000 runs.**

### Model choice was measured, not assumed

| Model | Result |
|---|---|
| `zai-org/GLM-5.1-FP8` | **Not in the catalogue.** It is in NEAR's own quickstart doc. |
| `z-ai/glm-5.3-flash` | Reasoning model. Spent **2,500 of 2,500** output tokens reasoning, emitted zero content. |
| `google/gemini-2.5-flash` | Also reasons: 2,110 of 2,186 tokens. Truncated mid-JSON. |
| **`google/gemini-2.5-flash-lite`** | **166 tokens, 1.5s, clean JSON.** 11× faster and ~140× cheaper. |

That one swap took a run from **$0.10 to $0.0092**.
