# escrow-arbiter — NEAR testnet contract

**Status: DEPLOYED AND EXERCISED ON NEAR TESTNET.**
[`helius-escrow-81631.testnet`](https://testnet.nearblocks.io/address/helius-escrow-81631.testnet)

A buyer funded 3 NEAR, a worker delivered a paraphrase, the worker tried to settle in its own
favour and was **reverted**, and the arbiter settled `QUOTE_NOT_IN_SOURCE` → **REFUNDED**.
Every transaction is linked in [`docs/TESTNET_RUN.md`](../../docs/TESTNET_RUN.md).

The machine had no `rustup` and no `wasm32` target when this was written; installing the
target was a download, not a compile, and the contract built in 23 seconds.

## The policy is shared, not duplicated

The table below is the same one in `pipeline/market.js` and in the README, and
`selftest-market.js` **fails if they disagree** — it greps this file. A
settlement policy written down twice is a policy that will drift, and one that
drifts pays the wrong party.

| reason code | outcome |
|---|---|
| `GROUNDED` | RELEASE |
| `QUOTE_NOT_IN_SOURCE` | REFUND |
| `CLAIM_NOT_SUPPORTED` | MANUAL_REVIEW |
| `DATE_UNVERIFIABLE` | REFUND |
| `SOURCE_UNREACHABLE` | REFUND |
| `ACCOUNT_CEASED` | REFUND |
| `ACCOUNT_COMPETITOR` | REFUND |
| `TIMEOUT` | REFUND |
| anything else | MANUAL_REVIEW — **never silently pay** |

## To build and deploy

```bash
rustup target add wasm32-unknown-unknown
cargo install cargo-near
cargo near build
near contract deploy helius-escrow.testnet use-file ./target/near/escrow.wasm \
  with-init-call new json-args '{"worker":"helius-escrow-worker.testnet","arbiter":"helius-escrow-arbiter.testnet"}' \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send
```

Then set `NEAR_ESCROW_CONTRACT` and `NEAR_ARBITER_ACCOUNT` and run
`node pipeline/selftest-market.js --live --on-chain`.

## The smoke test that would prove it

1. `fund` from the buyer → `status()` returns `FUNDED`
2. `deliver` from the worker → `DELIVERED`
3. `settle("QUOTE_NOT_IN_SOURCE")` from the arbiter → `REFUNDED`, buyer restored
4. `settle(...)` from anyone else → `E_NOT_ARBITER`

Step 4 is the one that matters: **the verifier's verdict has on-chain authority,
and nobody else can move the money.**
