// The funnel. Four states, and the top one is an OPPORTUNITY - not a lead.
//
// The system kept trying to prove a company would buy: proven gap, named owner,
// dated trigger, no counter-rationale. That is the human's job, and using it as
// a discovery filter produced 80 rows and zero leads while Solayer Labs
// advertised the exact role that proves Sender need, publicly, for months.
//
// An opportunity is an account where the evidence supports a CREDIBLE HELIUS
// PRODUCT CONVERSATION. Nothing more is claimed, and the next action is always
// human work.
import { PRODUCTS } from './products.js';
import { heliusRelationship , sellerSideReason } from './helius.js';

export const STATE = {
  OPPORTUNITY:  'opportunity',
  RESEARCH:     'research',
  MONITOR:      'monitor',
  DISQUALIFIED: 'disqualified'
};

// Helius's declared buyer segments and the motion to lead with.
// Helius's own declared buyer segments, in their own words (read 2026-11-13).
// "Searchers" was missing entirely - MEV searchers are a distinct buyer and
// among the most obvious Sender, Shred Delivery and Preconfirmations buyers
// there are.
export const SEGMENTS = {
  trader:        { label:'Traders and market makers',
                   tagline:'Combine the lowest latency shreds with the fastest transaction delivery service to find signals faster and win more trades.',
                   lead:['sender','shreds','preconfirmations','laserstream'] },
  searcher:      { label:'Searchers',
                   tagline:'Discover opportunities and land bids faster than your competitors with a unified trading stack engineered for speed and simplicity.',
                   lead:['shreds','preconfirmations','sender','preprocessed','rebates'] },
  exchange:      { label:'Crypto exchanges',
                   tagline:'Run your exchange on the most scalable and reliable Solana tech stack so you can handle even the most active trading days onchain.',
                   lead:['rpc','webhooks','historical','sender'] },
  wallet:        { label:'Wallets',
                   tagline:'Create a wallet experience users love with the freshest account balances, real-time notifications, and industry-leading reliability.',
                   lead:['wallet_api','token_api','webhooks','rpc'] },
  fintech:       { label:'Fintech',
                   tagline:'Launch new payments, banking, and stablecoin apps on a platform with unmatched availability and scale.',
                   lead:['rpc','webhooks','privacy','parsed'] },
  defi:          { label:'DeFi',
                   tagline:'Build performant apps for internet capital markets on purpose-built infrastructure for low latency reads and writes.',
                   lead:['rpc','laserstream','sender','parsed'] },
  infrastructure:{ label:'Infrastructure teams',
                   tagline:'Indexers, oracles, bridges and validator operators.',
                   lead:['laserstream','historical','parsed','vaas','validator_monetization'] },
  institutional: { label:'Institutional and RWA',
                   tagline:'Regulated venues, tokenisation platforms and institutional counterparties.',
                   lead:['rpc','historical','privacy','parsed'] }
};

// The only bar for an opportunity. Four things, all facts.
const MIN_FIT = 10;

export function placeInFunnel({ account, fit = {}, detail = {}, signals = [], segment = null }) {
  const name = account?.name || account?.account || 'unknown';
  const seg = segment || account?.segment || null;

  let top = null, secondary = [], evidence = null, trigger = null;

  // THE TWO FLAGS. Computed before anything else, because out() records them on
  // every row - a disqualified account still says which kind of verification it
  // had. identity_confirmed defaults to TRUE for a registry account, since an
  // account only entered the registry with a grounded, cited identity; a
  // candidate that has not cleared that check says so explicitly.
  const identity = account?.identity_confirmed !== false;
  const surfaceVerified = account?.surface_verified === true
    || (account?.surfaces || []).some(sf => sf.status === 'verified');

  /* ---- 1. DISQUALIFIERS - each a stated fact, not a judgement --------- */
  // The seller and its rivals come first, because neither is a prospect and
  // neither is an account-management handoff. The 90-day sweep printed
  // "Helius - Already a Helius customer - Route to account management", which
  // is wrong twice: Helius is not its own customer, and there is nobody to
  // route it to.
  const seller = sellerSideReason(name);
  if (seller) return out(STATE.DISQUALIFIED,
    seller === 'this is Helius itself'
      ? 'This is Helius. It is the seller, not an account.'
      : `${seller}. Not a prospect.`,
    'None. Remove from the account list.');

  const own = heliusRelationship(name);
  if (own) return out(STATE.DISQUALIFIED,
    `${own.relationship === 'EXISTING_CUSTOMER' ? 'Already a Helius customer' : 'Already a Helius partner'} - named on helius.dev.`,
    `Route to account management, not BD.${own.evidence?.person ? ` Known contact: ${own.evidence.person}, ${own.evidence.title}.` : ''}`);

  if (account?.status && account.status !== 'active') return out(STATE.DISQUALIFIED,
    `Company status is ${String(account.status).toUpperCase()}.`,
    account?.successor
      ? `Register ${account.successor} separately and collect its own evidence - nothing transfers.`
      : 'None. Company is not operating.');

  // Honour EVERY non-prospect relationship the registry records, not just
  // COMPETITOR. Helius itself came back as a "research task" because the seller
  // is not on its own customer list and nothing else was checked.
  const REL_OUT = {
    COMPETITOR:           ['Sells what Helius sells.', 'None.'],
    EXISTING_CUSTOMER:    ['Already a Helius customer.', 'Route to account management, not BD.'],
    PARTNER:              ['A Helius partner.', 'Route to partnerships, not BD.'],
    ECOSYSTEM_DEPENDENCY: ['Ecosystem dependency, not a buyer.', 'Partner or competitive intelligence only.']
  };
  if (account?.rel && REL_OUT[account.rel])
    return out(STATE.DISQUALIFIED, REL_OUT[account.rel][0], REL_OUT[account.rel][1]);
  if (/^helius$/i.test(name))
    return out(STATE.DISQUALIFIED, 'This is us.', 'None.');
  if (account?.chain && !['Solana', 'unstated'].includes(account.chain))
    return out(STATE.DISQUALIFIED, `Builds on ${account.chain}, not Solana.`, 'None.');

  /* ---- 2. PRODUCT FIT ------------------------------------------------- */
  const ranked = Object.entries(fit).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  top = ranked[0] || null;
  secondary = ranked.slice(1).filter(([, v]) => v >= MIN_FIT).slice(0, 3).map(([k]) => k);

  // The grounded span behind the primary fit. An opportunity has to be able to
  // show its working.
  const hits = top ? (detail[top[0]]?.evidence || []) : [];
  evidence = hits[0] || null;

  trigger = signals.filter(s => s.date).sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;

  /* ---- 3. PLACE ------------------------------------------------------- */
  // OPPORTUNITY = identity confirmed + plausible buyer segment + one grounded
  // product-fit signal + no disqualifier. No owner. No trigger. No intent.
  //
  // AND NOT surface_verified. "Verified account" used to mean two things at
  // once - that the company is real, and that we had read its own pages - so
  // real companies named by credible sources (HumidiFi, Gemini, Robinhood,
  // BisonFi) were blocked before anyone had looked at them. Surface
  // verification is now a confidence flag: it decides what the account is
  // labelled and what the next action is, never whether it exists.
  //
  if (!identity)
    return out(STATE.RESEARCH,
      'Identity is not confirmed - the name has not been grounded in a cited source.',
      `Confirm ${name} is a real company from a credible source before anything else.`);

  if (top && top[1] >= MIN_FIT && seg && evidence)
    return out(STATE.OPPORTUNITY,
      `${PRODUCTS[top[0]]?.name || top[0]} fit ${top[1]}, grounded in their own ` +
      `${evidence.url ? 'page' : 'documentation'}.` +
      (surfaceVerified ? '' : ' Surface not yet verified.'),
      surfaceVerified
        ? nextAction(name, top[0], account, seg)
        : `Find and verify ${name}'s own surface - site, docs, GitHub or status page - ` +
          `then research the ${PRODUCTS[top[0]]?.name || top[0]} conversation.`);

  // RESEARCH: something is there, but not enough to name the conversation.
  if (top && top[1] > 0)
    return out(STATE.RESEARCH,
      `${PRODUCTS[top[0]]?.name || top[0]} scores ${top[1]} but ${!seg ? 'no buyer segment is assigned' : 'no grounded span was captured'}.`,
      !seg ? `Classify ${name}'s buyer segment - that decides which product to look for.`
           : `Confirm the ${PRODUCTS[top[0]]?.name || top[0]} fit from a page ${name} owns, then re-run.`);

  if (trigger)
    return out(STATE.RESEARCH,
      `A dated ${trigger.type} signal (${trigger.date}) but no product fit scored.`,
      `Read ${name}'s own docs: do they run automation, stream data, or just hold TVL?`);

  if (seg)
    return out(STATE.MONITOR,
      `Fits the ${SEGMENTS[seg].label} segment; nothing evidenced on their own surfaces yet.`,
      `Watch for a signal. Products to look for first: ${SEGMENTS[seg].lead.map(p => PRODUCTS[p]?.name || p).join(', ')}.`);

  return out(STATE.MONITOR, 'No buyer segment assigned and no product fit evidenced.',
    `Classify ${name}'s buyer segment first.`);

  function out(state, why, next) {
    const rec = {
      account: name, state, why, next_action: next,
      segment: seg, segment_label: seg ? SEGMENTS[seg].label : null,
      primary_product: state === STATE.OPPORTUNITY ? top[0] : (top ? top[0] : null),
      secondary_products: state === STATE.OPPORTUNITY ? secondary : [],
      product_fit_score: top ? top[1] : 0,
      evidence_grade: account?.evidenceGrade || null,
      quote: evidence?.excerpt || null,
      source: evidence?.url || (account?.surfaces || [])[0]?.url || null,
      date: trigger?.date || null,
      date_basis: trigger ? 'stated in source' : 'observed_on_fetch',
      why_now: trigger ? `${trigger.type}: ${String(trigger.quote || '').slice(0, 120)}` : null,
      // Both flags travel with the row. The label is what the interface shows,
      // so an unverified account is never silently presented as a verified one.
      identity_confirmed: identity,
      surface_verified: surfaceVerified,
      label: state === STATE.OPPORTUNITY
        ? (surfaceVerified ? 'Opportunity - surface verified' : 'Opportunity - surface not yet verified')
        : null,
      // Confidence, not existence. An unverified surface costs a step, not a place.
      confidence: state === STATE.OPPORTUNITY ? (surfaceVerified ? 'high' : 'medium') : null,
      counter_rationale: counterFor(state, account, top, trigger, surfaceVerified),
      origin: account?.origin || 'registry',
      assessedAt: new Date().toISOString().slice(0, 10)
    };
    return rec;
  }
}

// Mandatory everywhere else in this system; mandatory here.
function counterFor(state, account, top, trigger, surfaceVerified = true) {
  if (state === STATE.DISQUALIFIED) return 'Disqualified on a stated fact, not an inference.';
  const bits = [];
  if (!surfaceVerified) bits.push(
    'Surface not yet verified: no page this company owns has been fetched and confirmed as theirs, ' +
    'so the fit rests on a third-party listing.');
  if (!trigger) bits.push('No dated trigger - this is a standing condition, not a reason to call today.');
  if (!(account?.owners || []).length) bits.push('No infrastructure owner identified; the route is research, not a contact.');
  if (top && top[1] < 25) bits.push('Fit is weak and rests on few distinct terms.');
  bits.push('Product fit is evidence of a plausible conversation, never of intent to buy.');
  return bits.join(' ');
}

// Always human work. The system never prepares or sends outreach.
function nextAction(name, product, account, seg) {
  const p = PRODUCTS[product]?.name || product;
  const route = (account?.owners || []).length ? `a named contact is already on file`
              : account?.github ? `start at github.com/${account.github}`
              : (account?.surfaces || []).some(s => s.kind === 'careers') ? 'start at their careers page'
              : 'no route recorded - find one on their own site or X';
  return `Research the ${p} conversation at ${name} (${SEGMENTS[seg].label}): verify the product stack from their own docs, then identify the infrastructure owner - ${route}.`;
}

export function summarise(rows) {
  const by = {};
  for (const r of rows) by[r.state] = (by[r.state] || 0) + 1;
  return { total: rows.length, byState: by,
           opportunities: by[STATE.OPPORTUNITY] || 0,
           worklist: (by[STATE.OPPORTUNITY] || 0) + (by[STATE.RESEARCH] || 0) };
}
