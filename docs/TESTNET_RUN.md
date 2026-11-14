# The escrow on NEAR testnet — a recorded run

**Contract: [`helius-escrow-81631.testnet`](https://testnet.nearblocks.io/address/helius-escrow-81631.testnet)**
Deployed 14 Nov 2026. Every transaction below is clickable.

The verifier's verdict has on-chain authority. Nobody else can move the money.

## The run, in order

| # | Action | Who | Result | Transaction |
|---|---|---|---|---|
| 1 | `fund` 3 NEAR | buyer | escrow holds 3 NEAR | [`B7q9VfUa…`](https://testnet.nearblocks.io/txns/B7q9VfUaHadbD24967sqXUpfLGQemx5GHhEKfrofrQDd) |
| 2 | `deliver` a **paraphrase** | worker | state → `DELIVERED` | [`oQBTkZe6…`](https://testnet.nearblocks.io/txns/oQBTkZe6fTVwjs5vhpuXaeYYoL6XMcNZmYNp3NNhexo) |
| 3 | `settle("GROUNDED")` — **the worker tries to pay itself** | worker | **REFUSED, reverted** | [`9afWvvDR…`](https://testnet.nearblocks.io/txns/9afWvvDR7s6GMpzSK36E6ghsnZgtEJXnx9NB4hagbY8J) |
| 4 | `settle("QUOTE_NOT_IN_SOURCE")` | **arbiter** | **REFUNDED** | [`23DsHwtr…`](https://testnet.nearblocks.io/txns/23DsHwtrve8XQBYDTqKhrukqqYPfQTBj2josAZErkR67) |

## What delivery #2 actually was

The worker delivered the exact string the audit caught:

```
They remain paid a per-action reward by the protocol, and most need no capital
beyond transfers fees
```

The page says *"They **are** paid … beyond **transaction** fees."* It is a paraphrase, not a
quote — and until the Evidence Gap audit, this class of delivery passed the grounding check
**48.8% of the time**. The arbiter now refuses it, and the refusal moves money back.

## The event the contract emitted

```json
{"event":"settle","reason":"QUOTE_NOT_IN_SOURCE","outcome":"REFUND","state":"REFUNDED"}
```

## The balances, before and after

| Account | Before settle | After settle | |
|---|---:|---:|---|
| buyer | 6.9998 NEAR | **9.9998 NEAR** | +3 refunded |
| worker | 9.9991 NEAR | 9.9991 NEAR | **never paid** — only gas on its failed attempt |

Step 3 is the one that matters. The worker held a key, called the contract, asked for the
money with the one reason code that releases — and the contract reverted it, because
`require!(predecessor == arbiter, "E_NOT_ARBITER")` is enforced inside the contract that
holds the funds, not in the client that asks.

## Re-run it yourself

```bash
rustup target add wasm32-unknown-unknown
cd contracts/escrow && cargo build --target wasm32-unknown-unknown --release
near contract call-function as-read-only helius-escrow-81631.testnet status \
  json-args '{}' network-config testnet now
```

`status()` returns the state, the reason code, and the amount held.

## The policy is shared, not duplicated

`contracts/escrow/src/lib.rs`, `pipeline/market.js` and the README all carry the same
settlement table, and `node pipeline/selftest-market.js` **greps the Rust file and fails if
they disagree**. A settlement policy written down twice is a policy that will drift, and one
that drifts pays the wrong party.

## Honest notes

- Testnet only, with faucet-funded accounts. No real value moved.
- The refusal in step 3 reverts the transaction correctly, but the panic message surfaces as
  a wasm trap rather than the string `E_NOT_ARBITER` in the explorer. The refusal is real and
  the funds are safe; making the reason legible on the explorer is unfinished.
- The settlement currency here is testnet NEAR. The NEAR Intents 1Click quote remains
  **priced, not wired** — the cross-chain rail is costed, not settled on.

---

# Run 2 — the RELEASE path, and a verdict the arbiter computed

**Contract: [`helius-escrow2-94871.testnet`](https://testnet.nearblocks.io/address/helius-escrow2-94871.testnet)**
Settled 14 Nov 2026.

Run 1 proved a refusal. It also had a flaw worth stating plainly: **I typed the reason code
on the command line.** That proved the contract enforces *who* may settle and proved nothing
about the verdict — a human asserting a result to a contract is the thing this project
exists to refuse.

In run 2 the verdict is **computed**. `pipeline/arbiter.js` fetches the worker's cited URL
through the whitelist fetcher, runs `quoteIsGrounded` against the page **it** fetched — never
the worker's copy — and the reason code passed to `settle` is whatever that check returned.
The script refuses to continue if the verdict is not `GROUNDED`.

| # | Action | Who | Result | Transaction |
|---|---|---|---|---|
| 1 | `fund` 3 NEAR | buyer | escrow holds 3 NEAR | [`RRTiZUot…`](https://testnet.nearblocks.io/txns/RRTiZUotVRYdPMAa688exCFUTiuHuBubxAwh7HzdvJm) |
| 2 | `deliver` a **verbatim** quote | worker | state → `DELIVERED` | [`CsRV9oKo…`](https://testnet.nearblocks.io/txns/CsRV9oKospjzjXQk1ijzQhs5G5HX2jmCjR4HtdpQKdf9) |
| 3 | `settle("GROUNDED")` — **computed by the arbiter** | arbiter | **RELEASED** | [`CFPrZBuK…`](https://testnet.nearblocks.io/txns/CFPrZBuKEptksrDzm6H4MiBCGWP1tVB9GjD5EwaVkFvm) |

## What the worker delivered

```
They are paid a per-action reward by the protocol
```

That string is on the page, character for character. In run 1 the worker delivered a
paraphrase of the same sentence — *"They **remain** paid … beyond **transfers** fees"* — and
was refused. **Same arbiter, same check, same contract. The difference is in the page.**

## The event the contract emitted

```json
{"event":"settle","reason":"GROUNDED","outcome":"RELEASE","state":"RELEASED"}
```

## The money moved

| Account | Before | After | |
|---|---:|---:|---|
| worker | 9.9991 NEAR | **12.9989 NEAR** | **+3 NEAR, paid** |

Both outcomes are now proven on chain: **run 1 refunded a cheat, run 2 paid honest work.**

## Reproduce the verdict without trusting the arbiter

```bash
node market-round.js       # one bounty, two workers, verdicts computed
node verify-verdict.js     # recompute each verdict from the archived page
```

The page the arbiter fetched is archived under `data/market/evidence/`, and the check is a
string search. `verify-verdict.js` recomputes the page hash, the reason code and the
evidence hash, and reports whether each matches.

## Limits of run 2

- The arbiter is **a single trusted key**. This is verifier-arbitrated, not trustless: the
  contract enforces who may settle; it cannot read a web page.
- Testnet only, faucet funds, no real value.
- There is no bidding and no open market. One buyer, one arbiter, two scripted workers.
