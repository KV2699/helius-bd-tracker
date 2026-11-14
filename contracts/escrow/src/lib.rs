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
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, near_bindgen, AccountId, Promise, PanicOnDefault, NearToken};

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Escrow {
    buyer: AccountId,
    worker: AccountId,
    arbiter: AccountId,
    amount: u128,
    state: String,          // FUNDED | DELIVERED | RELEASED | REFUNDED | MANUAL_REVIEW
    reason: String,
    delivery_url: String,
    delivery_quote: String,
}

#[near_bindgen]
impl Escrow {
    #[init]
    pub fn new(worker: AccountId, arbiter: AccountId) -> Self {
        Self {
            buyer: env::predecessor_account_id(),
            worker,
            arbiter,
            amount: 0,
            state: "FUNDED".to_string(),
            reason: String::new(),
            delivery_url: String::new(),
            delivery_quote: String::new(),
        }
    }

    #[payable]
    pub fn fund(&mut self) {
        assert_eq!(env::predecessor_account_id(), self.buyer, "E_NOT_BUYER");
        assert_eq!(self.state, "FUNDED", "E_WRONG_STATE");
        self.amount += env::attached_deposit().as_yoctonear();
    }

    /// Only the worker delivers, and only from FUNDED.
    pub fn deliver(&mut self, url: String, quote: String) {
        assert_eq!(env::predecessor_account_id(), self.worker, "E_NOT_WORKER");
        assert_eq!(self.state, "FUNDED", "E_WRONG_STATE");
        assert!(!url.is_empty() && !quote.is_empty(), "E_EMPTY_DELIVERY");
        self.delivery_url = url;
        self.delivery_quote = quote;
        self.state = "DELIVERED".to_string();
    }

    /// Only the arbiter settles, and only once, from DELIVERED.
    /// The verifier's verdict is the only thing that moves money here.
    pub fn settle(&mut self, reason_code: String) -> String {
        assert_eq!(env::predecessor_account_id(), self.arbiter, "E_NOT_ARBITER");
        assert_eq!(self.state, "DELIVERED", "E_WRONG_STATE");

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
        let amount = NearToken::from_yoctonear(self.amount);

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
        env::log_str(&format!(
            "{{\"event\":\"settle\",\"reason\":\"{}\",\"outcome\":\"{}\",\"state\":\"{}\"}}",
            self.reason, outcome, self.state
        ));
        self.state.clone()
    }

    pub fn status(&self) -> (String, String, u128) {
        (self.state.clone(), self.reason.clone(), self.amount)
    }
}
