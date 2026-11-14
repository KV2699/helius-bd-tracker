// The Helius BD rubric. Code does the arithmetic; nothing is hand-scored.
// Mirrors Bob W's 25/25/20/15/15 shape, adapted to an infrastructure buyer.

export const DIMENSIONS = [
  { key:'automation', name:'Automation Dependency', max:25, bands:[
    [25,'First-party docs name keeper bots / liquidators / JIT makers / order triggers'],
    [18,'Automated submission documented, bot roles unnamed'],
    [15,'Perp or order-book venue; automation implied, not documented'],
    [8, 'Aggregator or router - submits, but sells execution'],
    [5, 'Spot-only, custodial, or no automation evidence'],
    [0, 'No evidence of automated submission']]},
  { key:'pain', name:'Infrastructure Pain', max:25, bands:[
    [25,'First-party documented limit: getProgramAccounts, websockets, RPC latency, failed sends'],
    [18,'First-party dated Solana incident'],
    [12,'Third-party report of congestion or stall affecting them'],
    [5, 'Self-describes as fast or reliable - claims strength, shows no gap'],
    [0, 'No pain evidence, or the incident was on another chain']]},
  { key:'identity', name:'Identifiability & Contact', max:20, bands:[
    [20,'Named org AND named infra contact VERIFIED from primary source with URL + date'],
    [12,'Named org, contact named but unverified'],
    [8, 'Named org, no contact found'],
    [0, 'Generic entity - a chain, sector or ecosystem. CAPS THE ROW AT MONITOR']]},
  { key:'overlap', name:'Ecosystem Surface Overlap', max:15, bands:[
    [15,'5+ Helius surfaces'],[12,'4 surfaces'],[10,'3 surfaces'],[8,'2 surfaces'],[4,'1 surface'],[0,'none']]},
  { key:'timing', name:'Timing Window', max:15, bands:[
    [15,'Live incident or migration in progress'],
    [12,'Dated launch, funding or mainnet within 30 days'],
    [8, 'Dated event 30-90 days'],
    [4, 'Standing condition - no date'],
    [2, 'No trigger']]}
];

export const BANDS = [
  { min:75, name:'Critical', action:'act within 7 days' },
  { min:50, name:'High',     action:'approach within 30 days' },
  { min:25, name:'Monitor',  action:'qualify before approaching' },
  { min:0,  name:'Below bar', action:'does not enter the pipeline' }
];

export function scoreProspect(p) {
  const notes = [];
  let total = 0;
  for (const d of DIMENSIONS) {
    const v = Math.max(0, Math.min(d.max, Number(p.points?.[d.key] ?? 0)));
    total += v;
    notes.push({ dim: d.name, points: v, max: d.max, why: p.why?.[d.key] || '' });
  }

  let band = BANDS.find(b => total >= b.min);
  const caps = [];

  // Identifiability RAISES, never lowers. A generic entity cannot outrank a
  // named one, whatever the rest of the evidence looks like. This is the
  // inversion of the bug that let a row whose organisation was "Solana" reach
  // Qualify on 61 points.
  if ((p.points?.identity ?? 0) === 0) {
    if (band.name === 'Critical' || band.name === 'High') band = BANDS.find(b => b.name === 'Monitor');
    caps.push('Generic entity - capped at Monitor regardless of score.');
  }
  // A competitor is never a prospect, however it scores.
  if (p.competitor) { band = { name:'Competitor', action:'not a prospect' }; caps.push('Sells RPC, routing or transaction landing.'); }

  return { total, band: band.name, action: band.action, notes, caps };
}

// The display rule the reviewer asked for: a row routed away from Sender must
// SAY so wherever it is read, because the routing layer catching it is useless
// if a skim-reader sees "High" and dials.
export const motionTag = p =>
  !p.motion || p.motion === 'SENDER' ? '' : ` (not Sender - ${p.motion.replace('_', '/')})`;
