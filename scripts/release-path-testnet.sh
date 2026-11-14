#!/usr/bin/env bash
# The RELEASE path on NEAR testnet. Run 1 proved REFUND; this proves payment.
#
# The reason code is NOT typed here. pipeline/arbiter.js fetches the page,
# runs quoteIsGrounded, and prints the verdict; this script passes that
# verdict to the contract. If the arbiter says QUOTE_NOT_IN_SOURCE, that is
# what gets settled.
set -euo pipefail
export PATH="$HOME/.cargo/bin:$PATH"
SUF="${SUF:-$(date +%s | tail -c 6)}"
C="helius-escrow2-$SUF.testnet"
BUYER="helius-buyer-81631.testnet"
WORKER="helius-worker-81631.testnet"
ARBITER="helius-arbiter-81631.testnet"
URL="https://docs.velocity.exchange/developers/trading-automation"
QUOTE="They are paid a per-action reward by the protocol"

echo "== 1. the arbiter decides, before anything is signed =="
VERDICT=$(node -e "
import('./pipeline/arbiter.js').then(async a=>{
  const v=await a.adjudicate({bountyId:'release',url:process.argv[1],quote:process.argv[2]});
  console.log(v.reason);
})" "$URL" "$QUOTE")
echo "   arbiter verdict: $VERDICT"
[ "$VERDICT" = "GROUNDED" ] || { echo "   not GROUNDED - nothing to release. Stopping."; exit 1; }

echo "== 2. create the escrow account =="
npx --yes near-cli-rs account create-account sponsor-by-faucet-service "$C" \
  autogenerate-new-keypair save-to-legacy-keychain network-config testnet create >/dev/null

echo "== 3. deploy =="
npx --yes near-cli-rs contract deploy "$C" \
  use-file contracts/escrow/target/wasm32-unknown-unknown/release/escrow_arbiter.wasm \
  with-init-call new json-args "{\"buyer\":\"$BUYER\",\"worker\":\"$WORKER\",\"arbiter\":\"$ARBITER\"}" \
  prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' \
  network-config testnet sign-with-legacy-keychain send | grep -i "successfully deployed"

echo "== 4. buyer funds 3 NEAR =="
npx --yes near-cli-rs contract call-function as-transaction "$C" fund json-args '{}' \
  prepaid-gas '30 Tgas' attached-deposit '3 NEAR' sign-as "$BUYER" \
  network-config testnet sign-with-legacy-keychain send | grep -iE "Transaction ID|succeeded"

echo "== 5. the honest worker delivers a VERBATIM quote =="
npx --yes near-cli-rs contract call-function as-transaction "$C" deliver \
  json-args "{\"url\":\"$URL\",\"quote\":\"$QUOTE\"}" \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as "$WORKER" \
  network-config testnet sign-with-legacy-keychain send | grep -iE "Transaction ID|succeeded"

echo "== 6. the arbiter settles with the verdict IT computed =="
npx --yes near-cli-rs contract call-function as-transaction "$C" settle \
  json-args "{\"reason_code\":\"$VERDICT\"}" \
  prepaid-gas '50 Tgas' attached-deposit '0 NEAR' sign-as "$ARBITER" \
  network-config testnet sign-with-legacy-keychain send | grep -iE "Transaction ID|event|RELEASED|succeeded"

echo "== 7. balances =="
for a in "$BUYER" "$WORKER"; do
  printf "   %-34s " "$a"
  curl -s -X POST https://rpc.testnet.near.org -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"$a\"}}" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log((Number(JSON.parse(d).result.amount)/1e24).toFixed(4),'NEAR')})"
done
echo
echo "contract: $C"
