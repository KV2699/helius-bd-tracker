// The Helius product surface, scored per account.
//
// The system asked one question - "does this company need Sender?" - and
// answered "no" 80 times. That is a narrow search, not a pipeline. The question
// is now "which Helius products does this company plausibly need, on what
// evidence, and what is the next best action?"
//
// Every integrity rule is unchanged: a term only counts from a page we fetched,
// ambiguous terms need on-chain context, confidence scales with the corpus, and
// a product fit is a PRODUCT OPPORTUNITY, never a qualified lead.
import { fetchSource } from './fetch.js';
import { ICP, lookupICP } from './icp.js';
import { INFRA_ROLE } from './score.js';
import { findSignals } from './classify.js';

// The Helius product surface, from their own navigation (read 2026-11-13).
//
// The previous taxonomy had SEVEN motions. The nav has sixteen across four
// categories, and the gap mattered: Transaction Rebates, Preprocessed
// Transactions, Validator-as-a-Service, Validator Monetization, Privacy Rings,
// Historical Data, Token APIs and Wallet API were all absent, so eight
// conversations could never be detected at all.
//
// Descriptions are Helius's own words. The fit engine should speak the seller's
// language rather than a paraphrase of it.
export const PRODUCT_CATEGORIES = { trading: 'Trading', infra: 'Infrastructure',
                                    privacy: 'Privacy', data: 'Read Data' };

export const PRODUCTS = {
  /* ---- TRADING ---------------------------------------------------- */
  sender: {
    name: 'Sender', cat: 'trading', blurb: 'Land latency-sensitive trades first',
    inherent: ['transaction landing', 'landing rate', 'sendTransaction', 'priority fee',
               'compute unit price', 'setComputeUnitPrice', 'jito bundle', 'jito tip',
               'block engine', 'tip account', 'blockhash', 'keeper bot', 'jit maker',
               'crank', 'dropped transaction', 'staked connection'],
    contextual: ['bundle', 'keeper', 'liquidator', 'liquidation bot', 'market making',
                 'market maker', 'arbitrage', 'retry', 'failed transaction', 'latency',
                 'execution engine', 'order matching', 'slot'] },
  preconfirmations: {
    name: 'Preconfirmations', cat: 'trading', blurb: 'Stream scheduled Solana transactions',
    inherent: ['preconfirmation', 'pre-confirmation', 'preconf', 'scheduled transaction',
               'leader schedule'],
    contextual: ['earliest signal', 'confirmation latency', 'optimistic confirmation'] },
  shreds: {
    name: 'Shred Delivery', cat: 'trading', blurb: 'Specialized delivery of raw shreds via UDP',
    inherent: ['shred', 'shredstream', 'turbine', 'raw shreds'],
    contextual: ['udp', 'first look', 'pre-execution', 'front of block'] },
  preprocessed: {
    name: 'Preprocessed Transactions', cat: 'trading', blurb: 'Stream pre-execution Solana data',
    inherent: ['pre-execution', 'preprocessed transaction', 'mempool', 'pending transaction'],
    contextual: ['before execution', 'unconfirmed', 'inflight'] },
  rebates: {
    name: 'Transaction Rebates', cat: 'trading', blurb: 'Earn SOL back on backrun-eligible trades',
    inherent: ['backrun', 'rebate', 'order flow payment', 'pfof', 'payment for order flow'],
    contextual: ['revenue share', 'kickback', 'flow monetisation', 'flow monetization'] },

  /* ---- INFRASTRUCTURE ---------------------------------------------- */
  rpc: {
    name: 'RPC Nodes', cat: 'infra', blurb: 'High availability RPC for reads and writes',
    inherent: ['getProgramAccounts', 'rpc endpoint', 'rpc provider', 'rpc node', 'json-rpc',
               'getAccountInfo', 'rate limit', 'gatekeeper'],
    contextual: ['rpc', 'node', 'endpoint', 'throughput', 'uptime', 'reliability', 'availability'] },
  validator: {
    name: 'Helius Validator', cat: 'infra', blurb: '0% fees, 100% inflation rewards, 100% tips',
    inherent: ['vote account', 'stake pool', 'block production', 'inflation rewards',
               'commission', 'delegated stake'],
    contextual: ['validator', 'staking', 'delegation', 'epoch', 'mev rewards'] },
  vaas: {
    name: 'Validator-as-a-Service', cat: 'infra', blurb: 'Reliable white label validators',
    inherent: ['white label validator', 'run a validator', 'operate a validator',
               'validator operations', 'node operator'],
    contextual: ['our validator', 'validator fleet', 'infrastructure team'] },
  validator_monetization: {
    name: 'Validator Monetization', cat: 'infra', blurb: 'Boost validator rewards, no client changes',
    inherent: ['validator revenue', 'validator rewards', 'mev revenue', 'tip revenue',
               'block rewards'],
    contextual: ['monetise', 'monetize', 'yield on stake', 'reward optimisation'] },

  /* ---- PRIVACY ------------------------------------------------------ */
  privacy: {
    name: 'Solana Privacy Rings', cat: 'privacy', blurb: 'Private payments and finance on Solana',
    inherent: ['zk compression', 'confidential transfer', 'encrypted balance', 'privacy ring',
               'shielded', 'zero-knowledge'],
    contextual: ['privacy', 'confidential', 'private payment', 'compliance disclosure'] },

  /* ---- READ DATA ----------------------------------------------------- */
  laserstream: {
    name: 'LaserStream', cat: 'data', blurb: 'Reliable, low latency gRPC data streaming',
    inherent: ['geyser', 'yellowstone', 'grpc stream', 'account updates', 'slot updates',
               'laserstream'],
    contextual: ['grpc', 'stream', 'real-time', 'market data', 'feed', 'subscription'] },
  webhooks: {
    name: 'Webhooks & WebSockets', cat: 'data', blurb: 'Listen to onchain events & stream updates',
    inherent: ['webhook', 'callback url', 'event notification', 'websocket subscription'],
    contextual: ['websocket', 'notification', 'alert', 'wallet activity',
                 'deposit confirmation', 'payment flow'] },
  parsed: {
    name: 'Parsed Events & Streams', cat: 'data', blurb: 'Parsed history and real-time streams',
    inherent: ['parsed transaction', 'enhanced transaction', 'decoded instruction',
               'transaction history api'],
    contextual: ['swap', 'transfer', 'lending', 'dex activity', 'program event', 'instruction'] },
  historical: {
    name: 'Historical Data', cat: 'data', blurb: 'Fast archival data for backfills and indexing',
    inherent: ['archival', 'backfill', 'getTransactionsForAddress', 'historical data',
               'cursor-based pagination'],
    contextual: ['history', 'reindex', 'snapshot', 'ledger history'] },
  token_api: {
    name: 'Token APIs', cat: 'data', blurb: 'Get all token and transaction data instantly',
    inherent: ['token metadata', 'das api', 'token api', 'getAsset', 'token balances'],
    contextual: ['token data', 'holdings', 'portfolio', 'token list'] },
  wallet_api: {
    name: 'Wallet API', cat: 'data', blurb: 'REST endpoints for Solana wallet data',
    inherent: ['wallet api', 'balances endpoint', 'wallet data', 'address balances'],
    contextual: ['balances', 'wallet', 'account overview'] }
};

const ONCHAIN_ANY = /\b(solana|on-?chain|spl token|mainnet-?beta|validator|lamports?|slot)\b/i;
const ONCHAIN_SOL = /\bSOL\b/;
const ONCHAIN = { test: t => ONCHAIN_ANY.test(t) || ONCHAIN_SOL.test(t) };
const LEGAL = /\/(legal|terms|privacy|cookie|disclaimer|location-restrictions)\b/i;

// Dated triggers. These answer "when to approach", separately from "what fits".
export const TRIGGERS = {
  hiring:      { re: /\b(we(?:'re| are) hiring|join our team|open roles?|careers?|apply now|job description)\b/i, points: 12 },
  funding:     { re: /\b(raised|series [a-c]\b|seed round|funding round|led the round|strategic investment)\b/i, points: 15 },
  launch:      { re: /\b(now live|launching|launched|is live|general availability|mainnet launch|now available)\b/i, points: 12 },
  partnership: { re: /\b(partners? with|partnership with|integrat(?:es|ed|ion) with|powered by|now supports)\b/i, points: 10 },
  incident:    { re: /\b(degraded|outage|incident|delays?|investigating|disrupt|postmortem|post-mortem)\b/i, points: 15 }
};

// Sender is sold to someone running automated submission where landing latency
// IS the product - "propAMMs, snipers, copy traders, liquidation bots". A DEX
// writing "low latency" in marketing copy is not that buyer. So Sender fit
// above a floor requires OPERATOR evidence: a documented bot role, or a forked
// automation repo with recent commits.
const OPERATOR_EVIDENCE = /\b(keeper bot|liquidation bot|liquidator|jit maker|market maker bot|crank|filler bot|order trigger|automated submission|our bots?|we run .{0,20}bots?)\b/i;
const SENDER_FLOOR = 25;

// Enterprise is an institutional motion - exchanges, fintechs, institutions.
// A DeFi protocol cannot have Enterprise fit without institutional evidence.
const ENTERPRISE_SEGMENTS = ['exchange', 'fintech', 'institution', 'custodian', 'rwa'];

function scoreProduct(def, text, { corpus }) {
  const inherentHits = [], contextualHits = [];
  for (const h of findSignals(text, def.inherent, { maxPer: 2 })) inherentHits.push(h);
  for (const h of findSignals(text, def.contextual, { maxPer: 2 }))
    (ONCHAIN.test(h.excerpt) ? contextualHits : null)?.push(h);

  const dIn = new Set(inherentHits.map(h => h.term)).size;
  const dCt = new Set(contextualHits.map(h => h.term)).size;

  // Base fit. Inherent terms are worth far more - they narrow the answer,
  // which is the only thing evidence is for.
  let base = Math.min(60, dIn * 15) + Math.min(20, dCt * 4);

  // Evidence strength: a big corpus with a signal is worth more than a nav page
  // with the same signal.
  // Corpus size strengthens an EXISTING signal. It must not manufacture one -
  // every product was scoring 3 on every account purely for having read a few
  // thousand characters, which made "no evidence" indistinguishable from
  // "a little evidence".
  const strength = base > 0 ? (corpus > 100000 ? 10 : corpus > 20000 ? 6 : corpus > 5000 ? 3 : 0) : 0;

  return { score: Math.min(100, base + strength), distinctInherent: dIn, distinctContextual: dCt,
           evidence: inherentHits.slice(0, 4).concat(contextualHits.slice(0, 2)) };
}

export async function productFit(accountName, { onEvent = () => {} } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const say = (msg, extra = {}) => onEvent({ stage: 'products', msg, ...extra });
  const acct = lookupICP(accountName) || ICP.find(a => a.name.toLowerCase() === String(accountName).toLowerCase());
  if (!acct) return { account: accountName, error: 'NOT_IN_REGISTRY' };

  // STATUS GATE, before any scoring. Product fit is not product opportunity:
  // a ceased company can have a flawless fit vector and zero value.
  if (acct.status && acct.status !== 'active') {
    return { account: acct.name, relationship: acct.rel, tier: acct.tier,
             company_status: acct.status, status_evidence: acct.statusEvidence || null,
             vector: Object.fromEntries(Object.keys(PRODUCTS).map(k => [k, 0])),
             primary_product: 'none', secondary_products: [], product_fit_score: 0,
             verdict: 'NO_ACTION', triggers: [], owner_confidence: 'none',
             counter_rationale: `Company status is ${String(acct.status).toUpperCase()}.` +
               (acct.successor ? ` Successor named: ${acct.successor} - evidence does NOT transfer.` : ''),
             next_action: acct.successor
               ? `None for this account. Register ${acct.successor} separately and collect its own evidence.`
               : 'None. Company is not operating.',
             assessedAt: today };
  }

  const surfaces = (acct.surfaces || []).filter(s => s.status === 'verified' && !LEGAL.test(s.url));
  if (!surfaces.length) return { account: acct.name, error: 'NO_VERIFIED_SURFACE' };

  let text = '', corpus = 0; const sources = [];
  for (const sf of surfaces) {
    const src = await fetchSource(sf.url, { skipWhitelist: true });
    if (!src.ok) { sources.push({ url: sf.url, error: src.error }); continue; }
    text += '\n' + src.pageText; corpus += src.pageText.length;
    sources.push({ url: src.url, kind: sf.kind, chars: src.pageText.length });
  }
  if (!corpus) return { account: acct.name, error: 'NOTHING_READABLE' };
  say(`${acct.name}: ${corpus.toLocaleString()} chars across ${sources.filter(s => !s.error).length} surface(s)`);

  const vector = {}, detail = {}, gates = [];
  for (const [key, def] of Object.entries(PRODUCTS)) {
    const r = scoreProduct(def, text, { corpus });
    vector[key] = r.score; detail[key] = r;
  }

  // Sender gate.
  const hasOperator = OPERATOR_EVIDENCE.test(text) ||
                      (acct.forkedAutomation === true);
  if (!hasOperator && vector.sender > SENDER_FLOOR) {
    gates.push(`Sender capped at ${SENDER_FLOOR}: trading vocabulary, but no documented bot or operator role. ` +
               `Sender is sold to whoever RUNS the automation, not to the venue it runs against.`);
    vector.sender = SENDER_FLOOR;
  }

  // Enterprise gate.
  const seg = String(acct.segment || '').toLowerCase();
  if (vector.enterprise > 0 && !ENTERPRISE_SEGMENTS.includes(seg)) {
    gates.push(`Enterprise zeroed: segment is ${seg || 'unrecorded'}, not an exchange, fintech or institution.`);
    vector.enterprise = 0;
  }

  // Triggers: dated reasons to approach NOW, scored separately from fit.
  const triggers = [];
  for (const [kind, t] of Object.entries(TRIGGERS)) {
    const m = text.match(t.re);
    if (m) triggers.push({ kind, points: t.points, excerpt: nearby(text, m.index) });
  }

  // Reachability: do we know who to talk to?
  const named = (acct.owners || []).find(o => o.person && INFRA_ROLE.test(o.role || ''));
  const reach = named ? { level: 'named_owner', who: named.person, role: named.role, points: 15 }
              : acct.github ? { level: 'route_only', route: `github.com/${acct.github}`, points: 6 }
              : { level: 'none', points: 0 };

  const ranked = Object.entries(vector).sort((a, b) => b[1] - a[1]);
  const [primaryKey, primaryScore] = ranked[0];
  const secondary = ranked.slice(1).filter(([, v]) => v >= 25).map(([k]) => k);
  // No product fit means no product opportunity. Flint reported primary "none"
  // alongside a score of 39, which is two statements that cannot both be true:
  // triggers and reachability were adding points to a fit that did not exist.
  const hasFit = primaryScore >= 20;

  // The two-stage score, for the PRIMARY product only.
  const triggerPoints = Math.min(20, triggers.reduce((a, t) => a + t.points, 0));
  const counterPenalty = acct.rel === 'COMPETITOR' ? 100
                       : acct.rel === 'EXISTING_CUSTOMER' ? 100
                       : acct.rel === 'ECOSYSTEM_DEPENDENCY' ? 60
                       : acct.rel === 'UNCLEAR' ? 15 : 0;
  // Triggers and reachability MODIFY a fit; they cannot create one. A dated
  // funding round at a company with no evidenced need is still no need.
  const total = hasFit
    ? Math.max(0, Math.min(100, primaryScore + triggerPoints + reach.points - counterPenalty))
    : Math.max(0, Math.min(19, primaryScore));

  const verdict = !hasFit ? (total >= 10 ? 'CONTEXT' : 'NO_ACTION')
                : total >= 80 ? 'OUTREACH_READY'
                : total >= 60 ? 'QUALIFY'
                : total >= 40 ? 'MONITOR'
                : total >= 20 ? 'CONTEXT' : 'NO_ACTION';

  // Outreach-ready is reserved. Fit alone never earns it.
  const gated = verdict === 'OUTREACH_READY' && (reach.level !== 'named_owner' || !triggers.length)
    ? 'QUALIFY' : verdict;

  return {
    account: acct.name, relationship: acct.rel, tier: acct.tier, corpus, sources,
    vector, detail, gates,
    company_status: acct.status || 'active',
    primary_product: hasFit ? primaryKey : 'none',
    secondary_products: hasFit ? secondary : [],
    product_fit_score: total, verdict: gated,
    downgraded: gated !== verdict ? 'fit is high but there is no named owner or no dated trigger' : null,
    triggers, owner_confidence: reach.level, owner: reach,
    evidence_grade: acct.evidenceGrade || null,
    counter_rationale: counterPenalty
      ? `Relationship is ${acct.rel} - ${counterPenalty >= 100 ? 'excluded from outreach' : 'penalised'}.`
      : 'No disqualifier recorded. Fit is evidence of plausible need, never of intent to buy.',
    next_action: nextAction(gated, primaryKey, primaryScore, reach, acct),
    assessedAt: today
  };
}

function nearby(text, i) {
  return text.slice(Math.max(0, i - 90), i + 130).replace(/\s+/g, ' ').trim().slice(0, 200);
}

function nextAction(verdict, product, score, reach, acct) {
  if (acct.rel === 'COMPETITOR') return 'None. Competitor.';
  if (acct.rel === 'EXISTING_CUSTOMER') return 'None. Existing customer.';
  if (score < 20) return 'Monitor. No product fit evidenced on their own surfaces.';
  const p = PRODUCTS[product]?.name || product;
  if (verdict === 'OUTREACH_READY')
    return `Human review for approval: ${p} approach to ${reach.who} (${reach.role}).`;
  if (reach.level === 'named_owner')
    return `Research ${p} fit, then approach ${reach.who} (${reach.role}). Confirm the title is current first.`;
  if (reach.level === 'route_only')
    return `Owner discovery via ${reach.route}, then research ${p} fit.`;
  return `Owner discovery - no route recorded. Find a surface naming an infrastructure role, then research ${p} fit.`;
}

export async function productFitAll({ onEvent = () => {} } = {}) {
  const out = [];
  for (const a of ICP) {
    if (!(a.surfaces || []).some(s => s.status === 'verified')) continue;
    out.push(await productFit(a.name, { onEvent }));
  }
  return { runId: 'products-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19),
           generatedAt: new Date().toISOString(), accounts: out };
}
