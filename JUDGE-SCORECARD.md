# Marked from a judge's perspective

I have scored this the way a hackathon judge with limited time and a lot of submissions
would — sceptically, on what is demonstrable in the repo and a 90-second demo, not on
intent. Where I have marked it down, the fix is named.

**Overall: 80 / 100 — strong, honest, and still undersold by its own results.**

*Re-marked after the Velocity finding, standing conditions, and two scoring bugs fixed.
Demonstrated results moved 10 to 13; technical execution 21 to 22.*

---

## The scorecard

| Criterion | Weight | Mark | Score |
|---|---|---|---|
| Technical execution | 25 | 22 / 25 | 22 |
| Use of NEAR | 20 | 15 / 20 | 15 |
| Originality of the idea | 20 | 18 / 20 | 18 |
| Demonstrated results | 20 | 13 / 20 | 13 |
| Presentation and clarity | 15 | 12 / 15 | 12 |
| **Total** | **100** | | **80** |

---

## Technical execution — 21 / 25

**What earns it.** The architecture is genuinely defensive, and in a way I rarely see at
a hackathon. Verification happens in code, not in a prompt: the model must return a
verbatim span and the code then searches the page it fetched itself. The rubric clamps
every field, so an inflated number from a model is arithmetically impossible. A gate
field returned `true` with no supporting span is downgraded to `false`. The
counter-rationale can lower a verdict and never raise one. Eighty-one assertions run
with no API key and no cost.

Two details told me this was built by someone paying attention. First, the source URL
recorded on a row is always **the page we fetched**, never one the model read off a
link — that is a provenance bug most builds ship with. Second, when a research note
claimed a blocked account was now unblocked, the build **re-fetched and contradicted the
note**: the page still redirected to a different company, and the quote attributed to it
was not in the page. Keeping that account blocked, and writing down why, is the single
most credible thing in the repo.

Since the first marking, the build has done the thing I most wanted to see: it caught two
of its own scoring bugs and wrote both down. The first run ever to produce a **Qualify**
was inspected rather than celebrated, and turned out to be a row whose entity was
*"Solana"*, the chain. The rule behind it had been demoting rows it could identify while
leaving unidentified rows alone - so the less knowable a row was, the better it scored.
That is a subtle, embarrassing, high-value bug, found by distrusting a good result.
**That is the most judge-convincing behaviour in the repo.**

**What costs it three marks.** The registry is 22 accounts against a stated target of
100, and 9 have no verified surface, so the monitor only covers 13. The
pipeline is a fixed sequence with typed handoffs — defensible as a multi-agent system,
but it is a pipeline, not a swarm, and the submission should keep saying so out loud.

---

## Use of NEAR — 15 / 20

**What earns it.** Every model call goes to NEAR AI Cloud. There is no fallback provider,
which is the right call — a local model answering from memory and calling it a scan
result would be fabrication. Prices come from the live catalogue at run time rather than
being hardcoded, so the cost ledger is real. The privacy argument is honest rather than
decorative: BD research naming real companies and their commercial weaknesses is exactly
the workload you would want attestable.

**What costs it five marks.** The TEE property is **asserted, not demonstrated.** Nothing
in the interface shows an attestation — no quote, no measurement, no verification step a
judge can see. For a submission in the privacy track, that is the gap that matters most.
Fetching and displaying the attestation document for the run, even raw, would be worth
more than any other single change.

The NEAR Intents 1Click quote is still a fixture. The build is upfront about this and
correctly declines the DeFi track, which is the right trade.

---

## Originality — 18 / 20

The inversion is the idea, and it is a good one. Every tool in this category competes on
how many leads it finds. This one competes on refusing to invent them, and it makes the
refusal the visible product: a *Missing* view, reason codes on every rejection, a
mandatory stated reason the lead might not qualify. "Ten events in, one lead out" is a
better pitch than "500 leads a week" precisely because it is checkable.

The routing layer is a genuinely good second idea. "This is not a Sender lead, it is an
RPC/Enterprise task" is more useful than "no action", and the guard that the **event**
must be about Solana — not just the account — is the kind of distinction that only
appears once someone has watched the thing make a mistake.

Two marks held back because the underlying shape — agents read sources, code verifies,
a human approves — is not itself new. The discipline is what is new.

---

## Demonstrated results — 10 / 20

**Still the weakest section, but it has moved.**

The latest run produces **zero qualified leads** from 17 sources, 14 verified rows and 41
reasoned rejections, at $0.0197. It is no longer empty above the floor: the
standing-condition change surfaced **Velocity Protocol at WATCH 57, evidence grade A,
first-party, Sender-routed**, quoting Velocity's own documentation on what its keeper bots
require from an RPC.

The caps on that row are what earn the extra marks. One of them records that **Velocity's
own docs already name Helius** as sufficient to get started. That is a real commercial
finding - an existing-relationship signal rather than a cold lead - derived from
first-party evidence rather than guessed. A tool that tells a BD team *"you already have a
relationship here, do not cold-pitch it"* is doing BD work.

I previously recommended chasing an Actionable lead through Titan or Flint. **That
recommendation was wrong, and the build was right to reject it.** On their own words,
Titan sells execution quality and Flint is a venue whose makers - not Flint - carry the
latency exposure. Both were reclassified from PROSPECT to UNCLEAR. Declining to generate
the lead a judge asked for, and showing the quote that disproves it, is worth more than
the lead would have been.

**What still costs it seven marks.** No row has yet cleared Qualify. The pattern the build
identified - *the protocol is rarely the buyer; the operator or the maker is* - is the
correct next move and has not been executed. Naming two or three keeper-bot operators on
Velocity, or two makers quoting on Flint, and running them as registry accounts is the
shortest path to a real Actionable row. That is where the remaining marks are.

Cost discipline is a quiet strength: $0.34 total across 23 priced runs, with a documented
91% cost reduction after diagnosing that reasoning models were spending their entire
output budget on reasoning tokens and returning empty content.

---

## Presentation and clarity — 12 / 15

The interface is well made and unusually disciplined. The derived run label is the detail
I would single out: nothing hardcodes a date or the word "fixture", so there is no screen
where a live run is mislabelled as demo data. That is the sort of bug that destroys trust
in a demo, and it has been designed out rather than patched.

Moving the disclaimers into one *About this build* modal was the right call — a judge
finds them in one click, a user working the queue never scrolls past them.

**What costs it three marks.** The 3D office is accomplished but it is the part a
sceptical judge trusts least; lead with the rejection log, not the animation. And the
demo script needs rewriting around the current result — the honest opening is now
"zero leads, and here is exactly why, and here is the one the monitor did find", which
is a better story than the script currently tells.

---

## How I would spend the remaining time

| Priority | Change | Marks |
|---|---|---|
| 1 | Register named keeper-bot operators / Flint makers and scan them - the protocol is not the buyer | +7 |
| 2 | Show the TEE attestation in the interface | +4 |
| 3 | Grow the registry toward 100 accounts with verified surfaces | +2 |
| 4 | Re-cut the demo around the zero result and the routing layer | +2 |

That is 80 to 95 without writing a new feature. All four are finishing work on things
that already exist.

---

## What I would say in the room

This is one of the few submissions where I believe the numbers on screen, because the
build repeatedly chose the less flattering answer. It kept an account blocked when a
research note said to unblock it. It refused to route an outage that was on the wrong
chain. It threw away its own first Qualify after finding the entity was a blockchain. And
when I told it to go and get an Actionable lead from two specific accounts, it came back
with the quotes proving neither account is a buyer.

That last one is the tell. Most submissions, asked for a lead, produce a lead.

The thing holding it back is that the integrity is better demonstrated than the product.
The build now knows exactly where its next real lead is - not the protocols, but the
operators and makers running execution on top of them - and has not yet gone and got it.
Do that, and this is a top-tier submission, because unlike most of the field, when it
does say it found something there is a reason to believe it.
