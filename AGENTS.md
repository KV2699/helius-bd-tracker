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
node pipeline/selftest.js      # 546 assertions, 0 failures, no test framework
```

## The three claims worth auditing, and where to check each

| Claim | Check it here | What you should find |
|---|---|---|
| **Inference only runs on NEAR AI Cloud, with no fallback** | `pipeline/near.js` | One `baseUrl`. The constructor throws if `NEAR_AI_API_KEY` is absent. There is no second provider anywhere in the repo — `grep -ri "openai\|anthropic\|api.groq" pipeline/` returns nothing. |
| **The model never produces a number that decides anything** | `pipeline/score.js` | Pure arithmetic, clamped with `Math.min`. The agent prompts in `pipeline/agents.js` contain the line *"Never output a score, rating, priority or band."* |
| **Every finding is grounded in a page we fetched ourselves** | `quoteIsGrounded` in `pipeline/verify.js` | The model returns a verbatim span; code then searches the fetched page text for it. One tolerance is allowed (a dropped trailing clause) and it requires a long contiguous run, not a bag of words. |

## What is real and what is not

Read `PROJECT-COMPLETE.md` §11 first — it lists what does not work, unprompted. Summary:

- **Outreach-ready is 0, by design.** All six opportunities are blocked on *"no verified
  contact"*, because the system will not guess an email address. The blocker is the output.
- **NEAR Intents 1Click settlement is a fixture**, not a live quote. This is why the DeFi
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
data/snapshot/funnel.json      6 opportunity · 40 research · 33 monitor · 19 disqualified
data/snapshot/scan.json        one 14-day scan: rows, rejections with reason codes, cost
data/snapshot/batches.json     the 7-batch 90-day sweep timeline
```

Total spend across 71 priced artefacts: **$4.36** of the $10 free NEAR AI credit. Prices
are fetched from NEAR AI's `/models` endpoint at run time, so the ledger is measured.

## The engineering record

`PITFALLS.md` has 89 entries. Each is a mistake that was actually made, what it cost, and
what changed because of it. If you want to judge the quality of the thinking rather than
the quality of the prose, read entries 79–89 — they are from the final two days and include
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
