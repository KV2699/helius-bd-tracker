# What came out of `images/` — and what did not

40 screenshots, all TikTok, almost all from one account (**@AI Flow Lab**, plus one
reposted **@Daniro** clip). Four distinct videos. Read 2026-11-06.

| Frames | Video | What it shows |
|---|---|---|
| 0454–0478 | *GROK on Polymarket* (Daniro repost) | An Aroon-based bot. On-screen framing: **DIRECTION → STRENGTH → FILTER**. Claims $268,805 over 177 days. |
| 0479–0483 | *$29.73 to ChatGPT* | Light-theme trading dashboard: huge balance figure, labelled stat row, generated morning brief, live execution log, winning-wallet tracker. |
| 0484–0488 | *AI trader with its own web crawler* / *Phil, the self-improving trader* | **Isometric 3D agent office** with named agent panels: ANALYST · SKEPTIC · JOURNAL · CRAWLER · APPROVAL. Repo text: *"Three layers keep it honest"*, scores its own calibration against the price it paid, capped stakes, commits the diff. |
| 0489–0493 | *Claude: $50 → $4,378 in 72 hours* | DOM ladder, pair-matrix radial, GEX radar, session-balance panel. *"scored every pair by liquidity, spread, and depth"*. |

---

## Taken, and already built

### 1. The Skeptic deserves a desk
The strongest single idea in the folder is a frame from 0484: an office where one of the
named agent panels is **SKEPTIC**.

We already had the thing — the counter-rationale that can veto a verdict, enforced in
`score.js`. It just had no face. The one stage that can *kill* a lead was the one stage a
demo never showed, which is a strange thing to hide in a product whose entire pitch is
refusing to invent leads.

**Done:** Skeptic is now the fourth desk, sits on the document's route (`verifier →
skeptic → scorer`), and the handoff caption reads *"counter-rationale stated"*. The veto
stays in code — a veto a model could talk itself out of is not a veto.

### 2. The Crawler deserves a desk
Same frame names a **CRAWLER**. We shipped `pipeline/operators.js` (HX-GA2) yesterday and
it was invisible on the floor.

**Done:** Crawler is the second desk, captioned *"Finds the operators a protocol does not
run"*. The office went 6 desks → 8, in four columns, with the room widened and the camera
pulled back. Every stale "six agents" string across the interface and the four docs is
updated — 20 of them.

---

## Taken, worth building next

### 3. "Three layers keep it honest" → a calibration record
From 0486–0487: the agent *scores its own calibration against the market price it paid*
and reviews its own mistakes on a cadence.

We have no equivalent, and it is the most useful idea in the folder. Every verdict this
system issues is a **prediction** — that a row was or was not worth approaching — and we
never check them. A calibration tab would record each verdict, revisit the account on a
cadence, and report how often Research rows turned out to deserve Qualify, or Qualify rows
turned out to be nothing.

That is the honest version of what these videos fake: not "the bot made money", but **"of
the last 40 verdicts, here is how many held up."** It is also the strongest possible answer
to a judge asking why anyone should trust the gate.

### 4. The stat row, with our own metrics
0481 carries a labelled stat strip — `SLIPPAGE LATENCY 2.0ms · block-time edge`,
`PATTERNS EXTRACTED 18 · recurring pump signals`. The pattern is good: a metric, its unit,
and a one-line gloss of what it means.

Ours would be verification-shaped: *claims grounded · quotes rejected · surfaces that
redirected · cost per verified row*. We have all four numbers and currently show none of
them as a strip.

### 5. Layout confirmation
0482 and 0483 are the closest thing in the folder to our own aesthetic — light ground,
thin rules, a dominant figure, a dense tabular panel beside a chart. Worth knowing our
two-column band and 80px gutters are not an outlier; the better-looking references land in
the same place.

---

## Deliberately not taken

**Every claim in these videos.** $268,805 in 177 days, $50 → $4,378 in 72 hours, $63 →
$8,980 in three nights, $29.73 → $29,673. Unverifiable screenshots from growth accounts
whose call to action is *"comment GROK and follow on Instagram for the guide."* None of it
enters this repo as fact, and none of it is cited anywhere.

**The returns framing.** Every one of these leads with a number that went up. The whole
argument of this build is that a BD tool should be judged on whether its claims are
checkable, not on how good its best week looked. Importing a P&L hero would contradict the
product.

**The radial / spiky-sphere visualisations** (0462, 0489, 0490). Striking, and they encode
almost nothing a table would not encode better. We have one 3D scene that earns its place
because each object is a real pipeline stage; a second decorative one would dilute it.

**The Aroon strategy itself** (0454–0478). It is a momentum-trading indicator. We sell
transaction landing to infrastructure owners. No relevance beyond the three-word framing.

---

## One line worth stealing outright

**DIRECTION → STRENGTH → FILTER.**

Three words, in order, that tell you what the system does. Ours is
**EVIDENCE → COUNTER → GATE** — find what they said, state why it might mean nothing,
then let code decide. If the demo needs a spine, that is it.
