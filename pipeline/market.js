// THE SETTLEMENT POLICY.
//
// This table is the whole idea. The verifier already decides whether a claim is
// grounded; this says what that verdict does to money.
//
// It lives in ONE place and is imported by the simulation, by the on-chain
// client, and (when it exists) by the contract. If any two of those disagree,
// the test fails. A policy that is written down twice is a policy that will
// drift, and a settlement policy that drifts pays the wrong party.
export const SETTLEMENT_POLICY = {
  GROUNDED:            'RELEASE',
  QUOTE_NOT_IN_SOURCE: 'REFUND',
  CLAIM_NOT_SUPPORTED: 'MANUAL_REVIEW',
  DATE_UNVERIFIABLE:   'REFUND',
  SOURCE_UNREACHABLE:  'REFUND',
  ACCOUNT_CEASED:      'REFUND',
  ACCOUNT_COMPETITOR:  'REFUND',
  TIMEOUT:             'REFUND',
  UNKNOWN:             'MANUAL_REVIEW'   // never silently pay
};

export const OUTCOMES = ['RELEASE', 'REFUND', 'MANUAL_REVIEW'];

/* An unknown reason code must NEVER release funds. A typo, a new rejection
   reason, a malicious worker inventing a code - all of them land in manual
   review, where a human decides. This is the single most important line in the
   file: the default is "do not pay", not "pay". */
export function outcomeFor(reasonCode) {
  const o = SETTLEMENT_POLICY[String(reasonCode || '').toUpperCase().trim()];
  return o || 'MANUAL_REVIEW';
}

export const STATE = {
  FUNDED: 'FUNDED', DELIVERED: 'DELIVERED',
  RELEASED: 'RELEASED', REFUNDED: 'REFUNDED', MANUAL_REVIEW: 'MANUAL_REVIEW'
};

/* The escrow state machine, in plain JavaScript, with the same guards the
   contract has: only the worker delivers, only the arbiter settles, and a
   settlement only happens once from the DELIVERED state. */
export class Escrow {
  constructor({ buyer, worker, arbiter, amount, question }) {
    if (!buyer || !worker || !arbiter) throw new Error('E_BAD_PARTIES');
    if (!(amount > 0)) throw new Error('E_BAD_AMOUNT');
    Object.assign(this, { buyer, worker, arbiter, amount, question });
    this.state = STATE.FUNDED;
    this.reason = null;
    this.delivery = null;
    this.paidTo = null;
    this.log = [{ at: 'fund', state: this.state, amount }];
  }

  deliver(from, { url, quote, claim }) {
    if (from !== this.worker)        throw new Error('E_NOT_WORKER');
    if (this.state !== STATE.FUNDED) throw new Error('E_WRONG_STATE');
    if (!url || !quote)              throw new Error('E_EMPTY_DELIVERY');
    this.delivery = { url, quote, claim: claim || null };
    this.state = STATE.DELIVERED;
    this.log.push({ at: 'deliver', state: this.state, url });
    return this;
  }

  /* The arbiter is the verifier. Nobody else can move the money. */
  settle(from, reasonCode) {
    if (from !== this.arbiter)          throw new Error('E_NOT_ARBITER');
    if (this.state !== STATE.DELIVERED) throw new Error('E_WRONG_STATE');
    const outcome = outcomeFor(reasonCode);
    this.reason = String(reasonCode || 'UNKNOWN').toUpperCase().trim();
    if (outcome === 'RELEASE')      { this.state = STATE.RELEASED; this.paidTo = this.worker; }
    else if (outcome === 'REFUND')  { this.state = STATE.REFUNDED; this.paidTo = this.buyer; }
    else                            { this.state = STATE.MANUAL_REVIEW; this.paidTo = null; }
    this.log.push({ at: 'settle', reason: this.reason, outcome, state: this.state, paidTo: this.paidTo });
    return { outcome, state: this.state, paidTo: this.paidTo, reason: this.reason };
  }

  status() { return { state: this.state, reason: this.reason, amount: this.amount, paidTo: this.paidTo }; }
}

/* THE ARBITER'S JOB, which is the verifier's job.
   Given a delivery, fetch the page the worker cited and decide a reason code.
   No model is involved: the decision is a string search in a page we fetched. */
export async function arbitrate(delivery, { fetchSource, quoteIsGrounded }) {
  let page;
  try { page = await fetchSource(delivery.url, { skipWhitelist: true }); }
  catch (e) { return { reason: 'SOURCE_UNREACHABLE', detail: e.message }; }
  if (!page || !page.ok) return { reason: 'SOURCE_UNREACHABLE', detail: page?.error || 'no page' };
  if (!quoteIsGrounded(delivery.quote, page.pageText))
    return { reason: 'QUOTE_NOT_IN_SOURCE', detail: 'the quote is not in the page the worker cited' };
  return { reason: 'GROUNDED', detail: `quote found in ${page.fullChars} chars fetched from ${page.url}` };
}
