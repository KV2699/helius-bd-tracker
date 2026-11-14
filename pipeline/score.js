// The rubric and the caps. PURE CODE - no model touches a number.
// This is the single source of truth; the interface imports the same logic.
// Carried from the operator's own prompt-pack rule: "code does the arithmetic,
// a model never scores or sizes."

export const RUBRIC_MAX = {
  txVolume: 25,     // transaction-volume signal
  latency: 20,      // latency sensitivity
  reliability: 15,  // reliability pain
  productFit: 15,   // maps to a named Helius product
  reach: 15,        // named infrastructure owner or credible route
  recency: 10       // event within 14 days
};

import { lookupICP } from './icp.js';

export const PRIMARY_LENS = 'trading';
const ORDER = ['NO_ACTION', 'WATCH', 'RESEARCH', 'QUALIFY', 'ACTIONABLE'];
// ROUTED is deliberately absent from ORDER: it is a destination, not a rank.
// Nothing may be capped UP into it and it can never stand in for Qualify.
const GRADE_CAP = { A:'ACTIONABLE', B:'QUALIFY', C:'RESEARCH', D:'RESEARCH', E:'NO_ACTION' };
const SOURCE_CAP = { buyer_owned:'ACTIONABLE', technical_ecosystem:'ACTIONABLE',
                     market_context:'RESEARCH', directory:'RESEARCH' };

// Roles that actually own transaction landing. A CEO or a generic founder
// listing does not clear this - it is who you would call about an RPC bill.
export const INFRA_ROLE = /\b(infrastructur|engineer|engineering|cto|chief technolog|technical|tech lead|devops|sre|platform|backend|protocol|trading systems?|head of (engineering|technology|infrastructure|trading)|architect|core (dev|contributor))/i;

// Gate integrity, applied wherever a row is scored - at collection AND when a
// saved run is re-scored. It lived only in run.js, so saved rows kept an
// inflated gate that no later fix could reach without paying to re-collect.
export function sanitiseGate(row) {
  // Only meaningful for a row the enricher produced. A row with NO spans at all
  // never made a span-backed claim, so there is nothing to withdraw - treating
  // absent spans as failed spans zeroed the fixture dataset and 21 self-tests.
  if (!row.spans) return { gate: { ...(row.gate || {}) }, dropped: [] };
  const gate = { ...(row.gate || {}) }, spans = row.spans, dropped = [];
  for (const [k, v] of Object.entries(gate)) {
    if (v === true && k !== 'is_competitor' && !spans[k]) { gate[k] = false; dropped.push(k); }
  }
  if (gate.infrastructure_owner_identified &&
      !INFRA_ROLE.test(spans.infrastructure_owner_identified || '')) {
    gate.infrastructure_owner_identified = false;
    dropped.push('infrastructure_owner_identified (span names no infrastructure role)');
  }
  return { gate, dropped };
}

// The rubric is DERIVED from the gate, not stored beside it.
//
// It used to be computed once at collection and frozen onto the row. So when a
// gate field was later dropped as unsupported, the points it had earned stayed:
// Flint kept 15 reach points after "infrastructure owner identified" was
// withdrawn, and held a score of 80 with the cap "No infrastructure owner
// identified" printed underneath it. Store the inputs; derive the numbers.
export function rubricFor(row, gate) {
  const g = gate || row.gate || {};
  return {
    txVolume:    g.transaction_volume_evidence ? 20 : 0,
    latency:     g.latency_sensitive ? 20 : 0,
    reliability: g.reliability_pain ? 15 : 0,
    productFit:  row.discovery?.product_fit?.points ?? row.rubric?.productFit ?? 0,
    reach:       g.infrastructure_owner_identified ? 15 : 0,
    recency:     recencyPoints(row.event_date)
  };
}

export function recencyPoints(d) {
  if (!d) return 0;
  const days = Math.floor((Date.now() - new Date(d + 'T00:00:00Z')) / 86400000);
  if (days <= 14) return 10;
  if (days <= 30) return 6;
  if (days <= 60) return 3;
  return 0;
}

export function score(row) {
  let base = 0;
  for (const k of Object.keys(RUBRIC_MAX)) {
    const v = Number(row.rubric?.[k] ?? 0);
    base += Math.max(0, Math.min(RUBRIC_MAX[k], v)); // clamp: a model cannot inflate
  }
  const pen = (row.penalties || []).reduce((a, p) => a + Number(p[1] || 0), 0);
  return Math.max(0, base + pen);
}

// How well do we know WHO to talk to? Separate from whether the account is
// worth talking to at all - conflating the two is what produced zero qualified
// leads from real evidence.
export function ownerConfidence(row) {
  // Owners are recorded on the REGISTRY ACCOUNT, not on the row - a row is one
  // event, and who owns execution is a fact about the company. Without this
  // lookup Flint's CTO, already verified and recorded, never reached a row.
  const acct = row.entity ? lookupICP(row.entity) : null;
  const pool = (row.owners || []).concat(acct?.owners || []);
  const named = pool.find(o => o.person && INFRA_ROLE.test(o.role || ''));
  if (named) return { level: 'named_owner', who: named.person, role: named.role, source: named.source };
  if (row.gate?.infrastructure_owner_identified && INFRA_ROLE.test(row.spans?.infrastructure_owner_identified || ''))
    return { level: 'probable_owner', evidence: row.spans.infrastructure_owner_identified };
  // A route is a way to reach the function without knowing the person: a
  // careers posting for the role, a maintained repo, a support channel.
  const route = row.ownerRoute || acct?.github || row.github || acct?.hiring || row.hiring;
  if (route) return { level: 'route_only', route: typeof route === 'string' ? route : 'hiring for the function' };
  return { level: 'none' };
}

// Readiness is about the APPROACH, not the account. An account can be well
// qualified and still have nobody to send anything to.
export function outreachReadiness(verdict, owner) {
  if (verdict === 'ACTIONABLE' && owner.level === 'named_owner') return 'outreach_ready';
  if (['ACTIONABLE', 'QUALIFY', 'RESEARCH'].includes(verdict)) return 'research_ready';
  return 'not_ready';
}

export function assess(row, lensKey) {
  // Wrap, so every exit - including the short-circuits for competitors, blocked
  // aliases and routed rows - carries owner confidence and readiness.
  const out = assessCore(row, lensKey);
  if (out.owner_confidence) return out;
  const owner = ownerConfidence(row);
  return { ...out, owner_confidence: owner.level, owner,
           outreach_readiness: outreachReadiness(out.verdict, owner) };
}

function assessCore(row, lensKey) {
  // Score the sanitised gate, never the raw one.
  // Derive the rubric ONLY for rows the pipeline collected - those carry the
  // spans the gate is justified by. A row with a hand-written rubric and no
  // spans (the fixture dataset, and the tests) is taken as given; there is
  // nothing to re-derive it from.
  const clean = sanitiseGate(row);
  row = row.spans ? { ...row, gate: clean.gate, rubric: rubricFor(row, clean.gate) } : row;
  const s = score(row);
  let verdict = s >= 80 ? 'ACTIONABLE' : s >= 60 ? 'QUALIFY' : s >= 40 ? 'WATCH' : 'NO_ACTION';
  const band = verdict;
  const caps = [];
  const capTo = (v, why) => { if (ORDER.indexOf(verdict) > ORDER.indexOf(v)) verdict = v; caps.push(why); };

  if (row.blocked)            return { score: s, band, verdict: 'BLOCKED',    caps: ['Blocked alias. Not Helius.'] };
  // STATUS FIRST. A company that has stopped operating is not a prospect,
  // whatever its evidence looks like - and its evidence can look perfect,
  // because documentation outlives the company. Zeta Markets reached this
  // project's first QUALIFY eighteen months after its own docs said it had
  // ceased operating.
  const acctStatus = row.account_status || lookupICP(row.entity)?.status;
  if (acctStatus && acctStatus !== 'active')
    return { score: s, band, verdict: 'NO_ACTION',
             caps: [`Company status is ${String(acctStatus).toUpperCase()} - not a prospect regardless of evidence.`] };
  // Relationship is decided before anything else. A competitor with perfect
  // evidence is still not a prospect.
  if (row.relationship === 'COMPETITOR')            return { score: s, band, verdict: 'COMPETITOR', caps: ['Competitor, not a prospect.'] };
  if (row.relationship === 'ECOSYSTEM_DEPENDENCY')  return { score: s, band, verdict: 'COMPETITOR', caps: ['Ecosystem dependency. Route to partner / competitive intelligence.'] };
  if (row.relationship === 'EXISTING_CUSTOMER')     return { score: s, band, verdict: 'NO_ACTION',  caps: ['Existing customer. Excluded from cold outreach.'] };
  if (row.gate?.is_competitor) return { score: s, band, verdict: 'COMPETITOR', caps: ['Competitor, not a prospect.'] };
  // An UNCLEAR relationship cannot be a qualified lead. Flint reached 80 while
  // the registry still classed it UNCLEAR - we do not know it is a buyer, and
  // "we are not sure what they are" is a research state by definition.
  if (row.relationship === 'UNCLEAR')
    capTo('RESEARCH', 'Relationship is UNCLEAR - not established as a prospect.');
  if (!row.gate?.solana_activity) return { score: s, band, verdict: 'NO_ACTION', caps: ['No Solana activity evidenced. Rejected on the gate.'] };

  // The counter-rationale is a VETO. It may lower a verdict; it must never
  // raise one. A low-scoring row stays low - being able to name a reason it
  // might not matter is not a reason to promote it.
  if (row.counterRule === 'no_gap' || row.counterRule === 'incumbent_may_cover') {
    const reason = row.counterRule === 'no_gap'
      ? 'Counter-rationale states no evidence of an infrastructure gap.'
      : 'Counter-rationale states an incumbent may already cover this.';
    // Both branches must LOWER the verdict. The first version capped a known
    // account to Research and left an UNKNOWN one alone - so a row we could not
    // identify kept a higher band than one we could. That is backwards, and it
    // is how a row whose entity was "Solana" reached Qualify on score 61.
    // "No evidence of an infrastructure gap" is the question a research task
    // answers - it is not a reason to refuse to research. For a registry
    // account with first-party technical evidence it caps at QUALIFY; for
    // anything weaker it still caps at RESEARCH, and with no registry account
    // behind it the row is context at best.
    const known = row.tier || row.registry_tier;
    const firstPartyTech = (row.source_type === 'buyer_owned' || row.source_type === 'technical_ecosystem')
                           && (row.evidence_grade === 'A' || row.evidence_grade === 'B');
    if (known && firstPartyTech && row.counterRule === 'no_gap')
      capTo('QUALIFY', reason + ' That is what the research task is for.');
    else if (known) capTo('RESEARCH', reason);
    else capTo('RESEARCH', reason + ' No registry account behind it, so it is context at best.');
  }
  // Evidence grade is a ceiling. Third-party research can never be Actionable.
  // A volume dashboard is context. It can start research; it cannot end it.
  if (row.source_type && SOURCE_CAP[row.source_type] && SOURCE_CAP[row.source_type] !== 'ACTIONABLE')
    capTo(SOURCE_CAP[row.source_type], `Source is ${row.source_type.replace('_',' ')}, not a buyer-owned surface.`);
  // A standing condition is not an event. It can justify research; it can never
  // justify outreach, because nothing has happened to reach out about.
  // QUALIFY means "worth assigning a human research task". ACTIONABLE means
  // "ready for a human-approved approach". The two were collapsed, which is why
  // accounts with real first-party execution evidence sat at RESEARCH forever.
  //
  // A standing condition - a company documenting how its own execution works -
  // is exactly what a research task is for. It still cannot be ACTIONABLE,
  // because nothing has happened to reach out about.
  if (row.standing) {
    const firstParty = row.source_type === 'buyer_owned' || row.source_type === 'technical_ecosystem';
    const known = row.tier || row.registry_tier;
    if (firstParty && known && (row.evidence_grade === 'A' || row.evidence_grade === 'B'))
      capTo('QUALIFY', 'Standing condition, not a dated event: worth researching, not yet worth approaching.');
    else
      capTo('RESEARCH', 'Standing condition observed in documentation, not a dated event.');
  }
  if (row.evidence_grade && GRADE_CAP[row.evidence_grade])
    capTo(GRADE_CAP[row.evidence_grade], `Evidence grade ${row.evidence_grade}: ${gradeWhy(row.evidence_grade)}`);
  // A different Helius motion is not a Sender lead.
  if (row.motion && row.motion !== 'SENDER' && row.motion !== 'UNROUTED')
    capTo('RESEARCH', `Evidence routes to ${row.motion.replace('_','/')}, not Sender.`);
  if (!row.gate?.infrastructure_owner_identified) capTo('QUALIFY', 'No infrastructure owner identified.');
  if (lensKey && lensKey !== PRIMARY_LENS)         capTo('QUALIFY', 'Extension lens, not the primary motion.');

  // ROUTING, not promotion. A named exchange with a dated Solana reliability
  // incident is not a Sender lead - a withdrawal delay is a funding rail, not
  // an execution path - but "No action" throws away a real BD signal. So a row
  // that fails the Sender bar while still being a known account with Solana
  // evidence becomes a ROUTED task naming the product it actually belongs to.
  // ROUTED sits BELOW Qualify. It is a task for a human, never a cleared lead.
  // The ACCOUNT having Solana activity is not enough - the EVENT must be about
  // Solana too, or a Coinbase outage on another chain becomes a Solana task.
  // GROUNDED TEXT ONLY. `why` is written by the model; including it let a
  // Coinbase incident about Interac e-Transfer withdrawals route as a Solana
  // task, because the model's own commentary mentioned Solana. The quote and
  // the headline came off the page; the rationale did not.
  const evText = `${row.quote || ''} ${row.headline || ''}`;
  const eventIsSolana = /\bsolana\b|\bSOL\b/i.test(evText);
  if ((verdict === 'NO_ACTION' || verdict === 'WATCH') && (row.tier || row.registry_tier) &&
      row.relationship === 'PROSPECT' && row.gate?.solana_activity && eventIsSolana) {
    const to = row.motion && row.motion !== 'UNROUTED' && row.motion !== 'SENDER'
      ? row.motion
      : (row.gate?.reliability_pain ? 'RPC_ENTERPRISE' : null);
    if (to) return { score: s, band, verdict: 'ROUTED', routedTo: to, caps: caps.concat(
      [`No Sender signal, but this is a registry account with dated Solana evidence. Routed to ${to.replace('_','/')} as a research task, not a lead.`]) };
  }

  const owner = ownerConfidence(row);
  return { score: s, band, verdict, caps,
           owner_confidence: owner.level, owner,
           outreach_readiness: outreachReadiness(verdict, owner) };
}

// Sender only fires on latency-sensitive rows, regardless of score.
function gradeWhy(g){
  return { A:'first-party technical', B:'first-party role or product', C:'third-party research',
           D:'directory or weak attribution', E:'inference' }[g] || 'ungraded';
}

export const firesSender = row => !!row.gate?.latency_sensitive;
export const servicesFor = row =>
  firesSender(row) ? (row.services || []) : (row.services || []).filter(s => s.indexOf('sender') !== 0);
