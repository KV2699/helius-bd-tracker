# escrow-arbiter — NEAR testnet contract

**Status: written, not deployed.** This machine has `cargo 1.99.1` but no
`rustup`, no `wasm32-unknown-unknown` target and no `cargo-near`, so it cannot
be compiled here. Installing a toolchain was explicitly out of scope for the
build window, and shipping a broken deployment would be worse than shipping a
tested simulation that names its boundary.

What is real today: `pipeline/market.js` holds the settlement policy and the
escrow state machine, and `pipeline/selftest-market.js` exercises it with **29
assertions offline** plus a live leg that fetches a real page and settles twice.
`pipeline/escrow-chain.js` will call this contract the moment it is deployed.

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
