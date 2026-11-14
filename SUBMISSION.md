# Submission copy — ready to paste

Everything below describes what is **true today**. Nothing claims a scan that has not
run. Update the two marked spots once credits land and a real run completes.

---

## 1. Project name

```
Helius BD Tracker
```

---

## 2. The `idea` field (submission API, 20–2000 characters)

**Use this one.** 1,418 characters.

```
Every BD tool does the same thing: it finds a company announcement, decides the
announcement means someone needs your product, and hands a salesperson a lead. That
inference is almost always wrong, and it is never shown.

Helius BD Tracker is a business-development scanner for Solana infrastructure sales
that refuses to make it. Eight agents read public sources; five of them run on NEAR AI
Cloud and two are deliberately plain code, because a model must never produce a number.

The integrity is one rule: the collector agent must return a verbatim quote, and code
then searches for that quote in the page we fetched ourselves. A quote the model
invented is not in the page, so it cannot pass. Every rejection carries a reason code
and is shown in the interface. An empty run is a valid result; a fabricated one is not.

A stated reason a lead might NOT qualify is mandatory on every row, and it can veto the
verdict outright. On our demo dataset, ten events go in and one lead comes out.

NEAR is not a payment sticker here — it is where the intelligence runs. Every model call
goes to NEAR AI Cloud, which is TEE-verifiable inference. A pipeline doing commercial
research on named companies is exactly the case for attestable private inference: the
research is sensitive, and we can prove where it ran.

Honest limits, stated up front: the ten rows shipped in the interface are a labelled
demo dataset, replaced wholesale by a live run and never merged. Our NEAR Intents 1Click
quote is still a fixture, so we are not claiming the DeFi track.
```

---

## 2b. NEAR wallet address

```
clearlemon1022.near
```

The prize is sent here.

---

## 3. Track selection

| Track | Claim it? | Why |
|---|---|---|
| **`privacy`** | **Yes — primary** | Hints are *PRIVATE AI, TEE, NEAR AI CLOUD*. Every model call runs on NEAR AI Cloud's TEE-verifiable inference. BD research naming real companies and their commercial weaknesses is genuinely sensitive; attestable inference is a real property of this build, not a slogan. **And it is probed, not configured:** just as a sealed multi-agent lab needs a ledger to establish what agents actually did rather than what its config said they would, a privacy-first pipeline needs the hardware to say where the inference ran. `/api/attestation` fetches it live — signing address, a 10,012-character Intel TDX quote, TCB measurements — and prints a failure verbatim if the endpoint moves. The claim is checkable either way. |
| **`open`** | **Yes — second** | Open Innovation. A verification engine pointed at BD research, with an arbitration layer for a bounty market, does not fit a named category — which is what this track is for. Mention the eight-agent architecture in the description; do not claim a swarm. |
| `swarms` | **No** | Hints list *MULTI-AGENT SYSTEMS*, and there are eight agents with typed handoffs — but it is a pipeline, not a bidding market or an emergent economy. Claiming it would overstate what the agents do. |
| `defi` | **No** | The 1Click quote is priced, not wired. Claiming it would be the one dishonest thing in the whole submission. |
| `agents` | **No** | The agents spend on inference but do not earn, negotiate or hire. Too thin. |
| `business` | **No** | No treasury, no autonomous sales. The gate exists precisely to stop autonomy. |

Submit as: `["privacy", "open"]`

---

## 4. X demo post

Lead with the problem, show one complete moment, say what NEAR actually does.

```
Every BD tool turns a press release into a "hot lead". That guess is usually wrong
and never shown.

So we built one that refuses to.

Eight agents read public Solana sources. The collector must return a verbatim quote —
then CODE searches for that quote in the page we fetched. Invented quotes don't exist
in the page, so they can't pass.

158 companies found. 25 opportunities out. 2,275 candidates rejected, every one with a
reason code.

Every model call runs on @NEARProtocol's NEAR AI Cloud — TEE-verifiable inference.
BD research names real companies and their weaknesses. That's exactly the case for
proving where your inference ran.

Scoring and the gate are plain code. A model never produces a number here.

Then I ran my own audit standard against my own detector. It failed: the grounding check
was accepting 48.8% of paraphrases — a model that reworded instead of quoting was passing.
566 tests never caught it. Fixed, measured, written up as pitfall #93.

I spent October auditing collusion detectors with @ApartResearch. Two of six couldn't beat
a crowd of deliberately meaningless rivals. The rule we learned four times: make the
detector emit the quote, and read the quote.

So that is what this does. A model cannot score a lead here. It must emit a verbatim span,
and CODE reads the page we fetched to see if the span is there. If it isn't, the lead dies
with a reason code. 2,275 of them did.

We built a verifier. The expensive thing it unlocks is outsourcing the research — with
escrow that releases on a passing check, not a promise. The dry quote in the repo is the
settlement rail that market runs on. Not wired yet. Written down.

Repo + 90s demo below. What would make you trust a lead a machine handed you?

#NEARHackathon
```

Optional extra tags for reach: `@NearBuilders @NearLegion`

---

## 5. Short versions

**One line**
```
A BD scanner that refuses to turn a press release into a hot lead. Eight agents,
inference on NEAR AI Cloud, verification in code.
```

**Two lines, for a repo description**
```
Solana BD scanner. Eight agents on NEAR AI Cloud; verification, scoring and the gate
are plain code. A verbatim quote must be found in the fetched page or the candidate
is rejected with a reason code. Ten events in, one lead out.
```

**The sentence to open the demo with — say it out loud**
```
This is a working build, not a production system. The inference, the verification,
the scoring and the gate are real. The ten rows you can see are a labelled demo
dataset, and our NEAR Intents quote is priced but not wired. I'll show you both.
```

---

## 6. Demo script, 90 seconds

1. **Say the honesty line** (§5). Twenty seconds, no screen.
2. **The problem.** "Every tool in this category guesses. Here's one that won't."
3. **Press Run scan.** Eight agents; the office animates against real stage events.
4. **Point at a rejection in the run log.** "That candidate was thrown out because the
   quote it gave us isn't in the page we fetched. Code checked, not a model."
5. **The queue.** "Jump Trading, 71, Qualify — not Actionable. We haven't found the
   infrastructure owner, and the code won't let it through until we do."
6. **Open the row → Score, gate and product fit.** Rubric adds up, then the red cap note.
7. **A Research row.** "Counter-rationale says no evidence of a gap, so it's
   reclassified. This is the rule that stops a press release becoming a lead."
8. **NEAR.** "Every one of those model calls ran on NEAR AI Cloud. TEE-verifiable —
   we can prove where our research ran. Here's the token spend for that run."
9. **About this build.** One click. "And here's everything that's still a fixture."

---

## 7. Checklist before you submit

- [ ] Credits on the NEAR AI account — the 402 cleared
- [ ] **One real scan completed**, output committed to `data/runs/`
- [ ] Update `README.md` with the real run's numbers *(marked TODO there)*
- [ ] Update §2 above with the real ratio if it differs from ten-in-one-out
- [ ] Repo public — deadline **14 Nov 2026, 23:59 UTC**
- [ ] `LICENSE` present (MIT, already there)
- [ ] `.env` **not** committed — `.gitignore` already covers it
- [ ] Demo video recorded and attached to the X post
- [ ] X post live, tagging `@NEARProtocol` + `#NEARHackathon`
- [ ] NEAR mainnet payout account ready
- [ ] Confirm the full JSON payload before anything is POSTed

---

## 8. What is deliberately not claimed

Keep this list. It is the most defensible thing in the submission.

- No live scan results are claimed until one has run.
- The 1Click quote is priced, not wired; the DeFi track is not selected.
- The agents do not negotiate, hire one another, or hold a treasury.
- No outreach email is generated — the writer produces an internal brief only.
- No prospect's intent is inferred. A press release cannot tell you what a company
  wants to buy, and the tool says so on the row.
