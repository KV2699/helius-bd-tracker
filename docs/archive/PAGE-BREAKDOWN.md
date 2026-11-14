# Page breakdown — every section, and why it is there

**Live:** https://claude.ai/code/artifact/690b0e5f-4577-481c-aad4-5a17b028df8b

One scroll, five bands, one modal. Below is what each one contains, what it is *for*, and
the choices I made — including the ones I'd argue about.

---

## The governing rule

Every band is the same two-column grid: **the argument on the left, the artefact on the
right.** Left column is sticky, so the claim stays on screen while you work through the
evidence beside it.

That is not decoration. It is the product's thesis in layout form: *a claim is never shown
without the thing that backs it.* The same rule governs every row in the queue (why / why
not / source) and every deliverable in the modal (draft / evidence / counter-rationale).

If a block could not be paired with an artefact, it did not earn a place on the page.

---

## 1 — Navigation

**What:** a floating pill. `Queue · Office · Method · Output`, then **About** in lime,
separated by a rule. Ticker underneath.

**Why five, not six.** "Motion" was a destination for something that is context, not a
place. The motion now shows as the hero eyebrow and the primary lens badge.

**Why a pill, not a bar:** it reads as a tool, not a marketing site, and it does not eat a
fixed strip of every viewport.

**Why "About this build" is set apart:** it is the only item that is not part of the
product. The rule and the colour change say *this is a different kind of thing*, so a judge
finds it instantly and a user ignores it.

**The ticker** carries the four claims the build stakes itself on — one motion, the
counter-rationale veto, tier 1 and 2 only, nothing sends without a human. It is the one
place I allowed sloganeering, because it is four seconds long and out of the way.

---

## 2 — Hero

```
Sender - Solana trading - fixture scan 3 Nov 2026

Stop a press release
becoming a hot lead.

Ten Solana events. One Sender lead.
Research-first. Nothing sends without approval.

[Open the queue]  [Watch the run]
```

Single column, full width, generous space. No panel on the right.

**Why it shrank twice.** It was the honesty card, then a counts table, then a result card,
and now four lines. Each cut came from the same question: *does this change what I do next?*
A hero cannot, so it should only make the claim and get out of the way.

**"Ten Solana events. One Sender lead."** does the work the three previous versions were
attempting. It is the result, the ratio and the restraint in seven words, and it earns the
scroll because the obvious next question is *which one, and why only one?*

---

## 3 — The office

**Left:** `Nothing leaves without your click.`
**Right:** the approvals rail and the 3D room.

### Why the office exists at all

The honest answer: because a multi-agent architecture is invisible otherwise, and an
invisible architecture gets no credit. The dishonest version of this is a cartoon over a
black box. The test I held it to was: **if you deleted a robot, would a stage of the run
disappear?** Six robots, six stages. There is no seventh doing nothing.

### Why the approvals are a left rail, not a separate page

Because the gate is not a step in a workflow — it is a *standing condition*. Four things
are drafted and none of them can move. Putting them beside the room, permanently, makes
that condition visible rather than something you navigate to.

### Why glassmorphism and no floor

You asked for it, and it turned out to serve the content: with no floor, the agents read as
*processes* rather than as office workers. The room is a diagram that happens to be
beautiful, which is the right order of priorities.

### Why the document flies

It is the only part of the animation that is strictly information. You can see *what* is
being handed over and *who* has it. The radar says who is working; the confetti says the run
is done. Three signals, no filler.

---

## 4 — Queue

**Left (sticky):** scan date, three counts, the primary lens, and "Other lenses" collapsed.
**Right:** four tabs and the rows.

### The row is five fields

```
71   Jump Trading                                     QUALIFY
     Tier 1 - Sender Max - LaserStream

     WHY NOW   Supporting Securitize Stocks liquidity on Solana.
     BLOCKER   No infrastructure owner identified.
     NEXT      Identify the trading-infrastructure owner.
               Ask about the current Solana send path.
```

That is the whole decision: who, how strong, what fits, why now, what is in the way, what
to do. Nothing else appears until you open the row.

Opening it gives the verbatim quote with its source, why it may matter, why it may not -
and then one more disclosure, **"Score, gate and product fit"**, holding the rubric
arithmetic, the five gate chips and the product-fit line. The method is still there; it is
just no longer shouting at someone trying to work.

### The lenses

One primary button. Five others behind **"Other lenses - schema demos, capped at Qualify"**,
collapsed by default and opening automatically if you are in one.

They are selectable, the extension cap is enforced in `assess()`, and the subtitle changes
when you switch. But a BD person working the Sender queue does not need five roadmap tabs in
their eyeline, so they are one click away instead of in the way.

### Four tabs, not six

**Queue** (who to work) - **Evidence** (what backs it) - **Timeline** (when) - **Missing**
(what we do not know). Gate and Products were useful views of ten rows and redundant as
destinations; both now live inside the row.

---

## 5 — Method

**Left:** `How a verdict is reached.` / *Score, then caps. Every cap shows its reason on
the row.*
**Right:** the rubric table, the caps table, the rejection log.

The old heading here was *"The counter-rationale is a veto, not a caption"* - a good line,
and an argument rather than a reference. It moved to About. This band shows the rules; it
no longer narrates their virtue.

### Why this band exists

Because the single most likely judge question is *"how did you get that number?"* — and the
answer should be on the page, not in my head.

### The one idea here

Most tools of this kind carry a "risks" or "considerations" field that changes nothing. Here
the counter-rationale is **load-bearing**:

```
counter: "no evidence of an infrastructure gap"   →  reclassified to Research
counter: "an incumbent may already cover this"    →  reclassified to Research
```

Securitize scores 26 and lands in **Research** — not because someone typed it, but because
its counter-rule fired. That is what stops *"Securitize expanded its catalogue"* becoming
*"Securitize needs Helius."*

### The design decision I would defend hardest

**The verdict is not in the schema.** A row carries a rubric, a gate object and a
counter-rule. `assess()` computes the band, then the caps override it. Nobody can promote a
row by typing a better word into it — and the UI can always show *why* a row is capped.

That one choice is what moved this from a thing that scores to a thing that qualifies.

---

## 6 — Output

**Left:** `A BD brief, not a summary.`
**Right:** the brief, the NEAR ledger.

### Why the brief is five sections and an appendix

It answers the Monday questions in order: **ready for research, held, no action, missing
information, recommended next actions.** That is one page.

Evidence concentration and the refused-claims log were sections 5 and 7; they are now an
**appendix after a page break**. They are what make the first five trustworthy, so they stay
in the printed PDF - but a BD person reading the brief on Monday should reach the actions
before the audit trail.

### Why the deliverables are previewable and editable

A draft you cannot see is a draft you cannot trust. Each one renders as the real thing — a
letterheaded document, or an email as it will arrive — with a toggle to edit the wording
before approving. **Save as PDF** uses a print stylesheet that hides the entire app.

### The email, deliberately

There is no mail server and there never will be. You type an address, your own mail client
opens with the approved wording. **The send is yours, not the agent's.** That is not a
limitation I worked around; it is the product's position, implemented.

---

## 7 — About this build *(modal, from the nav)*

**What:** the real/fixture table, the ICP tiers, the schema, the limits, the track positions.

**Why it is not on the page.** You asked the right question: *does a judge want this in the
interface, or in the demo video?* Neither answer is "in the hero."

This material defends the build. It does not do the work. A BD person opening a tracker
should not scroll past a disclaimer to reach the queue — and a judge who wants the
disclosure finds it in one click, in one place, complete.

The same content belongs in the **demo video's first twenty seconds** and the Devpost
README. Said aloud, it is credibility. Printed above the product, it is an apology.

---

## What I would change next, in order

| | Change | Why |
|---|---|---|
| 1 | Wire the 1Click `dry:true` quote to the live endpoint | It is the difference between using NEAR and depicting it. Until then the track stays unselected. |
| 2 | Run real collectors into the same schema | The views will not change. That is the claim, and it should be demonstrated rather than asserted. |
| 3 | A second cleared row | One cleared lead proves the gate works. Two would prove the gate is not just set too high. |
| 4 | Infrastructure-owner enrichment | It is the single cap blocking the only live lead. Lift it and the system produces its first Actionable — honestly. |

---

## The three sentences that carry the whole thing

> **Ten rows in, one out.**
> **The verdict is computed, not typed.**
> **Nothing leaves without your click.**

Everything on the page is in service of one of those, or it is not on the page.
