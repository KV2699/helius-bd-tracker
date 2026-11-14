// escrow-arbiter: the verifier's verdict, with on-chain authority.
//
// A buyer funds an escrow and posts a research question. A worker delivers a
// claim with a quote and a URL. The arbiter - which is the verification engine
// in pipeline/ - calls settle(reason_code), and the contract applies the SAME
// policy table that pipeline/market.js applies. selftest-market.js greps this
// file and fails if the two disagree.
//
// The invariant worth stating: an unrecognised reason code NEVER releases
// funds. A typo, a new rejection reason, or a worker inventing a code all land
// in MANUAL_REVIEW, where a human decides. The default is "do not pay".
use near_sdk::{env, log, near, require, AccountId, NearToken, PanicOnDefault, Promise};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Escrow {
    buyer: AccountId,
    worker: AccountId,
    arbiter: AccountId,
    amount: NearToken,
    state: String,          // FUNDED | DELIVERED | RELEASED | REFUNDED | MANUAL_REVIEW
    reason: String,
    delivery_url: String,
    delivery_quote: String,
}

#[near]
impl Escrow {
    #[init]
    pub fn new(buyer: AccountId, worker: AccountId, arbiter: AccountId) -> Self {
        Self {
            buyer,
            worker,
            arbiter,
            amount: NearToken::from_yoctonear(0),
            state: "FUNDED".to_string(),
            reason: String::new(),
            delivery_url: String::new(),
            delivery_quote: String::new(),
        }
    }

    #[payable]
    pub fn fund(&mut self) {
        require!(env::predecessor_account_id() == self.buyer, "E_NOT_BUYER");
        require!(self.state == "FUNDED", "E_WRONG_STATE");
        let added = env::attached_deposit();
        self.amount = NearToken::from_yoctonear(self.amount.as_yoctonear() + added.as_yoctonear());
        log!("{{\"event\":\"fund\",\"amount\":\"{}\"}}", self.amount);
    }

    /// Only the worker delivers, and only from FUNDED.
    pub fn deliver(&mut self, url: String, quote: String) {
        require!(env::predecessor_account_id() == self.worker, "E_NOT_WORKER");
        require!(self.state == "FUNDED", "E_WRONG_STATE");
        require!(!url.is_empty() && !quote.is_empty(), "E_EMPTY_DELIVERY");
        self.delivery_url = url;
        self.delivery_quote = quote;
        self.state = "DELIVERED".to_string();
        log!("{{\"event\":\"deliver\",\"state\":\"DELIVERED\"}}");
    }

    /// Only the arbiter settles, and only once, from DELIVERED.
    /// The verifier's verdict is the only thing that moves money here.
    pub fn settle(&mut self, reason_code: String) -> String {
        require!(env::predecessor_account_id() == self.arbiter, "E_NOT_ARBITER");
        require!(self.state == "DELIVERED", "E_WRONG_STATE");

        let code = reason_code.to_uppercase();
        let outcome: &str = match code.as_str() {
            // RELEASE is reachable by exactly one code.
            "GROUNDED"            => "RELEASE",
            "QUOTE_NOT_IN_SOURCE" => "REFUND",
            "DATE_UNVERIFIABLE"   => "REFUND",
            "SOURCE_UNREACHABLE"  => "REFUND",
            "ACCOUNT_CEASED"      => "REFUND",
            "ACCOUNT_COMPETITOR"  => "REFUND",
            "TIMEOUT"             => "REFUND",
            "CLAIM_NOT_SUPPORTED" => "MANUAL_REVIEW",
            // Anything unrecognised, including "UNKNOWN": never silently pay.
            _                     => "MANUAL_REVIEW",
        };

        self.reason = code;
        let amount = self.amount;

        match outcome {
            "RELEASE" => {
                self.state = "RELEASED".to_string();
                Promise::new(self.worker.clone()).transfer(amount);
            }
            "REFUND" => {
                self.state = "REFUNDED".to_string();
                Promise::new(self.buyer.clone()).transfer(amount);
            }
            _ => {
                // Funds stay in the contract until a human decides.
                self.state = "MANUAL_REVIEW".to_string();
            }
        }
        log!(
            "{{\"event\":\"settle\",\"reason\":\"{}\",\"outcome\":\"{}\",\"state\":\"{}\"}}",
            self.reason, outcome, self.state
        );
        self.state.clone()
    }

    pub fn status(&self) -> (String, String, NearToken) {
        (self.state.clone(), self.reason.clone(), self.amount)
    }
}
