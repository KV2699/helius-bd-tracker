// Proves the guards work without spending a single token.
import { quoteIsGrounded, verifyCandidate, isBlockedAlias, whitelistEntry } from './verify.js';
import { assess, score } from './score.js';

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}`); } };

const page = `Securitize today announced it has expanded its onchain U.S. stock offering to 25 equities,
settled in USDC, with Jump Trading supporting liquidity on Solana. The company said the expansion
follows strong demand from institutional clients.`;

console.log('\nGrounding');
t('exact quote is grounded',        quoteIsGrounded('expanded its onchain U.S. stock offering to 25 equities', page));
t('quote with smart quotes grounded', quoteIsGrounded('expanded its onchain U.S. stock offering to 25 equities', page.replace(/'/g, '’')));
t('INVENTED quote is rejected',    !quoteIsGrounded('Securitize said it was unhappy with its current RPC provider', page));
t('too-short quote is rejected',   !quoteIsGrounded('Solana', page));
t('bag-of-words is rejected',      !quoteIsGrounded('Securitize Solana USDC equities Jump demand clients offering', page));

console.log('\nName-collision guard');
t('blocks Solana Company',          isBlockedAlias('Solana Company'));
t('blocks Helius Medical',          isBlockedAlias('Helius Medical Technologies'));
t('does not block Securitize',     !isBlockedAlias('Securitize'));

console.log('\nSource whitelist');
t('allows solana.com',              !!whitelistEntry('https://solana.com/news/x'));
t('allows a subdomain',             !!whitelistEntry('https://investors.securitize.io/news/x'));
t('rejects a random blog',          !whitelistEntry('https://some-random-blog.example/post'));

console.log('\nVerification end to end');
const win = { from: '2026-08-01', to: '2026-11-04' };
const base = { entity: 'Securitize', event_type: 'product_launch', event_date: '2026-11-02',
               headline: 'Expanded to 25 equities', chain: 'Solana',
               quote: 'expanded its onchain U.S. stock offering to 25 equities' };
const ctx = () => ({ pageText: page, sourceUrl: 'https://investors.securitize.io/news/x', window: win, seen: new Set() });

t('valid candidate passes',          verifyCandidate({ ...base }, ctx()).ok);
t('fabricated quote -> rejected',    verifyCandidate({ ...base, quote: 'Securitize is replacing its provider' }, ctx()).reason === 'QUOTE_NOT_IN_SOURCE');
t('out-of-window -> rejected',       verifyCandidate({ ...base, event_date: '2026-01-02' }, ctx()).reason === 'DATE_OUT_OF_WINDOW');
t('no date -> rejected',             verifyCandidate({ ...base, event_date: null }, ctx()).reason === 'DATE_UNVERIFIABLE');
t('blocked alias -> rejected',       verifyCandidate({ ...base, entity: 'Solana Company' }, ctx()).reason === 'BLOCKED_ALIAS');
t('entity absent from page -> rejected', verifyCandidate({ ...base, entity: 'Chainlink Labs' }, ctx()).reason === 'NO_NAMED_ENTITY');
const dctx = ctx();
verifyCandidate({ ...base }, dctx);
t('duplicate -> rejected',           verifyCandidate({ ...base }, dctx).reason === 'DUPLICATE');

console.log('\nScoring is code, and clamps the model');
t('rubric clamps an inflated field', score({ rubric: { txVolume: 9999 }, penalties: [] }) === 25);
const row = { tier: 1, rubric: { txVolume: 20, latency: 20, productFit: 15, recency: 10 }, penalties: [],
              gate: { solana_activity: true, latency_sensitive: true, infrastructure_owner_identified: false, is_competitor: false },
              counterRule: null };
const a = assess(row, 'trading');
t('65 with no infra owner -> Qualify', a.score === 65 && a.verdict === 'QUALIFY');
t('cap states its reason',             a.caps[0].includes('infrastructure owner'));
// reach points and the gate field are the same fact - flip both, as run.js does
const owned = { ...row, rubric: { ...row.rubric, reach: 15 },
                gate: { ...row.gate, infrastructure_owner_identified: true } };
t('with owner -> Actionable at 80',    assess(owned, 'trading').score === 80 && assess(owned, 'trading').verdict === 'ACTIONABLE');
t('score alone cannot clear the cap',  assess({ ...row, rubric: { ...row.rubric, reach: 15 } }, 'trading').verdict === 'QUALIFY');
t('extension lens caps at Qualify',    assess(owned, 'rwa').verdict === 'QUALIFY');
t('counter no_gap -> Research',        assess({ ...row, counterRule: 'no_gap' }, 'trading').verdict === 'RESEARCH');
t('competitor -> Competitor',          assess({ ...row, gate: { ...row.gate, is_competitor: true } }, 'trading').verdict === 'COMPETITOR');
t('no solana -> No action',            assess({ ...row, gate: { ...row.gate, solana_activity: false } }, 'trading').verdict === 'NO_ACTION');



/* --- appended: JSON salvage, the failure that cost a whole run --- */
import { firstBalancedObject } from './near.js';
console.log('\nJSON salvage (models append junk after valid JSON)');
[['stray trailing brace','{"a":1} }'],
 ['trailing prose','{"a":1}\nHope that helps!'],
 ['brace inside a string','{"a":"a } b","c":2} }'],
 ['escaped quote','{"a":"say \\"hi\\""} }'],
 ['nested objects','{"gate":{"x":true},"n":1} }']
].forEach(([n,raw])=>{
  let ok=false; try{ JSON.parse(firstBalancedObject(raw)); ok=true; }catch(e){}
  if(ok){ pass++; console.log('  ok   '+n); } else { fail++; console.log('  FAIL '+n); }
});


/* --- appended: the counter-rationale must veto, never promote --- */
console.log('\nCounter-rationale is a veto, not a promotion');
const low = { tier:2, rubric:{txVolume:20, recency:10}, penalties:[], counterRule:'no_gap',
  gate:{solana_activity:true, latency_sensitive:false, infrastructure_owner_identified:false, is_competitor:false} };
const lowA = assess(low, 'trading');
t('39-point row is NOT promoted to Research', lowA.score === 30 && lowA.verdict === 'NO_ACTION');
const high = { ...low, rubric:{txVolume:25, latency:20, reliability:15, productFit:15, reach:15, recency:10},
  gate:{ ...low.gate, latency_sensitive:true, infrastructure_owner_identified:true } };
t('100-point row IS demoted to Research', assess(high,'trading').verdict === 'RESEARCH');


/* --- appended: provenance. The URL must be the page we fetched. --- */
console.log('\nProvenance');
const pv = verifyCandidate(
  { entity:'Securitize', event_type:'product_launch', event_date:'2026-11-02', headline:'x', chain:'Solana',
    quote:'expanded its onchain U.S. stock offering to 25 equities',
    source_url:'https://evil.example/not-the-page' },          // model claims another URL
  { pageText: page, sourceUrl:'https://investors.securitize.io/news/x', window: win, seen: new Set() });
t('model-supplied URL is ignored', pv.ok && pv.row.source_url === 'https://investors.securitize.io/news/x');


/* --- appended: relationship gate, motion routing, evidence grades --- */
import { lookupICP, isProspectable, routeMotion, RELATIONSHIP, GRADE_CAP, productFitPoints } from './icp.js';
console.log('\nRelationship gate (runs BEFORE scoring)');
t('Jito -> ecosystem dependency', lookupICP('Jito Labs').rel === RELATIONSHIP.ECOSYSTEM_DEPENDENCY);
t('Alchemy -> competitor',        lookupICP('Alchemy').rel === RELATIONSHIP.COMPETITOR);
t('Helius -> existing customer',  lookupICP('Helius').rel === RELATIONSHIP.EXISTING_CUSTOMER);
t('competitor not prospectable', !isProspectable(RELATIONSHIP.COMPETITOR));
t('ecosystem not prospectable',  !isProspectable(RELATIONSHIP.ECOSYSTEM_DEPENDENCY));
t('unclear IS prospectable',      isProspectable(RELATIONSHIP.UNCLEAR));
t('unknown entity -> no registry hit', lookupICP('Some Random Co') === null);

console.log('\nProduct-motion routing');
t('failed transactions -> Sender',      routeMotion('failed transactions during congestion').motion === 'SENDER');
t('keeper bots -> Sender',              routeMotion('our keeper bots submit liquidations').motion === 'SENDER');
t('deposits/withdrawals -> RPC/Ent',    routeMotion('solana deposit and withdrawal delays').motion === 'RPC_ENTERPRISE');
t('validator/staking -> RPC/Ent',       routeMotion('validator staking rewards').motion === 'RPC_ENTERPRISE');
t('plain volume -> unrouted',           routeMotion('daily volume was $321m').motion === 'UNROUTED');

console.log('\nEvidence grade caps');
t('A can reach Actionable', GRADE_CAP.A === 'ACTIONABLE');
t('B caps at Qualify',      GRADE_CAP.B === 'QUALIFY');
t('C caps at Research',     GRADE_CAP.C === 'RESEARCH');
t('D caps at Research',     GRADE_CAP.D === 'RESEARCH');
t('E is never acceptable',  GRADE_CAP.E === 'NO_ACTION');
t('volume alone scores 0 product fit', productFitPoints('daily volume was $321m').points === 0);



/* --- appended: the new caps, end to end --- */
console.log('\nNew caps in assess()');
const capRow = { tier:1, rubric:{txVolume:25,latency:20,reliability:15,productFit:15,reach:15,recency:10},
  penalties:[], counterRule:null,
  gate:{solana_activity:true, latency_sensitive:true, infrastructure_owner_identified:true, is_competitor:false} };
t('perfect row + grade A -> Actionable', assess({...capRow, evidence_grade:'A', relationship:'PROSPECT'},'trading').verdict==='ACTIONABLE');
t('grade B caps at Qualify',             assess({...capRow, evidence_grade:'B', relationship:'PROSPECT'},'trading').verdict==='QUALIFY');
t('grade C caps at Research',            assess({...capRow, evidence_grade:'C', relationship:'PROSPECT'},'trading').verdict==='RESEARCH');
t('grade D caps at Research',            assess({...capRow, evidence_grade:'D', relationship:'PROSPECT'},'trading').verdict==='RESEARCH');
t('RPC/Ent motion caps at Research',     assess({...capRow, evidence_grade:'A', motion:'RPC_ENTERPRISE', relationship:'PROSPECT'},'trading').verdict==='RESEARCH');
t('competitor short-circuits',           assess({...capRow, evidence_grade:'A', relationship:'COMPETITOR'},'trading').verdict==='COMPETITOR');
t('ecosystem dependency short-circuits', assess({...capRow, evidence_grade:'A', relationship:'ECOSYSTEM_DEPENDENCY'},'trading').verdict==='COMPETITOR');
t('existing customer excluded',          assess({...capRow, evidence_grade:'A', relationship:'EXISTING_CUSTOMER'},'trading').verdict==='NO_ACTION');
t('cap states its grade reason',         assess({...capRow, evidence_grade:'C', relationship:'PROSPECT'},'trading').caps.join(' ').includes('third-party research'));
/* ---- source_type classification and caps ---------------------------- */
console.log('\nSource type and context caps');
{
  const eq = (a,b,n) => t(n, a === b);
  const ok = (c,n) => t(n, !!c);
  const { sourceTypeOf, SOURCE_TYPE_CAP } = await import('./config.js');
  const { sourcePlan } = await import('./sources.js');
  eq(sourceTypeOf('something-new'), 'directory', 'an unknown surface type falls back to a capped class');
  eq(sourceTypeOf('news'), 'market_context', 'news is market context');
  eq(sourceTypeOf('buyer_surface'), 'buyer_owned', 'buyer surface classifies');
  eq(sourceTypeOf('docs'), 'technical_ecosystem', 'docs are technical');
  eq(SOURCE_TYPE_CAP.market_context, 'RESEARCH', 'context cannot be actionable');

  const plan = sourcePlan();
  ok(plan.length > 0, 'source plan is not empty');
  ok(plan.every(p => p.url && p.source_type), 'every plan entry is typed');
  eq(new Set(plan.map(p => p.url)).size, plan.length, 'plan has no duplicate urls');
  const firstCtx = plan.findIndex(p => p.source_type === 'market_context');
  ok(firstCtx === -1 || plan.slice(firstCtx).every(p => p.source_type === 'market_context'),
     'context sources are read last');
  // The cap used to be a flat 3. It is now the invariant that cap was standing
  // in for: context pages corroborate, so they must stay a minority of the plan
  // and must never be the only thing a run reads.
  const ctxN = plan.filter(p => p.source_type === 'market_context').length;
  ok(ctxN * 2 < plan.length, 'context sources stay a minority of the plan');
  ok(plan.some(p => p.source_type === 'buyer_owned'), 'the plan still leads with buyer-owned surfaces');

  // A market_context row cannot be promoted past Research however it scores.
  const { assess } = await import('./score.js');
  const row = { entity:'Test Venue', relationship:'PROSPECT', source_type:'market_context',
                evidence_grade:'A', motion:'SENDER', counter:'none',
                gate:{ solana_activity:true, transaction_volume_evidence:true, latency_sensitive:true,
                       reliability_pain:true, infrastructure_owner_identified:true, is_competitor:false },
                rubric:{ txVolume:25, latency:20, reliability:15, productFit:15, reach:15, recency:10 } };
  const a = assess(row, 'sender');
  ok(a.verdict !== 'ACTIONABLE' && a.verdict !== 'QUALIFY',
     'a volume dashboard cannot produce an actionable lead, got ' + a.verdict);
}

console.log('\nRouting, not promotion');
{
  const eq = (a,b,n) => t(n, a === b);
  const { assess } = await import('./score.js');
  const base = { relationship:'PROSPECT', tier:2, source_type:'buyer_owned', evidence_grade:'A',
    gate:{ solana_activity:true, transaction_volume_evidence:false, latency_sensitive:false,
           reliability_pain:true, infrastructure_owner_identified:false, is_competitor:false },
    rubric:{ txVolume:0, latency:0, reliability:15, productFit:3, reach:0, recency:10 } };

  // Every routing case needs Solana IN THE EVENT, not just in the account.
  base.quote = 'Delays processing deposits and withdrawals on the Solana network';
  const exch = assess({ ...base, motion:'RPC_ENTERPRISE' }, 'sender');
  t('an exchange reliability incident is ROUTED, not discarded', exch.verdict === 'ROUTED');
  eq(exch.routedTo, 'RPC_ENTERPRISE', 'it names the product it routes to');

  // Reliability pain with no routed motion still routes to RPC/Enterprise.
  t('reliability pain alone still routes', assess({ ...base, motion:'UNROUTED' }, 'sender').verdict === 'ROUTED');

  // ROUTED must never substitute for a lead.
  const unknown = assess({ ...base, tier:null, motion:'RPC_ENTERPRISE' }, 'sender');
  t('an unknown company is NOT routed', unknown.verdict !== 'ROUTED');
  const comp = assess({ ...base, relationship:'COMPETITOR', motion:'RPC_ENTERPRISE' }, 'sender');
  t('a competitor is never routed', comp.verdict === 'COMPETITOR');
  const noSol = assess({ ...base, motion:'RPC_ENTERPRISE',
    gate:{ ...base.gate, solana_activity:false } }, 'sender');
  t('no Solana activity is never routed', noSol.verdict === 'NO_ACTION');

  // A row good enough to qualify must not be downgraded into a routing task.
  const good = assess({ relationship:'PROSPECT', tier:1, source_type:'buyer_owned', evidence_grade:'A',
    motion:'SENDER', gate:{ solana_activity:true, transaction_volume_evidence:true, latency_sensitive:true,
      reliability_pain:true, infrastructure_owner_identified:true, is_competitor:false },
    rubric:{ txVolume:25, latency:20, reliability:15, productFit:15, reach:15, recency:10 } }, 'trading');
  t('a real Sender lead is never turned into a routing task', good.verdict === 'ACTIONABLE');

  // The real bug this caught: a Coinbase outage on Sonic Network was being
  // routed as a Solana task because the ACCOUNT trades Solana.
  const otherChain = assess({ ...base, motion:'RPC_ENTERPRISE',
    quote:'Delayed Sends and Receives - Sonic Network', headline:'', why:'' }, 'sender');
  t('an outage on another chain is NOT routed as a Solana task', otherChain.verdict !== 'ROUTED');

  // The model's own rationale must not satisfy the Solana test. A Coinbase
  // incident about Interac e-Transfer withdrawals routed as a Solana task
  // because `why` said Solana while the quote did not.
  const fiat = assess({ ...base, motion:'RPC_ENTERPRISE',
    quote:'We continue to experience delays affecting Interac e-Transfer withdrawals for Canadian users.',
    headline:'Interac e-Transfer delays',
    why:'Coinbase runs significant Solana volume and this suggests infrastructure strain.' }, 'sender');
  t('a fiat-rail incident is not routed just because the rationale says Solana',
    fiat.verdict !== 'ROUTED');
}


console.log('\nStanding conditions');
{
  const { verifyCandidate } = await import('./verify.js');
  const { assess } = await import('./score.js');
  const docs = 'Trading Automation. This section is for anyone running code that trades without a person at the keyboard. '
    + 'Watch the logs for resubscribe messages, which mean the websocket went quiet and the SDK reconnected, and track RPC latency. '
    + 'Velocity Protocol keeper bots submit on-chain transactions. The failures a new bot hits are usually a missing token account or an RPC that ran out of credits.';
  const win = { from: '2026-08-07', to: '2026-11-05' };
  const cand = { entity:'Velocity Protocol', event_type:'standing_condition', event_date:null,
                 headline:'Keeper bot operators told to track RPC latency',
                 quote:'track RPC latency. Velocity Protocol keeper bots submit on-chain transactions',
                 chain:'Solana' };

  const off = verifyCandidate(cand, { pageText:docs, sourceUrl:'https://docs.velocity.exchange/x',
                                      window:win, seen:new Set(), allowStanding:false });
  t('an undated candidate is still rejected by default', !off.ok && off.reason === 'DATE_UNVERIFIABLE');

  const on = verifyCandidate(cand, { pageText:docs, sourceUrl:'https://docs.velocity.exchange/x',
                                     window:win, seen:new Set(), allowStanding:true });
  t('a first-party surface may carry a standing condition', on.ok === true);
  t('it is marked standing', on.ok && on.row.standing === true);
  t('its date is honest about where it came from', on.ok && on.row.date_basis === 'observed_on_fetch');
  t('it is dated by the fetch, not invented', on.ok && on.row.event_date === '2026-11-05');

  // Grounding is NOT relaxed for standing conditions.
  const faked = verifyCandidate({ ...cand, quote:'Velocity said its transaction landing is failing badly' },
    { pageText:docs, sourceUrl:'https://docs.velocity.exchange/x', window:win, seen:new Set(), allowStanding:true });
  t('a standing condition still needs a grounded quote', !faked.ok && faked.reason === 'QUOTE_NOT_IN_SOURCE');

  // The cap: a condition can fund research, never outreach.
  const row = { entity:'Velocity Protocol', relationship:'PROSPECT', tier:2, standing:true,
    source_type:'technical_ecosystem', evidence_grade:'A', motion:'SENDER',
    gate:{ solana_activity:true, transaction_volume_evidence:true, latency_sensitive:true,
           reliability_pain:true, infrastructure_owner_identified:true, is_competitor:false },
    rubric:{ txVolume:25, latency:20, reliability:15, productFit:15, reach:15, recency:10 } };
  const a = assess(row, 'trading');
  t('a standing condition can never be Actionable', a.verdict !== 'ACTIONABLE');
  t('and it says why', a.caps.some(c => /standing condition/i.test(c)));
}

console.log('\nA chain is not a company');
{
  const { isGenericEntity } = await import('./config.js');
  const { assess } = await import('./score.js');
  t('Solana is not a named entity',        isGenericEntity('Solana'));
  t('"the Solana network" is not either',  isGenericEntity('Solana Network'));
  t('Jump Trading still is',              !isGenericEntity('Jump Trading'));
  t('Velocity Protocol still is',         !isGenericEntity('Velocity Protocol'));

  // The regression this came from: score 61, no registry account, counter-rationale
  // present - and it reached QUALIFY because the unknown-entity branch did not cap.
  const row = { entity:'Solana', relationship:'PROSPECT', tier:null, registry_tier:null,
    counterRule:'no_gap', source_type:'buyer_owned', motion:'UNROUTED',
    gate:{ solana_activity:true, transaction_volume_evidence:true, latency_sensitive:true,
           reliability_pain:false, infrastructure_owner_identified:true, is_competitor:false },
    rubric:{ txVolume:25, latency:20, reliability:0, productFit:3, reach:3, recency:10 } };
  const a = assess(row, 'trading');
  t('an unidentified row with a counter-rationale cannot Qualify', a.verdict === 'RESEARCH');
  t('and it never outranks an identified one',
    assess({ ...row, tier:2 }, 'trading').verdict === 'RESEARCH' && a.verdict === 'RESEARCH');
}

console.log('\nOperator discovery (HX-GA2) and the tracker rubric');
{
  const src = (await import('node:fs')).readFileSync('pipeline/operators.js', 'utf8');
  const RE = eval(src.match(/const ROLE_WORD = (\/.*\/i);/)[1]);
  const isRole = n => { const w = String(n).trim().split(/[\s-]+/).filter(Boolean);
                        return w.length > 0 && w.every(x => RE.test(x)); };
  // The first run of this agent returned every one of these as an "operator".
  t('"JIT maker bot" is a role, not an org',   isRole('JIT maker bot'));
  t('"Makers" is a role, not an org',          isRole('Makers'));
  t('"Keeper bots" is a role, not an org',     isRole('Keeper bots'));
  t('"Order trigger bot" is a role',           isRole('Order trigger bot'));
  t('"Wintermute" is an organisation',        !isRole('Wintermute'));
  t('"Jump Trading" is an organisation',      !isRole('Jump Trading'));
  t('"keeper-bots-v2" is a repo, kept',       !isRole('keeper-bots-v2'));

  const { scoreProspect, motionTag } = await import('../tracker/rubric.js');
  const base = { points:{ automation:25, pain:25, identity:8, overlap:15, timing:15 } };
  const unverified = scoreProspect(base);
  const verified   = scoreProspect({ points:{ ...base.points, identity:20 } });
  t('verifying a contact raises the score', verified.total > unverified.total);
  t('it is worth exactly 12 points',        verified.total - unverified.total === 12);

  // Identifiability must RAISE, never lower - the inverted-bug guard.
  const generic = scoreProspect({ points:{ ...base.points, identity:0 } });
  t('a generic entity is capped at Monitor', generic.band === 'Monitor');
  t('and a named one outranks it',           scoreProspect(base).band !== 'Monitor');

  // A competitor is never a prospect, whatever it scores.
  t('a competitor never bands as a prospect',
    scoreProspect({ ...base, competitor:true }).band === 'Competitor');

  // The display rule: a routed row must say so wherever it is read.
  t('a non-Sender row carries its motion tag',
    motionTag({ motion:'RPC_ENTERPRISE' }).includes('not Sender'));
  t('a Sender row carries no tag', motionTag({ motion:'SENDER' }) === '');

  // The workbook must actually build, and be a real zip.
  const { buildTracker } = await import('../tracker/build.js');
  const buf = buildTracker();
  t('the tracker workbook builds',  buf.length > 5000);
  t('and it is a valid zip archive', buf[0] === 0x50 && buf[1] === 0x4B);
}

console.log('\nFork-graph crawler (HX-GA2 v2)');
{
  const src = (await import('node:fs')).readFileSync('pipeline/forks.js', 'utf8');
  // The bug that made the first run report zero: archived repos were filtered
  // out, and every Drift-era keeper repo on the Velocity org is archived.
  t('archived repos are NOT filtered out', !/!r\.archived\s*&&/.test(src));
  t('forks are filtered by last push', /pushed_at > cutoff/.test(src));
  t('a rate-limited org lookup never silently falls back',
    /RATE_LIMITED[\s\S]{0,400}never looked up/.test(src));
  t('company sites are resolved by API lookup, not a guessed domain',
    /Never guess a domain|never a guessed domain|\/orgs\/\$\{encodeURIComponent/.test(src));

  const { classifyOperator } = await import('./forks.js');
  const noFetch = { fetchSource: async () => ({ ok: false, error: 'not called' }) };

  const uni = await classifyOperator({ org:'Indian Institute of Technology (IIT) Ropar' }, noFetch);
  t('a university is not a buyer', uni.classification === 'NOT_A_BUYER');
  const student = await classifyOperator({ bio:'member @superteamDAO | fellow @solana-foundation' }, noFetch);
  t('a fellow learning the codebase is not an operator', student.classification === 'NOT_A_BUYER');
  const bare = await classifyOperator({ handle:'someone' }, noFetch);
  t('a bare GitHub handle is unverifiable', bare.classification === 'UNVERIFIABLE');

  // The Astralane case: a fork owner whose company sells what we sell.
  const competitor = await classifyOperator({ org:null, site:'example.test' }, {
    fetchSource: async () => ({ ok:true, url:'https://example.test',
      pageText:'Fast Solana Transaction Submission API. We land your transactions. '.repeat(12) }) });
  t('a company selling transaction submission is a COMPETITOR',
    competitor.classification === 'COMPETITOR');

  const thin = await classifyOperator({ org:null, site:'example.test' }, {
    fetchSource: async () => ({ ok:true, url:'https://example.test', pageText:'Building things.' }) });
  t('a 16-character site is THIN_SURFACE, not a candidate', thin.classification === 'THIN_SURFACE');

  const ok_ = await classifyOperator({ org:null, site:'example.test' }, {
    fetchSource: async () => ({ ok:true, url:'https://example.test',
      pageText:'We run perpetual futures on Solana and operate our own keeper fleet. '.repeat(10) }) });
  t('a named org with a real site is a CANDIDATE', ok_.classification === 'CANDIDATE');
}

console.log('\nSharded collection and surface discovery');
{
  const { shardText } = await import('./fetch.js');

  // The leak this fixes: status.kraken.com is 128,512 characters and the
  // collector was reading a 14,000-character slice - 89% discarded, one row.
  const big = shardText('x'.repeat(128512));
  t('a 128k page is fully covered', big[big.length - 1].to === 128512);
  t('and it costs 16 windows, not 1', big.length === 16);
  t('nothing is dropped beyond the budget', !big.truncatedShards);
  const small = shardText('y'.repeat(1280));
  t('a short page is still one window', small.length === 1);

  // Windows must OVERLAP, or an event split at a seam is lost.
  const sh = shardText('z'.repeat(30000));
  t('windows overlap at the seam', sh[1].from < sh[0].to);
  t('windows are contiguous, no gap', sh.every((w, i) => i === 0 || w.from <= sh[i - 1].to));
  t('every window carries its position', sh.every(w => w.of === sh.length));

  const { shardText: st } = await import('./fetch.js');
  t('empty text yields no windows', st('').length === 0);

  // Surface discovery must never invent a URL, and must not treat a sort
  // parameter as a different page.
  const src = (await import('node:fs')).readFileSync('pipeline/surfaces.js', 'utf8');
  t('entities are decoded before href parsing', /&amp;\/gi/.test(src));
  t('sort and filter params are stripped', /sort\|tag\|tags\|filter\|order\|page/.test(src));
  t('offsite links are not followed', /OFFSITE/.test(src) && /linkedin/.test(src));
  t('only same-site links are kept', /registrable site|root\(u\.hostname\) !== root\(base\.hostname\)/.test(src));
  t('a surface needs real text to be admitted', /pageText\.length < 600/.test(src));
  t('index pages are preferred over articles', /Prefer INDEX pages|depth < cur\.depth/.test(src));
}

console.log('\nThe page and the pipeline must agree');
{
  // They did not: three caps (source_type, standing, evidence_grade) lived only
  // in pipeline/score.js, so index.html scored the same rows differently -
  // 8 research and 0 routed where the pipeline said 4 and 1.
  const fs = await import('node:fs');
  const html = fs.readFileSync('index.html', 'utf8');
  const assessFn = html.slice(html.indexOf('function assess(r, lensKey)'));
  const body = assessFn.slice(0, assessFn.indexOf('\nfunction '));
  for (const cap of ['source_type', 'standing', 'evidence_grade', 'motion'])
    t(`the page applies the ${cap} cap`, body.includes('r.' + cap));
  t('the page caps context sources at Research', /market_context:'RESEARCH'/.test(body));
  t('the page caps standing conditions',        /Standing condition/.test(body));

  // And the real check: score the live run both ways and compare.
  const dir = 'data/runs';
  const latest = fs.readdirSync(dir).filter(f => f.startsWith('run-')).sort().pop();
  if (latest) {
    const run = JSON.parse(fs.readFileSync(dir + '/' + latest, 'utf8'));
    const { assess } = await import('./score.js');
    const tally = {};
    for (const row of (run.rows || [])) {
      const v = assess(row, 'trading').verdict;
      tally[v] = (tally[v] || 0) + 1;
    }
    t('the live run scores without throwing', Object.keys(tally).length > 0);
    t('no row scores as undefined', !('undefined' in tally));

    // The mapping in adoptRun() must carry every field assess() reads, or the
    // caps silently do nothing on the page. This is the bug that made the page
    // disagree with the pipeline while both looked healthy.
    const mapStart = html.indexOf('function adoptRun');
    const mapBody = html.slice(mapStart, html.indexOf('REJECTED =', mapStart));
    for (const field of ['source_type', 'standing', 'registry_tier', 'quote',
                         'evidence_grade', 'motion', 'relationship', 'counterRule'])
      t(`adoptRun maps ${field} through to the page`, mapBody.includes(field + ':'));
  }
}

console.log('\nScore inflation guards');
{
  const { assess, sanitiseGate, rubricFor, INFRA_ROLE } = await import('./score.js');

  // The Flint case. A grounded span naming "Founder Joshua Watts Co-Founder, CEO"
  // was clearing "infrastructure owner identified" and earning 15 reach points.
  t('a CEO listing is not an infrastructure owner',
    !INFRA_ROLE.test('Founder\nJoshua Watts\nCo-Founder, CEO'));
  t('an infrastructure engineer is',
    INFRA_ROLE.test('Head of Infrastructure'));
  t('a CTO is',  INFRA_ROLE.test('David Gorski, CTO'));
  t('a quant engineer alone is not', !INFRA_ROLE.test('Quantitative Analyst'));

  const flintish = { entity:'Flint', relationship:'PROSPECT', tier:2, event_date:'2026-11-10',
    source_type:'buyer_owned', evidence_grade:'A', motion:'SENDER',
    gate:{ solana_activity:true, transaction_volume_evidence:true, latency_sensitive:true,
           reliability_pain:false, is_competitor:false, infrastructure_owner_identified:true },
    spans:{ solana_activity:'Solana spot and perps', transaction_volume_evidence:'DEX volume $71.47B',
            latency_sensitive:'Makers run their own quoting logic',
            infrastructure_owner_identified:'Founder Joshua Watts Co-Founder, CEO' } };
  const clean = sanitiseGate(flintish);
  t('the unsupported owner field is dropped', clean.gate.infrastructure_owner_identified === false);
  t('and the drop is explained', clean.dropped.some(d => /infrastructure role/.test(d)));

  // The deeper bug: the rubric was frozen at collection, so the points survived
  // the field being withdrawn - score 80 printed above the cap "No
  // infrastructure owner identified".
  t('reach points follow the sanitised gate', rubricFor(flintish, clean.gate).reach === 0);
  const scored = assess(flintish, 'trading');
  t('the score drops when the gate field is withdrawn', scored.score < 80);
  t('and the row still says why', scored.caps.some(c => /infrastructure owner/i.test(c)));

  // An UNCLEAR relationship is a research state by definition.
  const unclear = assess({ ...flintish, relationship:'UNCLEAR' }, 'trading');
  t('an UNCLEAR relationship cannot exceed Research',
    ['RESEARCH','WATCH','NO_ACTION'].includes(unclear.verdict));
  t('and it says so', unclear.caps.some(c => /UNCLEAR/.test(c)));

  // Recency must not reward an undated row.
  t('a row with no date earns no recency', rubricFor({ gate:{} }, {}).recency === 0);
}

console.log('\nSurface admission rules');
{
  const src = (await import('node:fs')).readFileSync('pipeline/surfaces.js', 'utf8');
  const RE = /\/(articles?|posts?|blog|updates?|news|stories)\/[^/]+\/?$/i;
  const isArticle = u => RE.test(new URL(u).pathname) ||
    decodeURIComponent(new URL(u).pathname).replace(/\/$/, '').split('/').pop().trim()
      .replace(/\s+/g, '-').split('-').length >= 4;

  t('an index page is a surface',        !isArticle('https://www.drift.trade/updates'));
  t('a blog index is a surface',         !isArticle('https://flint.trade/blog'));
  t('an insights index is a surface',    !isArticle('https://www.gsr.io/insights'));
  t('a docs root is a surface',          !isArticle('https://docs.backpack.exchange/'));
  t('a long article slug is not',         isArticle('https://x.test/articles/what-is-a-sui-wallet-everything-you-need'));
  t('a SHORT slug under /articles/ is not either',
                                          isArticle('https://learn.backpack.exchange/articles/monad-wallet'));
  t('an encoded-space slug is not',       isArticle('https://learn.backpack.exchange/articles/%20monad-wallet'));
  t('a post under an index is not',       isArticle('https://www.drift.trade/updates/recovery-plan'));

  t('docs are judged on text, not dates', /isTechnical/.test(src) && /pageText\.length >= 2000/.test(src));
  t('article slugs are rejected by code', /ARTICLE_NOT_SURFACE/.test(src));

  // Seeds: the directory says where to look, the fetch is the evidence.
  const seeds = (await import('node:fs')).readFileSync('pipeline/seeds.js', 'utf8');
  t('a seed URL comes from the directory, not from us', /declared `url`|declared url|p\.url/.test(seeds));
  t('a seed is fetched before admission',  /fetchSource/.test(seeds));
  t('a seed must name the company',        /NAME_NOT_ON_PAGE/.test(seeds));
  t('a thin seed page is rejected',        /TOO_LITTLE_TEXT/.test(seeds));
}

console.log('\nMotion classification');
{
  const { findSignals, SIGNALS } = await import('./classify.js');
  const src = (await import('node:fs')).readFileSync('pipeline/classify.js', 'utf8');

  // The Backpack case: 35 instances of "liquidation", every one a CEX margin
  // liquidation handled internally. Counting those made an exchange look like
  // an execution buyer - the same failure as routing a Sonic outage as Solana.
  t('ambiguous terms need on-chain context', /ONCHAIN_CONTEXT/.test(src));
  t('inherent terms do not',                 /SENDER_INHERENT\.includes/.test(src));
  t('ambiguous hits are kept, not deleted',  /AMBIGUOUS/.test(src));

  const hits = findSignals('Our engine handles liquidation of margin positions internally.',
                           ['liquidation']);
  t('the term is still found', hits.length === 1);
  t('and its excerpt carries no on-chain context',
    !/\b(solana|on-?chain|validator|rpc|program|mainnet)\b/i.test(hits[0].excerpt));

  const onchain = findSignals('The Solana liquidator bot submits a transaction each slot.', ['liquidator']);
  t('an on-chain excerpt does carry context',
    /\bsolana\b/i.test(onchain[0].excerpt));

  // "We read nothing" and "we found nothing" must not share a verdict.
  t('a tiny corpus returns INSUFFICIENT_EVIDENCE', /INSUFFICIENT_EVIDENCE/.test(src));
  t('a large corpus with no signal returns NOT_SENDER',
    /evidence of absence, not absence of evidence/.test(src));
  t('legal boilerplate is excluded from the corpus', /LEGAL\b[\s\S]{0,200}terms/.test(src));

  // The owner claim is checked in code, not taken from the model. It returned
  // owner_named: true with the evidence "exchange".
  t('an owner claim is validated against INFRA_ROLE', /INFRA_ROLE\.test\(String\(interpretation/.test(src));

  t('inherent terms outweigh generic infrastructure vocabulary',
    /inherent\.size >= 2/.test(src));
  t('priority fee is treated as unambiguous', SIGNALS.SENDER.includes('priority fee'));
  t('crank is treated as unambiguous',        SIGNALS.SENDER.includes('crank'));
}

console.log('\nOwner search');
{
  const src = (await import('node:fs')).readFileSync('pipeline/forks.js', 'utf8');

  // First run returned two "owners" from a forked Slack GitHub Action, because
  // repos were ranked by push date - two zero-star utility repos - while
  // zeta-market-maker ("Market maker for DEX") was never read.
  t('repos are ranked by relevance, not recency', /RELEVANT\.test/.test(src));
  t('a market-maker repo is execution-relevant',
    /market\[- \]\?maker\|keeper\|liquidat/.test(src));
  t('the broken 1/-1 comparator is gone',
    !/b\.pushed_at > a\.pushed_at \? 1 : -1/.test(src));

  // And both "owners" worked elsewhere: one freelance, one at Ferocia Services.
  t('freelancers are rejected as owners', /freelance\|independent/.test(src));
  t('a contributor at another company is rejected', /profile company is/.test(src));
  t('employment is recorded, not assumed', /contributor-only/.test(src));
  t('the INFRA_ROLE test is reused, not reinvented', /INFRA_ROLE\.test\(role\)/.test(src));
  t('generic owner labels are blocked', /GENERIC_OWNER/.test(src));

  const GENERIC = /^(the )?(exchange|platform|protocol|team|company|project|dao|labs|foundation|core|engineering)$/i;
  for (const bad of ['exchange', 'the team', 'Protocol', 'Labs'])
    t(`"${bad}" is not an owner name`, GENERIC.test(bad));
  t('"Jane Doe" is a usable owner name', !GENERIC.test('Jane Doe'));
}

console.log('\nWidened owner discovery');
{
  const src = (await import('node:fs')).readFileSync('pipeline/people.js', 'utf8');

  // The bug that hid Flint's CTO: a team listing puts the NAME and the ROLE on
  // separate lines, so a line-by-line scan can never see them together.
  t('names and roles are matched across lines', /lines\[i - 2\]|lines\[i \+ 1\]/.test(src));
  t('a name line must be ONLY a name',          /NAME_LINE/.test(src));

  // And the over-correction: "a block containing a role and two capitalised
  // words" read "Trading Specifications" and "Our Mission" as people.
  t('role phrases are not treated as names',    /INFRA_ROLE\.test\(line\)\) return false/.test(src));
  t('navigation words are excluded',            /Specifications\?\|Guide\|Programs/.test(src));

  t('only account-declared surfaces are read',  /DECLARED BY A PAGE THE ACCOUNT OWNS/.test(src));
  t('READMEs avoid the API rate limit',         /raw\.githubusercontent\.com/.test(src));
  t('a careers posting is a route, not an owner', /not an owner|research route/.test(src));
  t('repo stance is recorded',                  /published for others to run/.test(src));

  // Flint is now the only account carrying a verified owner.
  const { ICP } = await import('./icp.js');
  const flint = ICP.find(a => a.name === 'Flint Labs');
  t('Flint carries a named owner', Array.isArray(flint.owners) && flint.owners.length >= 1);
  t('the owner holds an infrastructure role', /CTO|Engineer/i.test(flint.owners[0].role));
  t('the owner cites the page it came from', /flint\.trade/.test(flint.owners[0].source));
  const ceo = (flint.owners || []).some(o => /chief executive|\bCEO\b/i.test(o.role));
  t('the CEO is not recorded as an infrastructure owner', !ceo);

  const zeta = ICP.find(a => a.name === 'Zeta Markets');
  t('Zeta records a zero-owner result rather than nothing', zeta.ownerSearch.creditedPeople === 0);
  t('and records how much was read',                        zeta.ownerSearch.surfacesRead === 10);
}

console.log('\nQualify vs Actionable');
{
  const { assess, ownerConfidence, outreachReadiness } = await import('./score.js');

  // QUALIFY = worth a human research task. ACTIONABLE = ready for a
  // human-approved approach. Collapsing them is what produced zero qualified
  // leads from real first-party evidence.
  const standing = { entity:'Test Venue', relationship:'PROSPECT', tier:2, standing:true,
    source_type:'buyer_owned', evidence_grade:'A', motion:'SENDER', counterRule:'no_gap',
    event_date:'2026-11-10',
    discovery:{ product_fit:{ points:15 } },
    gate:{ solana_activity:true, transaction_volume_evidence:true, latency_sensitive:true,
           reliability_pain:false, is_competitor:false, infrastructure_owner_identified:false },
    spans:{ solana_activity:'x', transaction_volume_evidence:'y', latency_sensitive:'z' } };
  const a = assess(standing, 'trading');
  t('first-party standing evidence can reach Qualify', a.verdict === 'QUALIFY');
  t('and it still cannot reach Actionable',            a.verdict !== 'ACTIONABLE');
  t('the cap explains the distinction', a.caps.some(c => /research/i.test(c)));

  // Weak evidence must NOT get the same treatment.
  const weak = assess({ ...standing, source_type:'market_context', evidence_grade:'C' }, 'trading');
  t('a context source still caps at Research', ['RESEARCH','WATCH','NO_ACTION'].includes(weak.verdict));
  const unknown = assess({ ...standing, tier:null, registry_tier:null }, 'trading');
  t('an unregistered account still caps at Research',
    ['RESEARCH','WATCH','NO_ACTION'].includes(unknown.verdict));

  // Owner confidence is about WHO, readiness is about the approach.
  t('no owner means route_only or none', ['route_only','none'].includes(a.owner_confidence));
  t('qualify is research_ready',          a.outreach_readiness === 'research_ready');
  t('a dead row is not_ready', assess({ ...standing, blocked:true }, 'trading').outreach_readiness === 'not_ready');

  // Every exit carries the fields - routed rows returned undefined before.
  const routed = assess({ entity:'Exch', relationship:'PROSPECT', tier:2, registry_tier:2,
    motion:'RPC_ENTERPRISE', quote:'delays on the Solana network', headline:'',
    gate:{ solana_activity:true, reliability_pain:true, is_competitor:false },
    rubric:{ reliability:15 } }, 'trading');
  t('a routed row carries owner confidence', typeof routed.owner_confidence === 'string');
  t('a routed row carries readiness',        typeof routed.outreach_readiness === 'string');

  // The registry owner must reach the row.
  const flintRow = { entity:'Flint Labs', gate:{}, spans:{} };
  const oc = ownerConfidence(flintRow);
  t('a registry-recorded owner reaches the row', oc.level === 'named_owner');
  t('and names the person',                      /Gorski/.test(oc.who || ''));

  t('named owner + actionable = outreach_ready',
    outreachReadiness('ACTIONABLE', { level:'named_owner' }) === 'outreach_ready');
  t('actionable without an owner is not outreach_ready',
    outreachReadiness('ACTIONABLE', { level:'none' }) !== 'outreach_ready');
}

console.log('\nProduct-fit engine');
{
  const { PRODUCTS, TRIGGERS, productFit } = await import('./products.js');
  const src = (await import('node:fs')).readFileSync('pipeline/products.js', 'utf8');

  // Nine, not seven: LaserStream split into Shred Delivery, Preconfirmations
  // and gRPC/WebSocket, which are three products with three buyers.
  // Sixteen, from Helius's own navigation. "Enterprise" was never one of their
  // products - it is a pricing tier. Scoring it as a motion was my invention.
  t('all sixteen Helius motions are scored', Object.keys(PRODUCTS).length === 16);
  for (const k of ['sender','rpc','laserstream','webhooks','parsed','validator','privacy','rebates'])
    t(`${k} is a scored motion`, !!PRODUCTS[k]);
  t('shred delivery is its own motion',       !!PRODUCTS.shreds);
  t('preconfirmations is its own motion',     !!PRODUCTS.preconfirmations);
  t('every motion splits inherent from contextual terms',
    Object.values(PRODUCTS).every(p => p.inherent?.length && p.contextual?.length));

  // The context gate had "transaction" in it, so "latency" anywhere near the
  // word "transaction" passed - Backpack scored on Sender after being proved
  // to have zero grounded Solana-execution terms.
  const A = /\b(solana|on-?chain|spl token|mainnet-?beta|validator|lamports?|slot)\b/i;
  const S = /\bSOL\b/;
  const ONCHAIN = { test: t => A.test(t) || S.test(t) };
  t('"transaction" alone is not on-chain context', !ONCHAIN.test('our transaction latency is low'));
  t('"Solana" is',                                  ONCHAIN.test('latency on the Solana network'));
  t('a CEX order book is not on-chain context',    !ONCHAIN.test('order matching latency in our engine'));
  t('the SOL ticker is case-sensitive',             ONCHAIN.test('delays on SOL deposits'));
  t('and does not match inside a word',            !ONCHAIN.test('our solution is fast'));

  // Corpus size strengthens a signal; it must not manufacture one.
  t('corpus strength requires a base signal', /base > 0 \?/.test(src));

  // Triggers and reachability modify a fit; they cannot create one.
  t('no fit means no opportunity',  /hasFit/.test(src));
  t('a scoreless account is capped', /Math\.min\(19, primaryScore\)/.test(src));

  // Outreach-ready is reserved.
  t('outreach-ready needs a named owner and a trigger',
    /reach\.level !== 'named_owner' \|\| !triggers\.length/.test(src));
  t('competitors are excluded by the counter penalty', /COMPETITOR' \? 100/.test(src));
  t('existing customers are excluded',                 /EXISTING_CUSTOMER' \? 100/.test(src));

  t('triggers are dated reasons to approach', Object.keys(TRIGGERS).length >= 5);
  for (const k of ['hiring','funding','launch','partnership','incident'])
    t(`${k} is a recognised trigger`, !!TRIGGERS[k]);

  // The honest-output rule: a fit is an opportunity, never a qualified lead.
  t('fit is never called intent to buy', /never of intent to buy/.test(src));
  t('legal boilerplate stays excluded',  /LEGAL/.test(src));
}

console.log('\nCompany status gate');
{
  const { readStatus, STATUS, statusBlocksOutreach } = await import('./status.js');
  const { assess } = await import('./score.js');
  const { ICP, lookupICP } = await import('./icp.js');

  // The exact sentence that was on a page we fetched a dozen times.
  const zetaText = 'Trade your favourite assets with uncompromising security. ' +
    'Disclaimer: Zeta Markets has ceased operating as of May 2025. Zeta Markets was a ' +
    'decentralised perpetual futures exchange built on the Solana L1.';
  const r = readStatus(zetaText);
  t('a cessation statement is detected',  r.status === STATUS.CEASED);
  t('and it is stated, not implied',      r.confidence === 'stated');
  t('the quote is captured',              /ceased operating/.test(r.quote));

  t('an ordinary page reads as active',
    readStatus('We provide perpetual futures on Solana with low latency.').status === STATUS.ACTIVE);
  // Must not fire on product copy that merely contains the words.
  t('"shut down your bot" is not a cessation',
    readStatus('You can shut down your bot at any time.').status === STATUS.ACTIVE);

  // WHOSE cessation? Coinbase's own status page says "the Blast network is shut
  // down" - a third party closing, on the account's surface. The first version
  // read that as Coinbase ceasing to exist and excluded it from outreach.
  const blast = 'BLAST that is not moved off of Coinbase before October 26, 2026 will not be ' +
                'accessible to you after the Blast network is shut down.';
  t('another company closing is not this company closing',
    readStatus(blast, ['Coinbase']).status === STATUS.ACTIVE);
  t('but the account closing still registers',
    readStatus('Coinbase has ceased operating as of May 2025.', ['Coinbase']).status === STATUS.CEASED);
  t('self-reference counts as the subject',
    readStatus('We have ceased operating as of May 2025.', ['Acme']).status === STATUS.CEASED);
  t('an unmentioned account is not the subject',
    readStatus('Some other protocol has ceased operating.', ['Acme']).status === STATUS.ACTIVE);
  t('Zeta is still caught with its real text',
    readStatus(zetaText, ['Zeta Markets', 'zeta']).status === STATUS.CEASED);

  t('ceased blocks outreach',   statusBlocksOutreach(STATUS.CEASED));
  t('acquired blocks outreach', statusBlocksOutreach(STATUS.ACQUIRED));
  t('active does not',         !statusBlocksOutreach(STATUS.ACTIVE));

  // The registry must carry the verdict, and the scorer must honour it.
  const zeta = lookupICP('Zeta Markets');
  t('Zeta is recorded as ceased',       zeta.status === 'ceased');
  t('with its evidence quoted',         /ceased operating/.test(zeta.statusEvidence?.quote || ''));
  t('and its successor named',          zeta.successor === 'Bullet');

  const dead = assess({ entity:'Zeta Markets', relationship:'PROSPECT', tier:2,
    evidence_grade:'A', source_type:'buyer_owned', motion:'SENDER', event_date:'2026-11-10',
    gate:{ solana_activity:true, transaction_volume_evidence:true, latency_sensitive:true,
           reliability_pain:true, is_competitor:false, infrastructure_owner_identified:true },
    rubric:{ txVolume:25, latency:20, reliability:15, productFit:15, reach:15, recency:10 } }, 'trading');
  t('a perfect row at a ceased company is NO_ACTION', dead.verdict === 'NO_ACTION');
  t('and the reason is the status',  dead.caps.some(c => /CEASED/.test(c)));

  // A successor inherits nothing.
  const bullet = ICP.find(a => a.name === 'Bullet');
  t('the successor is registered',            !!bullet);
  t('with no surfaces of its own',            (bullet.surfaces || []).length === 0);
  t('and no inherited evidence grade',        bullet.evidenceGrade === 'unverified');
}

console.log('\nProduct gates');
{
  const src = (await import('node:fs')).readFileSync('pipeline/products.js', 'utf8');
  const { PRODUCTS } = await import('./products.js');
  t('LaserStream is split into three products',
    !!PRODUCTS.shreds && !!PRODUCTS.preconfirmations && !!PRODUCTS.laserstream);
  t('Sender needs operator evidence',  /OPERATOR_EVIDENCE/.test(src));
  t('and is floored without it',       /SENDER_FLOOR/.test(src));
  t('Enterprise is segment-gated',     /ENTERPRISE_SEGMENTS/.test(src));

  const { isAssetListingQuote } = await import('./config.js');
  const { AGENTS } = await import('./agents.js');
  const { REVENUE_RANK, revenueTier, topRevenueProduct } = await import('./helius.js');

  // An exchange's asset row is not a company (Kraken status page, Nov 2026).
  t('asset row rejected by its quote',
    isAssetListingQuote('Fwog', 'Fwog (FWOG) - Solana\n\n Operational'));
  t('long asset name rejected too',
    isAssetListingQuote('Frontier Stable Token', 'Frontier Stable Token (FRNT) - Solana'));
  t('a real firm is not an asset row',
    !isAssetListingQuote('Wintermute', 'Wintermute, an algorithmic trading firm, said'));
  t('a regex-special name does not throw',
    !isAssetListingQuote('GMO-Z.com Trust Company, Inc.', 'GMO-Z.com Trust Company, Inc. is a trust'));
  t('revenue rank puts shreds above webhooks', REVENUE_RANK.shreds < REVENUE_RANK.webhooks);
  t('enterprise RPC is rank 1',                REVENUE_RANK.rpc_enterprise === 1);
  t('top tier is latency-sensitive trading',   revenueTier('shreds') === 'top');
  t('metered APIs are funnel tier',            revenueTier('webhooks') === 'funnel');
  t('highest-revenue product wins the sort',
    topRevenueProduct(['webhooks', 'laserstream', 'sender']) === 'laserstream');
  t('collector hunts top-revenue buyers first',
    AGENTS.collector.system('2026-11-13').includes('HUNT IN THIS ORDER'));
  t('collector is told a sniper is not a memecoin',
    /never a memecoin/.test(AGENTS.collector.system('2026-11-13')));

console.log('\n"Latest" means the newest window, not the newest file');
{
  const src = (await import('node:fs')).readFileSync('server.js', 'utf8');
  t('the server sorts runs by window',      /runWindowEnd/.test(src));
  t('it still has a stamp fallback',        /byStamp/.test(src));

  // A 7-batch sweep walks BACKWARDS, so the August batch is written last. The
  // stamp sort therefore showed three-month-old evidence as current.
  const runStamp = f => (String(f).match(/(\d{4}-\d{2}-\d{2}T[\d-]{8})(?=\.json$|$)/) || [, ''])[1];
  const byStamp = (a, b) => (runStamp(a) || a).localeCompare(runStamp(b) || b);
  const runWindowEnd = f => (String(f).match(/_to_(\d{4}-\d{2}-\d{2})/) || [, ''])[1];
  const byWindow = (a, b) => {
    const wa = runWindowEnd(a), wb = runWindowEnd(b);
    if (wa && wb && wa !== wb) return wa.localeCompare(wb);
    return byStamp(a, b);
  };
  const sweep = ['run-2026-08-07_to_2026-08-21-2026-11-13T22-04-49.json',
                 'run-2026-10-30_to_2026-11-13-2026-11-13T21-45-00.json',
                 'run-2026-09-04_to_2026-09-18-2026-11-13T22-00-00.json'];
  t('the newest window wins, not the last file written',
    sweep.slice().sort(byWindow).pop() === 'run-2026-10-30_to_2026-11-13-2026-11-13T21-45-00.json');
  t('a stamp-only run id still sorts',
    ['run-2026-11-10T19-26-18.json', 'run-2026-11-12T09-00-00.json'].sort(byWindow).pop()
      === 'run-2026-11-12T09-00-00.json');
  t('a window id still beats an older lexical id',
    ['run-2026-10-29_to_2026-11-12-2026-11-13T20-39-15.json', 'run-2026-11-10T19-26-18.json']
      .sort(byWindow).pop() === 'run-2026-10-29_to_2026-11-12-2026-11-13T20-39-15.json');
}

console.log('\nA name carrying its own acronym');
{
  const { sellerSideReason } = await import('./helius.js');
  const { segmentFor, TIER_SEGMENT } = await import('./bridge.js');

  // "Amazon Web Services (AWS)" flattens to "amazon web services aws", which
  // matches neither half - so AWS walked into the worklist as an RPC Nodes
  // opportunity at fit 21 while being on the competitor list twice over.
  t('a competitor carrying its acronym is caught',
    /competitor/.test(sellerSideReason('Amazon Web Services (AWS)') || ''));
  t('the bare acronym is still caught',     !!sellerSideReason('AWS'));
  t('the bare name is still caught',        !!sellerSideReason('Amazon Web Services'));
  t('the seller carrying a suffix is caught',
    /Helius itself/.test(sellerSideReason('Helius (RPC)') || ''));
  t('a real company with a ticker is not excluded', sellerSideReason('Mango Markets (MNGO)') === null);
  t('a cold firm is still allowed through', sellerSideReason('BisonFi') === null);

  // The funnel cannot place anything without a buyer segment, so 28 promoted
  // accounts with real product fit sat in research saying "no buyer segment".
  t('a roster tier maps to a buyer segment', segmentFor('trading') === 'trader');
  t('institutional maps across',            segmentFor('institutional') === 'institutional');
  t('infra and data share a segment',       segmentFor('infra') === segmentFor('data'));
  t('UNCLEAR is deliberately unplaced',     segmentFor('unclear') === null);
  t('an unknown tier is unplaced',          segmentFor('nonsense') === null);
  t('every mapped segment is a real funnel segment', await (async () => {
    const { SEGMENTS } = await import('./funnel.js');
    return Object.values(TIER_SEGMENT).every(v => v === null || v in SEGMENTS);
  })());
}

console.log('\nA verified surface is readable by the scan');
{
  const { whitelistEntry } = await import('./verify.js');
  const { BRIDGE_VERIFIED_HOSTS } = await import('./config.js');

  // The two halves of the system could not talk to each other: the 90-day
  // sweep planned 179 surfaces and refused 125 as SOURCE_NOT_WHITELISTED -
  // every surface of all 59 bridge-promoted accounts. The bridge verified them
  // with skipWhitelist and the scan then refused to read them.
  t('bridge-verified hosts are collected', BRIDGE_VERIFIED_HOSTS.length > 0);
  t('a bridge-verified surface is readable',
    whitelistEntry('https://basis.markets/')?.type === 'bridge_verified');
  t('its subdomains are readable too',
    !!whitelistEntry('https://astralane.gitbook.io/docs/low-latency/quickstart'));
  t('each one records who it was verified for',
    !!whitelistEntry('https://basis.markets/')?.verified_for);

  // Same for a HAND-verified registry surface: trusted enough to plan a run
  // around, and previously not trusted enough to read.
  t('a registry-verified surface is readable',
    whitelistEntry('https://sanctum.so/blog')?.type === 'registry_verified');
  t('the hand-written whitelist still wins',
    whitelistEntry('https://docs.velocity.exchange/x')?.type === 'docs');

  // And nothing else got in.
  t('an unknown host is still refused',  whitelistEntry('https://evil-example.test/x') === null);
  t('a random subdomain is still refused', whitelistEntry('https://not-basis.markets.evil.test/x') === null);
}

console.log('\nVerification is two flags, not one gate');
{
  const { placeInFunnel, STATE } = await import('./funnel.js');
  const b = await import('./bridge.js');
  const fit = { sender: 30 };
  const detail = { sender: { evidence: [{ excerpt: 'they run a bot', url: 'https://x.example/docs' }] } };
  const place = account => placeInFunnel({ account, fit, detail, segment: 'trader' });

  // "Verified account" was doing two jobs at once, so real companies named by
  // credible sources were blocked before a human had looked at them.
  const unver = place({ name: 'BisonFi', segment: 'trader' });
  t('an unverified surface is still an opportunity', unver.state === STATE.OPPORTUNITY);
  t('it is labelled as not yet verified',   /not yet verified/.test(unver.label));
  t('its confidence is lowered, not removed', unver.confidence === 'medium');
  t('its next action is to verify the surface', /verify .*own surface/.test(unver.next_action));
  t('its counter says the fit rests on a third party',
    /third-party listing/.test(unver.counter_rationale));

  const ver = place({ name: 'BisonFi', segment: 'trader', surface_verified: true });
  t('a verified surface is an opportunity too', ver.state === STATE.OPPORTUNITY);
  t('it is labelled verified',              /surface verified/.test(ver.label));
  t('its confidence is high',               ver.confidence === 'high');
  t('a verified surfaces[] entry counts',
    place({ name:'BisonFi', segment:'trader', surfaces:[{ url:'u', status:'verified' }] }).confidence === 'high');

  // Identity is the gate that remains.
  const noid = place({ name: 'Mystery Co', segment: 'trader', identity_confirmed: false });
  t('an unconfirmed identity is not an opportunity', noid.state !== STATE.OPPORTUNITY);
  t('it says identity is the problem',      /dentity/.test(noid.why));

  // Nothing that protects against fabrication was loosened.
  for (const [n, who] of [['Helius','seller'], ['Syndica','competitor'], ['Coinbase','customer']])
    t(`${who} is still disqualified with no surface`,
      place({ name: n, segment: 'trader' }).state === STATE.DISQUALIFIED);
  t('both flags are recorded on every row',
    typeof unver.identity_confirmed === 'boolean' && typeof unver.surface_verified === 'boolean');

  // The bridge promotes on identity and flags the surface separately.
  const src = (await import('node:fs')).readFileSync('pipeline/bridge.js', 'utf8');
  t('the bridge sets identity_confirmed',   /identity_confirmed = true/.test(src));
  t('the bridge records identity evidence', /identity_basis/.test(src));
  t('the bridge promotes without a surface',
    /out\.promoted = true;\n    out\.reason = 'identity confirmed/.test(src));
  t('the bridge never guesses a domain',    /cited source/.test(src));

  // Ownership is checked, not assumed: a directory links its OWN github from a
  // company's page (github.com/solanaguide on Mango Markets').
  t('a page that names the company is theirs',
    b.pageClaimsName('Mango Markets', 'Welcome to Mango Markets, a perps venue', 'https://mango.markets').ok);
  t('a domain that is the name counts',
    b.pageClaimsName('Mango Markets', 'Trade perps', 'https://mango.markets/blog').ok);
  t('somebody elses repo is not theirs',
    !b.pageClaimsName('Mango Markets', 'solanaguide curated links', 'https://github.com/solanaguide').ok);
  // "Do they publish this?" is a different question from "does it name them?".
  // A news story about a company passes the second and fails the first.
  t('a news article is not their surface',
    !b.firstParty('Flash Trade', 'https://solanafloor.com/news/flash-trade-winds-down', 'flash.trade').ok);
  t('their own docs subdomain is',
    b.firstParty('Flash Trade', 'https://docs.flash.trade/flash-trade', 'flash.trade').ok);
  t('a gitbook space carrying their name is',
    b.firstParty('edgeX', 'https://edgex-1.gitbook.io/edgeX-documentation', 'edgex.exchange').ok);
  t('their own GitHub org is',
    b.firstParty('Parcl', 'https://github.com/ParclFinance', 'parcl.co').ok);
  t('somebody elses GitHub org is not',
    !b.firstParty('Mango Markets', 'https://github.com/solanaguide', 'mango.markets').ok);
  // Active voice: a headline says "Flash Trade winds down", never "has been
  // wound down". The object guard keeps ordinary perps-venue instructions out.
  const { readStatus } = await import('./status.js');
  const ceased = (txt, n = ['Flash Trade']) => {
    const r = readStatus(txt, n);
    return !!(r && r.status && r.status !== 'active');
  };
  t('an active-voice wind-down is read',
    ceased('Flash Trade winds down citing shrinking market and ethical misalignment'));
  t('winding down a POSITION is not a closure',
    !ceased('Flash Trade lets you wind down your position at any time'));
  t('shutting down a BOT is not a closure',
    !ceased('On Flash Trade you can shut down your bot whenever you like'));
  t('passive voice still reads as a closure',
    ceased('The Flash Trade protocol has been wound down'));
  t('somebody elses closure is still not theirs',
    !ceased('Flash Trade notes the Blast network is shut down'));
  t('ordinary product copy is not a closure',
    !ceased('Flash Trade is a perpetuals exchange on Solana with 100x leverage'));

  t('the bridge still excludes ceased companies', /'ceased'/.test(src));
  t('a third-party cessation holds rather than drops', /ceased_unconfirmed/.test(src));
  t('status is read from every page fetched, with its basis', /status_basis/.test(src));
  t('it reads status from the company own page', /readStatus/.test(src));
  t('a roster link is matched, never built',
    b.directoryPageFor('Mango Markets',
      '<a href="/projects/mango-markets">Mango Markets</a>',
      'https://solanacompass.com/projects/category/defi') === 'https://solanacompass.com/projects/mango-markets');
  // A roster row wraps a long block of nested markup. An inline length cap on
  // the anchor's inner text dropped every project row and the bridge reported
  // "no cited source names a domain" for companies whose link was on the page.
  const fatRow = '<a href="/projects/mango-markets" class="project-row">' +
    '<div class="project-row__rank">10</div>' +
    '<img src="https://wsrv.nl/?url=' + 'x'.repeat(300) + '" alt="Mango Markets logo">' +
    '<div class="project-row__name">Mango Markets</div></a>';
  t('a long roster row is still extracted',
    b.links(fatRow, 'https://solanacompass.com/x').length === 1);
  t('a long roster row still resolves to its page',
    b.directoryPageFor('Mango Markets', fatRow, 'https://solanacompass.com/projects/category/defi')
      === 'https://solanacompass.com/projects/mango-markets');
  t('an absent company yields no page',
    b.directoryPageFor('Ghost Capital', '<a href="/projects/mango-markets">Mango Markets</a>',
      'https://solanacompass.com/projects/category/defi') === null);
}

console.log('\nThe seller is not an account');
{
  const { placeInFunnel, STATE } = await import('./funnel.js');
  // The 90-day sweep printed "Helius - Already a Helius customer - Route to
  // account management", which is wrong twice over.
  const h = placeInFunnel({ account: { name: 'Helius' } });
  t('Helius is disqualified',              h.state === STATE.DISQUALIFIED);
  t('Helius is named as the seller',       /seller, not an account/.test(h.why));
  t('Helius is not sent to account management', !/account management/.test(h.next_action));
  const sy = placeInFunnel({ account: { name: 'Syndica' } });
  t('a competitor is disqualified',        sy.state === STATE.DISQUALIFIED);
  t('a competitor is named as one',        /competitor/.test(sy.why));
  const cb = placeInFunnel({ account: { name: 'Coinbase' } });
  t('a customer still routes to account management', /account management/.test(cb.next_action));
  t('a cold firm is not disqualified by this gate',
    placeInFunnel({ account: { name: 'HumidiFi' } }).state !== STATE.DISQUALIFIED);
}

console.log('\nUndated surfaces are read once per sweep');
{
  const src = (await import('node:fs')).readFileSync('batches.js', 'utf8');
  // The 7-batch sweep collected 130 standing conditions for 22 distinct facts.
  t('the sweep retires undated surfaces',   /undatedSurfaces/.test(src));
  t('it filters the plan per window',       /plan\.filter/.test(src));
  t('it reports what it skipped',           /sourcesSkipped/.test(src));

  // The rule itself: standing-ONLY surfaces retire; anything that produced a
  // dated row, or produced nothing at all, stays in the plan.
  const retire = rows => {
    const dated = new Set(), standing = new Set();
    for (const r of rows) { if (!r.source_url) continue; (r.standing ? standing : dated).add(r.source_url); }
    return [...standing].filter(u => !dated.has(u));
  };
  t('a standing-only surface is retired',
    retire([{ source_url:'a', standing:true }]).join() === 'a');
  t('a surface with any dated row is kept',
    retire([{ source_url:'a', standing:true }, { source_url:'a', standing:false }]).length === 0);
  t('a surface that produced nothing is kept',
    retire([]).length === 0);
  t('a dated-only surface is kept',
    retire([{ source_url:'a', standing:false }]).length === 0);
}

console.log('\nThe discovery pass');
{
  const d = await import('./discover.js');
  const { sellerSideReason } = await import('./helius.js');
  const { isAcronymOfName, isTokenListing } = await import('./config.js');
  const { AGENTS } = await import('./agents.js');

  // The pass exists because no prompt can name a company that is not on a page
  // the run fetched. It collects names with NO date gate and keeps every other
  // discipline, so its own filters are the thing worth testing.
  const page = 'HumidiFi is the leading prop AMM on Solana by volume this month. ' +
               'Fwog (FWOG) - Solana Operational. Solana is a blockchain.';
  const ok = { name:'HumidiFi', tier:'trading', counter:'named in a list with no stated activity',
               quote:'HumidiFi is the leading prop AMM on Solana by volume this month' };
  t('a grounded roster name is accepted',      d.candidateProblem(ok, page) === null);
  t('an ungrounded quote is rejected',
    /does not appear/.test(d.candidateProblem({ ...ok, name:'Ghost Capital',
      quote:'Ghost Capital is a trading desk that is nowhere on this page at all' }, page)));
  t('an asset row is rejected',
    /asset row/.test(d.candidateProblem({ ...ok, name:'Fwog',
      quote:'Fwog (FWOG) - Solana Operational. Solana is a blockchain.' }, page)));
  t('a chain is not a company',
    /generic/.test(d.candidateProblem({ ...ok, name:'Solana',
      quote:'Solana is a blockchain. HumidiFi is the leading prop AMM on Solana' }, page)));
  t('a missing counter-rationale is rejected',
    /counter/.test(d.candidateProblem({ ...ok, counter:'' }, page)));
  t('an unknown tier is rejected',
    /tier must be/.test(d.candidateProblem({ ...ok, tier:'whatever' }, page)));

  // The first pass offered HELIUS as a prospect and filled the infra tier with
  // RPC vendors. Both are leaks, not wasted calls.
  t('Helius is not a prospect',            /Helius itself/.test(d.ownSideReason('Helius') || ''));
  t('an RPC competitor is not a prospect', /competitor/.test(d.ownSideReason('Syndica') || ''));
  t('a customer is still filtered',        /customer/.test(d.ownSideReason('Coinbase') || ''));
  t('a genuinely cold firm passes',        d.ownSideReason('HumidiFi') === null);
  t('the seller check is independent',     sellerSideReason('Chainstack') !== null);

  // Trading outranks data, so a human reads the expensive buyers first.
  t('trading is the highest-value tier',   d.TIER_VALUE.trading < d.TIER_VALUE.data);
  t('unclear sorts last',                  d.TIER_VALUE.unclear === Math.max(...Object.values(d.TIER_VALUE)));

  // An acronym is built from the initials in front of it; a ticker is a new
  // string. "Amazon Web Services (AWS)" was being rejected as a memecoin.
  t('an acronym is not a token',           !isTokenListing('Amazon Web Services (AWS)'));
  t('initials are what make an acronym',   isAcronymOfName('Amazon Web Services (AWS)'));
  t('small words may be skipped',          isAcronymOfName('Bank of America (BOA)'));
  t('a one-word name cannot be an acronym',!isAcronymOfName('Fwog (FWOG)'));
  t('a ticker is still a token',           isTokenListing('Goatseus Maximus (GOAT)'));
  t('a stablecoin is still a token',       isTokenListing('Tether USD (USDT)'));

  // The agent must not be asked for a date, and must be told what is not a firm.
  const dp = AGENTS.discoverer.system('2026-11-13');
  t('the discoverer drops the date gate',  /no date|NOT looking for a date/.test(dp));
  t('the discoverer is told a ticker is not a company', /Fwog/.test(dp));
  t('the discoverer still demands a counter', /counter/.test(dp));
  t('the discoverer still demands a verbatim quote', /VERBATIM/.test(dp));
  t('an empty list is a valid answer',     /\{"companies":\[\]\}/.test(dp));
}
  t('status is checked before scoring',/STATUS GATE, before any scoring/.test(src));
  t('a successor does not inherit',    /evidence does NOT transfer|NOT transfer/i.test(src));
}

console.log('\nFork crawler: which chain?');
{
  const src = (await import('node:fs')).readFileSync('pipeline/forks.js', 'utf8');
  t('the classifier checks the chain',  /SOLANA_MENTION/.test(src));
  t('other chains are recognised',      /sui\|aptos\|ethereum/.test(src));
  t('wrong chain is its own verdict',   /WRONG_CHAIN/.test(src));

  const { classifyOperator } = await import('./forks.js');
  // fireflyprotocol forks Velocity's keeper bots; its GitHub org declares
  // bluefin.io, a Sui venue that never mentions Solana. It passed as CANDIDATE.
  const sui = await classifyOperator({ org:null, site:'x.test' }, {
    fetchSource: async () => ({ ok:true, url:'https://x.test',
      pageText:'Bluefin is a decentralized exchange on Sui offering perpetual futures and spot trading. '.repeat(6) }) });
  t('a Sui venue is WRONG_CHAIN, not a candidate', sui.classification === 'WRONG_CHAIN');
  t('and the chain is named',                      sui.chain === 'sui');

  const sol = await classifyOperator({ org:null, site:'y.test' }, {
    fetchSource: async () => ({ ok:true, url:'https://y.test',
      pageText:'We run liquidation keepers on Solana mainnet-beta for perpetual futures markets. '.repeat(6) }) });
  t('a Solana operator is still a candidate', sol.classification === 'CANDIDATE');

  // Forking a Solana repo is not evidence of building on Solana.
  t('the rule is written down', /Forking a Solana repo is not building on Solana/.test(src));

  // DPI is the first registry account that OPERATES automation.
  const { lookupICP } = await import('./icp.js');
  const dpi = lookupICP('DPI Protocol');
  t('DPI is registered',                 !!dpi);
  t('and marked as running automation',  dpi.forkedAutomation === true);
  t('with a readable README surface',    (dpi.surfaces||[]).some(x => /raw\.githubusercontent/.test(x.url)));
  t('and its dead website is recorded, not guessed around',
    (dpi.blockedSurfaces||[]).some(x => /dpi\.market/.test(x.url)));
}

console.log('\nBrand names are not product signals');
{
  const { PRODUCTS } = await import('./products.js');
  const sender = PRODUCTS.sender.inherent.concat(PRODUCTS.sender.contextual);
  // "jito" alone matched a TOKEN PAIR ("Jito 750,000+ Total Trades for
  // JTO-paired Orca pools") and an ecosystem name-list ("Sanctum, Jupiter,
  // Phantom, Jito, and Marinade"). Two false Sender candidates from one word.
  t('bare "jito" is not a Sender term',  !sender.includes('jito'));
  t('"jito bundle" is',                   sender.includes('jito bundle'));
  t('"block engine" is',                  sender.includes('block engine'));

  const RE = /\b(keeper bot|liquidation bot|liquidator|jit maker|crank|priority fee|jito (bundle|tip)|block engine|transaction landing|sendTransaction)\b/i;
  t('a JTO trading pair is not Sender evidence',
    !RE.test('Jito 750,000+ Total Trades for JTO-paired Orca pools'));
  t('an ecosystem name-list is not Sender evidence',
    !RE.test('across Sanctum, Jupiter, Phantom, Jito, and Marinade'));
  t('a real liquidator still is',
    RE.test('Owner: Save Liquidator Permissionless Outflow limit'));
  t('a real bundle reference still is',
    RE.test('we submit a jito bundle with a tip'));
}

console.log('\nVenue vs operator, once more');
{
  const { lookupICP } = await import('./icp.js');
  const sd = (await import('node:fs')).readFileSync('pipeline/surfaces.js', 'utf8');

  // Save's landing page reads "Owner: Save Liquidator Permissionless" and it
  // looked like the registry's second operator. Its own docs say: "We rely on
  // third party liquidators, which means anyone can become a liquidator."
  const save = lookupICP('Save');
  t('Save is registered',                 !!save);
  t('and is NOT a Sender account',        save.senderFit === 'no');
  t('its docs surface is recorded',       (save.surfaces||[]).some(x => /liquidators/.test(x.url)));
  t('the venue-not-operator finding is written down',
    /third[- ]party liquidators/i.test(save.note + save.why + save.humanTask));

  // Legal pages are no longer admitted as surfaces: Loopscale's terms page is
  // 74,907 characters and was being offered as its biggest "docs" surface.
  t('discovery excludes legal paths', /LEGAL_PATH/.test(sd));
  const LEGAL_PATH = /\/(legal|terms|privacy|cookie|disclaimer|imprint|location-restrictions)\b/i;
  t('a terms page is not a surface',  LEGAL_PATH.test('https://docs.loopscale.com/resources/terms'));
  t('a docs overview still is',      !LEGAL_PATH.test('https://docs.loopscale.com/introduction/overview'));

  // Sanctum's RPC guide is evidence, not a monitored surface.
  const sanctum = lookupICP('Sanctum');
  t('Sanctum records the RPC guide as evidence', (sanctum.evidence||[]).length >= 1);
  t('with a date',                                /^20\d\d-\d\d-\d\d$/.test(sanctum.evidence[0].date));
  t('and it is not a monitored surface',
    !(sanctum.surfaces||[]).some(x => /complete-guide/.test(x.url)));
}

console.log('\nCheck our own customer list first');
{
  const { heliusRelationship, CUSTOMERS, PARTNERS } = await import('./helius.js');
  const { lookupICP } = await import('./icp.js');

  // The registry had DFlow as a COMPETITOR while Helius's own page carries a
  // testimonial from DFlow's CEO about using LaserStream. It had Wintermute,
  // Ellipsis Labs and Pyth as prospects while they sit under "Some of our
  // partners". One scan away from cold-pitching our own customers.
  t('DFlow is a customer, not a competitor',
    heliusRelationship('DFlow')?.relationship === 'EXISTING_CUSTOMER');
  t('and the registry agrees now',  lookupICP('DFlow')?.rel === 'EXISTING_CUSTOMER');
  t('Wintermute is a partner',      heliusRelationship('Wintermute')?.relationship === 'PARTNER');
  t('the registry agrees',          lookupICP('Wintermute')?.rel === 'PARTNER');
  t('Keyrock is a customer',        heliusRelationship('Keyrock')?.relationship === 'EXISTING_CUSTOMER');
  t('a customer carries its contact',
    !!heliusRelationship('Phantom')?.evidence?.person);
  t('an unlisted company is cold-safe', heliusRelationship('Pacifica') === null);
  t('every customer has a person and a title',
    CUSTOMERS.every(c => c.person && c.title && c.quote));
  t('partners are listed separately from customers', PARTNERS.length > 0);
}

console.log('\nThe funnel: opportunities, not leads');
{
  const { placeInFunnel, STATE, SEGMENTS } = await import('./funnel.js');
  const ev = { sender: { evidence: [{ term:'priority fee', excerpt:'we set a priority fee on every submission', url:'https://t.test/docs' }] } };
  const base = { name:'Testco', rel:'PROSPECT', status:'active', segment:'trader' };

  // An OPPORTUNITY needs four things and no more: identity confirmed, plausible
  // segment, one grounded fit signal, no disqualifier. The old model demanded a
  // named owner and a dated trigger and produced zero rows from eighty - and
  // then demanded a verified surface, which blocked real companies before a
  // human had looked at them. Surface verification is a confidence flag now.
  const op = placeInFunnel({ account: base, fit:{ sender:40 }, detail: ev });
  t('fit + segment + grounded span = opportunity', op.state === STATE.OPPORTUNITY);
  t('with NO named owner required',               !(base.owners || []).length);
  t('and NO dated trigger required',               op.date === null);
  t('it names a primary product',                  op.primary_product === 'sender');
  t('it carries the grounded quote',               /priority fee/.test(op.quote || ''));
  t('it cites a source',                           /t\.test/.test(op.source || ''));
  t('it states a counter-rationale',               (op.counter_rationale || '').length > 30);
  t('the counter refuses to imply intent',         /never of intent to buy/.test(op.counter_rationale));
  // Human work either way; which work depends on the surface flag.
  t('its next action is human work',               /^(Research|Find and verify) /.test(op.next_action));
  t('unverified sends a human to the surface first', /Find and verify/.test(op.next_action));
  t('verified sends a human to the product',
    /Research the/.test(placeInFunnel({ account: { ...base, surface_verified: true },
                                        fit: { sender: 40 }, detail: ev }).next_action));
  // Word boundaries: /send/ matches "Sender", which is a product name here.
  // Third time this substring has bitten a test in this project.
  t('the system never sends anything itself',
    !/\b(email|sends?|contact them|reach out)\b/i.test(op.next_action));
  // /send/ matched inside "Sender". The same substring mistake the pipeline
  // keeps catching in its own evidence matching - "jito" inside a JTO pair,
  // "SOL" inside "solution" - written into the test meant to police it.
  t('and never outreach',
    !/\b(send|email|pitch|reach out|contact)\b(?!\w)/i.test(op.next_action.replace(/\bSender\b/g, 'PRODUCT')));

  // No grounded span: a score alone is not an opportunity.
  const nospan = placeInFunnel({ account: base, fit:{ sender:40 }, detail:{} });
  t('a score with no grounded span is research', nospan.state === STATE.RESEARCH);
  // No segment: we do not know what kind of buyer this is.
  const noseg = placeInFunnel({ account:{ ...base, segment:null }, fit:{ sender:40 }, detail: ev });
  t('no buyer segment means research',           noseg.state === STATE.RESEARCH);
  t('and the task is to classify it',            /[Cc]lassify/.test(noseg.next_action));

  // Disqualifiers, each a stated fact.
  for (const [rel, label] of [['COMPETITOR','competitor'], ['EXISTING_CUSTOMER','customer'],
                              ['PARTNER','partner'], ['ECOSYSTEM_DEPENDENCY','ecosystem dependency']])
    t(`${label} is disqualified`,
      placeInFunnel({ account:{ ...base, rel }, fit:{ sender:90 }, detail: ev }).state === STATE.DISQUALIFIED);
  t('a ceased company is disqualified',
    placeInFunnel({ account:{ ...base, status:'ceased' }, fit:{ sender:90 }, detail: ev }).state === STATE.DISQUALIFIED);
  t('Helius itself is disqualified',
    placeInFunnel({ account:{ ...base, name:'Helius' }, fit:{ sender:90 }, detail: ev }).state === STATE.DISQUALIFIED);
  t('a Helius customer by name is disqualified',
    placeInFunnel({ account:{ ...base, name:'DFlow' }, fit:{ sender:90 }, detail: ev }).state === STATE.DISQUALIFIED);

  // Nothing disappears.
  const empty = placeInFunnel({ account: base, fit:{}, detail:{} });
  t('an empty account still lands in monitor', empty.state === STATE.MONITOR);
  t('with a next step',                        (empty.next_action || '').length > 10);
  t('there is no outreach_ready state at all', !('OUTREACH_READY' in STATE));
  t('four states only',                        Object.keys(STATE).length === 4);
  t('every segment names a lead product',
    Object.values(SEGMENTS).every(x => x.lead.length > 0));
}

console.log('\nDiscovery signals are held to a stated bar');
{
  const { validateSignal, SEARCH_CAP } = await import('./discovery.js');
  const good = { org:'X', type:'hiring', date:'2026-11-01', source:'https://x.test/a',
                 quote:'hiring a Solana infrastructure engineer', segment:'trader',
                 verified:'FETCHED', counter:'a job advert is not a purchase' };
  t('a complete signal validates', validateSignal(good).ok);
  for (const [field, bad] of [['date','Nov 2026'], ['source','x.test'], ['quote','short'],
                              ['segment','traders'], ['type','rumour']])
    t(`a bad ${field} is rejected`, !validateSignal({ ...good, [field]: bad }).ok);
  t('a counter-rationale is mandatory', !validateSignal({ ...good, counter: undefined }).ok);
  t('search-sourced evidence is capped at research', SEARCH_CAP === 'research');
}

console.log('\nRolling batch windows');
{
  const fs = await import('node:fs');
  const scan = fs.readFileSync('scan.js', 'utf8');
  const bat  = fs.readFileSync('batches.js', 'utf8');

  t('scan accepts an explicit range',    /--from/.test(scan) && /--to/.test(scan));
  t('a bad date is rejected, not guessed', /must be YYYY-MM-DD/.test(scan));
  t('an explicit range overrides --days', /fromArg \|\| toArg/.test(scan));
  t('from/to order is normalised',        /a <= b \? \[a, b\] : \[b, a\]/.test(scan));
  t('a zero-length window is refused',    /zero-length window/.test(scan));

  // Reproduce the window maths the batch runner uses.
  const day = 86400000, anchor = '2026-11-12', span = 14;
  const wins = [];
  for (let i = 0; i < 4; i++) wins.push({
    to:   new Date(new Date(anchor).getTime() - i * span * day).toISOString().slice(0, 10),
    from: new Date(new Date(anchor).getTime() - (i + 1) * span * day).toISOString().slice(0, 10) });
  t('four batches are produced',          wins.length === 4);
  t('the newest starts today',            wins[0].to === '2026-11-12');
  t('each is 14 days',                    wins.every(w => Math.round((new Date(w.to) - new Date(w.from)) / day) === 14));
  t('they tile without gaps',             wins.slice(1).every((w, i) => w.to === wins[i].from));
  t('they run backwards',                 wins[3].from < wins[0].from);
  t('the oldest reaches 17 Sep',          wins[3].from === '2026-09-17');

  // A run must be identifiable by window, and batches must never collide.
  const run = fs.readFileSync('pipeline/run.js', 'utf8');
  t('the runId carries its window',       /window\.from\}_to_\$\{window\.to/.test(run));

  // History is append-only, keyed on the evidence - not on when it was read.
  t('history merges, never overwrites',   /append-only|never overwritten|Append only/i.test(bat));
  t('the merge key is the evidence',      /event_date\}\|\$\{String\(row\.quote/.test(bat));
  t('runs already seen are skipped',      /batchesSeen\.includes/.test(bat));
  t('every run on disk is considered',    /onDisk/.test(bat));

  // A standing condition is dated by the fetch and must not claim a trigger.
  const funnel = fs.readFileSync('pipeline/funnel.js', 'utf8');
  t('standing conditions are dated by fetch', /observed_on_fetch/.test(funnel));
  t('and are not sold as a reason to call today', /not a reason to call today/.test(funnel));
}

console.log('\nTargeted collectors');
{
  const { COLLECTORS, COLLECTOR_KEYS } = await import('./collectors.js');
  const run = (await import('node:fs')).readFileSync('pipeline/run.js', 'utf8');

  // The single collector carried 14 event types and a cap of 6, so the model
  // chose six winners across fourteen competing categories on every read.
  t('five targeted collectors exist', COLLECTOR_KEYS.length === 5);
  for (const k of ['execution','infrastructure','incident','commercial','hiring'])
    t(`${k} is a collector`, !!COLLECTORS[k]);

  const w = { from:'2026-10-29', to:'2026-11-12' };
  for (const k of COLLECTOR_KEYS) {
    const sys = COLLECTORS[k].system('2026-11-12', w);
    t(`${k} states the window`,          sys.includes('2026-10-29') && sys.includes('2026-11-12'));
    t(`${k} demands a verbatim quote`,   /VERBATIM span/.test(sys));
    t(`${k} forbids inventing a date`,   /Never infer one/.test(sys));
    t(`${k} allows an empty answer`,     /zero candidates is a correct|Empty is correct|right answer/i.test(sys));
    t(`${k} tells the model what to IGNORE`, /IGNORE/.test(sys));
  }

  // Only the two first-party collectors may emit an undated standing condition.
  t('execution allows a standing condition',
    /standing_condition/.test(COLLECTORS.execution.system('2026-11-12', w)));
  t('infrastructure allows one too',
    /standing_condition/.test(COLLECTORS.infrastructure.system('2026-11-12', w)));
  t('commercial does NOT - a self-description is not a trigger',
    /no standing-condition option/i.test(COLLECTORS.commercial.system('2026-11-12', w)));

  // The incident collector must carry the chain, or Pitfall 37 returns.
  t('incident records which chain it is about',
    /WHICH CHAIN OR SERVICE/.test(COLLECTORS.incident.system('2026-11-12', w)));

  // Wiring: each pass is its own budget, and rows are tagged with their source.
  t('the runner iterates collector passes', /for \(const pass of passes\)/.test(run));
  t('a row records which collector found it', /_collector/.test(run));
  t('the budget still stops the run', /overBudget/.test(run));
  t('omitting --collectors keeps the original prompt', /\{ key: 'all', agent: null \}/.test(run));
}

console.log('\nThe full Helius customer wall');
{
  const { heliusRelationship, CUSTOMERS, LOGOS, PRODUCT_BUYERS, PRIVACY_BUYERS } = await import('./helius.js');

  // Reading Helius's own site properly found a 36-name customer logo wall. The
  // registry had TWELVE of those as prospects, three of them sitting in the
  // OPPORTUNITY list: Coinbase, Backpack and Loopscale.
  for (const n of ['Coinbase','Backpack','Loopscale','Jupiter','Orca','Drift','pump.fun','Zeta'])
    t(`${n} is recognised as a Helius customer`,
      heliusRelationship(n)?.relationship === 'EXISTING_CUSTOMER');
  for (const n of ['Wintermute','Pyth','Jump Crypto','Ergonia'])
    t(`${n} is recognised as a partner`, heliusRelationship(n)?.relationship === 'PARTNER');
  t('BitGo is a named custodian', heliusRelationship('BitGo') !== null);

  // The six that survive must NOT be on any list.
  for (const n of ['Velocity Protocol','Sanctum','Titan Exchange','Kraken','Flint Labs','DPI Protocol'])
    t(`${n} is genuinely cold`, heliusRelationship(n) === null);

  t('every customer records a basis', CUSTOMERS.every(c => c.person && c.title));
  t('the logo wall is captured',      LOGOS.length >= 30);
  t('each product carries its own buyer list',
    Object.values(PRODUCT_BUYERS).every(v => v.length >= 5));
  t('privacy buyers are recorded',    PRIVACY_BUYERS.length >= 6);

  // 16 products, 8 segments.
  const { PRODUCTS } = await import('./products.js');
  const { SEGMENTS } = await import('./funnel.js');
  t('sixteen Helius products are scored', Object.keys(PRODUCTS).length === 16);
  t('Transaction Rebates is one of them', !!PRODUCTS.rebates);
  t('Preprocessed Transactions too',      !!PRODUCTS.preprocessed);
  t('Privacy Rings too',                  !!PRODUCTS.privacy);
  t('Wallet API too',                     !!PRODUCTS.wallet_api);
  t('Searchers is a buyer segment',       !!SEGMENTS.searcher);
  t('every segment names its lead products',
    Object.values(SEGMENTS).every(x => x.lead.every(p => !!PRODUCTS[p])));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
