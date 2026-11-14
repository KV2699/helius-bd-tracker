# Submission requirements — audited against the hackathon page

Audited **14 Nov 2026, 12:45 UTC**. Deadline **14 Nov 2026, 23:59 UTC** — about 11 hours.

## The four stated requirements

| # | Requirement | Status | What is needed |
|---|---|---|---|
| 1 | Code written since the announcement counts | **MET** | Entire project built 4–14 Nov 2026 |
| 2 | **Publish the repository. Judges can't open a private one** | **NOT MET — BLOCKER** | Committed locally (`3da9af1`, 108 files). Needs a push to a **public** GitHub repo. Requires Kerrie's go-ahead: publishing is outward-facing and irreversible |
| 3 | **Post the demo on X** — say you built it at NEAR HACKATHON, tag `@NEARProtocol`, `#NEARHackathon`, attach video or screenshots | **NOT MET** | Only Kerrie can post this. Copy is drafted in `SUBMISSION.md` §4 |
| 4 | **Submit the form** with repository link *and* demo post link | **NOT MET** | Both links required; blocked on 2 and 3 |

## Form fields, and what we have

| Field | Value | Ready? |
|---|---|---|
| Project name | `Helius BD Tracker` | yes |
| Team lead | Kerrie Donaghue | yes |
| Email address | on file | yes |
| Team size | solo | yes |
| Tracks | `["privacy", "open"]` — reasoning in `SUBMISSION.md` §3 | yes |
| NEAR wallet address | **needed from Kerrie** — the prize is sent here | **no** |
| Repository link | pending the public push | **no** |
| Demo post link | pending the X post | **no** |
| What did you build? | 1,418-character answer in `SUBMISSION.md` §2 | yes |

## Secret audit, before anything is published

Run before the commit, and re-runnable:

```
.env staged?                         0 files
files containing the NEAR AI key     0
files containing the GitHub token    0
key-shaped strings (sk-/ghp_/pat)    0
.env tracked by git                  none
```

`.gitignore` excludes `.env`, `.env.*`, `node_modules/`, `.claude/`, run artefacts
(`data/runs/*.json`, `data/discovered/*.json`, `data/bridge/*.json`, `data/history.json`)
and `.DS_Store`. The code and the docs are the submission; run outputs are reproducible by
anyone with a NEAR AI key.

## What a judge can verify in five minutes

| Claim | How to check it |
|---|---|
| Inference really runs on NEAR AI Cloud | `pipeline/near.js` — one base URL, no fallback, aborts without a key |
| The model never scores | `pipeline/score.js` is pure arithmetic; `grep -n "Math.min" pipeline/score.js` |
| Quotes are really grounded | `quoteIsGrounded` in `pipeline/verify.js`, and `node pipeline/selftest.js` |
| Nothing is dropped silently | every rejection carries a `REASON` code; `data/runs/*.json` lists them |
| The honest-limits claims are honest | `PROJECT-COMPLETE.md` §11 and `PITFALLS.md` (89 entries) |
| It runs with no dependencies | `node pipeline/selftest.js` — 546 assertions, no `npm install` |

## Worth noting

One of the judges is **Mert Mumtaz of Helius** — the company this tool sells for. Every
product fact, price and customer name in `pipeline/helius.js` is taken from Helius's own
published pages, with the basis recorded per entry. That is deliberate: the seller's own
facts should survive inspection by the seller.

## The three things only Kerrie can do

1. **Approve the public push.** Say the word and the repo goes up; the secret audit above
   is clean and re-runnable first.
2. **Post the demo on X** with a video or screenshots, tagging `@NEARProtocol` and
   `#NEARHackathon`. Draft copy is in `SUBMISSION.md` §4.
3. **Supply the NEAR wallet address** for the submission form.
