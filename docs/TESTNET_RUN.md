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
