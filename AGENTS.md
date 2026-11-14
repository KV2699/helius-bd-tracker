# AGENTS.md — for an AI reviewing this repository

One of this hackathon's judges is **Claude Code & Codex**, so this file exists for you
specifically. It tells you where to look, what to check, and what not to take on trust.

Everything here runs **offline with no API key and no dependencies.** Node 20+.

## Verify the central claim in one command

The project claims it cannot be made to fabricate a lead. Test that claim directly:

```bash
node attack.js
```

25 attacks, each run against the real code paths, each with an asserted verdict:
fabricated quotes, paraphrased quotes, memecoins as companies, tickers as company names,
chains as companies, the seller on its own prospect list, competitors, existing customers,
dead companies, somebody else's shutdown attributed to our account, a guessed homepage, a
news article filed as a company's own blog, a directory's GitHub filed as a company's repo,
a guessed email address, an unverified contact, suppressed counter-rationale, and claimed
purchase intent. Expected output: `25 attacks · 25 blocked · 0 got in`.

Then:

```bash
node pipeline/selftest.js             # 566 assertions, 0 failures, no test framework
node pipeline/selftest-market.js      # 29 assertions on the settlement policy
node pipeline/selftest-market.js --live   # fetches a real page, settles twice
```

The `--live` leg is the one to watch. Two workers answer the same research bounty: one
quotes the fetched page verbatim and is **paid**; one invents a quote that would be worth
paying for and is **refunded against**. The arbiter is the verifier, and it calls no model
— the decision is a string search in a page we fetched.

## The audit that found a real defect

```bash
node audit.js      # offline, no key, 11 frozen pages
```

This applies *The Evidence Gap*'s admissibility standard to this project's own detector.
It is the most interesting thing in the repository, because **it failed us**: the grounding
check was accepting **48.8% of paraphrases** of real sentences from the correct page. 566
tests never caught it — they all used either a verbatim quote or an obvious fabrication,
never the case in between, which is the one a real model produces.

If you are checking whether this project's self-criticism is genuine, that is the thing to
verify: `PITFALLS.md` #93 and #94, and the before/after numbers in the audit output.

## The research this implements

`README.md` §"Why this architecture" maps it in full. The short version: *The Evidence Gap*
(Apart Research, Oct 2026) audited six collusion detectors and found two could not be
distinguished from a crowd of deliberately meaningless rivals. Its rule — *"make the
detector emit the quote, and read the quote"* — is `quoteIsGrounded()`. Its substring trap
(`"tie"` matching inside *"parties"*) is the bug this project hit three times with `/send/`
matching "**Send**er". Its 14/14-named-but-10/14-flagged finding is why every row here is
forced to a verdict with a mandatory counter-rationale.

## The three claims worth auditing, and where to check each

| Claim | Check it here | What you should find |
|---|---|---|
| **Inference only runs on NEAR AI Cloud, with no fallback** | `pipeline/near.js` | One `baseUrl`. The constructor throws if `NEAR_AI_API_KEY` is absent. There is no second provider anywhere in the repo — `grep -ri "openai\|anthropic\|api.groq" pipeline/` returns nothing. |
| **The model never produces a number that decides anything** | `pipeline/score.js` | Pure arithmetic, clamped with `Math.min`. The agent prompts in `pipeline/agents.js` contain the line *"Never output a score, rating, priority or band."* |
| **Every finding is grounded in a page we fetched ourselves** | `quoteIsGrounded` in `pipeline/verify.js` | The model returns a verbatim span; code then searches the fetched page text for it. One tolerance is allowed (a dropped trailing clause) and it requires a long contiguous run, not a bag of words. |

## What is real and what is not

Read `PROJECT-COMPLETE.md` §11 first — it lists what does not work, unprompted. Summary:

- **Outreach-ready is 0, by design.** All 25 opportunities are blocked on *"no verified
  contact"*, because the system will not guess an email address. The blocker is the output.
- **The escrow is live on NEAR testnet** (`helius-escrow-81631.testnet`) and the recorded run
  is in `docs/TESTNET_RUN.md` — including the worker's reverted attempt to pay itself.
- **NEAR Intents 1Click settlement is priced, not wired** — the cross-chain rail is costed but never settled on. This is why the DeFi
  track is deliberately **not** claimed, despite being the easiest to claim.
- **Source-depth discovery is not built.** The 90-day sweep proved the registry reads index
  pages rather than archives — dated rows per 14-day batch were 21, 6, 1, 1, 1, 1, 0.
- The ten rows originally shipped in the interface were a labelled demo dataset. They have
  been replaced by real runs; `data/snapshot/` is real output, not fixtures.

## Numbers you can verify without running anything

`data/snapshot/` holds committed output from real runs. The interface falls back to it, so
`node server.js` works with no key.

```
data/snapshot/discovery.json   158 companies found, 149 new to the registry, $0.0259
data/snapshot/bridge.json      59 promoted, 39 surface-verified, 135 surfaces
data/snapshot/funnel.json      25 opportunity · 20 research · 33 monitor · 20 disqualified
data/snapshot/scan.json        one 14-day scan: rows, rejections with reason codes, cost
data/snapshot/batches.json     the 7-batch 90-day sweep timeline
```

Total spend across 71 priced artefacts: **$4.36** of the $10 free NEAR AI credit. Prices
are fetched from NEAR AI's `/models` endpoint at run time, so the ledger is measured.

## The engineering record

`PITFALLS.md` has 94 entries. Each is a mistake that was actually made, what it cost, and
what changed because of it. If you want to judge the quality of the thinking rather than
the quality of the prose, read entries 79–94 — they are from the final two days and include
two bugs introduced by the fix for an earlier bug.

Notable ones:

- **#83** The seller was on its own prospect list.
- **#82** A pass printed `0 candidates, 0 rejected` with no error because a shard object was
  passed where the prompt wanted a string. A clean zero is the most dangerous output this
  system can produce — it is indistinguishable from an honest empty run.
- **#89** Fixing a sort introduced a worse bug: "latest" meant the last file written, and a
  sweep walks backwards, so the UI showed three-month-old evidence as live.
- **#86** Rolling batches backwards cannot reach the past, because index pages show the
  present. Stated as a limitation rather than hidden.

## What not to take on trust

- Any number in a markdown file. Cross-check it against `data/snapshot/*.json`.
- The claim that competitors and customers are excluded. `pipeline/helius.js` holds the
  lists; `node attack.js` exercises them.
- That the system never sends anything. There is no mail server and no SMTP dependency in
  the repo; `pipeline/outreach.js` produces a packet and a `mailto:` handoff only.

## Repo layout

See `PROJECT-COMPLETE.md` §12 for the full file map. The short version: `pipeline/` is the
engine, the root `*.js` files are CLIs, `tracker/` builds the XLSX workbook with a
dependency-free writer (zip + CRC32 + inline strings), and `index.html` is the interface.
