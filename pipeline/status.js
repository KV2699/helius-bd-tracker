// Is this company still trading?
//
// Nothing in the pipeline ever asked. Zeta Markets was classified SENDER_CANDIDATE
// on grade-A first-party evidence, given a product-fit vector, and promoted to
// the project's first QUALIFY - from a company whose own documentation says
// "Zeta Markets has ceased operating as of May 2025."
//
// That notice was on docs.zeta.markets, a page fetched a dozen times. Every
// agent read it for execution vocabulary. None read it for whether the company
// exists. A dead company can have perfect evidence.
import { fetchSource } from './fetch.js';
import { ICP, lookupICP } from './icp.js';

export const STATUS = {
  ACTIVE: 'active',
  CEASED: 'ceased',          // stopped operating
  ACQUIRED: 'acquired',      // absorbed into another company
  SUCCEEDED: 'succeeded',    // replaced by a named successor product
  UNKNOWN: 'unknown'
};

// Phrases a company uses about ITSELF when it stops. Deliberately narrow: these
// must be statements, not speculation, and not a third party's opinion.
const SIGNALS = [
  { status: STATUS.CEASED,   re: /\b(has )?ceased (operating|operations|trading)\b/i,          weight: 10 },
  // The auxiliary is MANDATORY here. Without it, "You can shut down your bot at
  // any time" read as the company closing - a product instruction mistaken for
  // a corporate obituary.
  { status: STATUS.CEASED,   re: /\b(has been|have been|was|were|is|are)\s+(discontinued|shut down|wound down|sunset)\b/i, weight: 8 },
  { status: STATUS.CEASED,   re: /\bstopped operations?\b/i,                                    weight: 9 },
  // ACTIVE VOICE, which the auxiliary rule above cannot see: a headline says
  // "Flash Trade winds down citing shrinking market", never "Flash Trade has
  // been wound down". Without this the bridge verified five of Flash Trade's
  // own pages and promoted a company that had already closed.
  //
  // The object guard is what makes it safe. "Wind down your position" and
  // "close out your exposure" are ordinary instructions on a perps venue's
  // own docs - the very pages this runs against - so the phrase is only a
  // cessation when it is NOT followed by a trading object. The subject test
  // still has to pass on top of this.
  { status: STATUS.CEASED,
    re: /\b(winds? down|winding down|is shutting down|shuts down|will (?:cease|shut down|close))\b(?!\s+(?:your|their|all|any|open|a|the)?\s*(?:position|positions|trade|trades|order|orders|exposure|bot|bots|account|accounts|node|nodes|instance|session))/i,
    weight: 8 },
  { status: STATUS.CEASED,   re: /\bno longer (operating|operational|in operation|available)\b/i, weight: 8 },
  { status: STATUS.ACQUIRED, re: /\b(has been |was )?acquired by\b/i,                           weight: 8 },
  { status: STATUS.SUCCEEDED,re: /\bis (a )?(new|successor)\b[^.]{0,80}\b(extends|replaces|succeeds)\b/i, weight: 6 },
  { status: STATUS.SUCCEEDED,re: /\bmigrat(e|ed|ing) to\b/i,                                    weight: 4 }
];

// A successor is only recorded when the company NAMES it.
const SUCCESSOR = /\b([A-Z][A-Za-z0-9.-]{2,20})\b is a new (?:network|protocol|exchange|product|platform)/;

// WHOSE cessation is it? Coinbase's own status page says "the Blast network is
// shut down" - a third party's closure, on the account's own surface, which the
// first version read as Coinbase ceasing to exist.
//
// So the account must be the SUBJECT: its name has to appear in the run-up to
// the phrase, and no other proper noun may sit closer to it.
const PROPER = /\b([A-Z][A-Za-z0-9.&-]{2,24})\b/g;

function accountIsSubject(text, index, names) {
  if (!names?.length) return true;          // no names given: cannot test, do not block
  const lead = text.slice(Math.max(0, index - 110), index);
  const lower = lead.toLowerCase();

  // Self-reference counts: "we have ceased", "our service is discontinued".
  if (/\b(we|our|this (service|product|platform|exchange))\b\s*$|\b(we|our)\b[^.]{0,40}$/i.test(lead)) return true;

  let nearestName = -1, nearestOther = -1, m;
  for (const n of names) {
    const i = lower.lastIndexOf(String(n).toLowerCase());
    if (i > nearestName) nearestName = i;
  }
  PROPER.lastIndex = 0;
  while ((m = PROPER.exec(lead))) {
    const w = m[1];
    if (names.some(n => String(n).toLowerCase().includes(w.toLowerCase()) ||
                        w.toLowerCase().includes(String(n).toLowerCase()))) continue;
    if (/^(The|This|That|Disclaimer|Note|Important|Update|Tue|Mon|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i.test(w)) continue;
    if (m.index > nearestOther) nearestOther = m.index;
  }
  if (nearestName === -1) return false;              // the account is not mentioned at all
  return nearestName > nearestOther;                 // and nothing else is closer
}

export function readStatus(text, names = []) {
  const hits = [];
  for (const s of SIGNALS) {
    // Every occurrence, not just the first - the relevant one may not be first.
    const re = new RegExp(s.re.source, s.re.flags.includes('g') ? s.re.flags : s.re.flags + 'g');
    let m;
    while ((m = re.exec(text))) {
      const i = m.index;
      if (!accountIsSubject(text, i, names)) continue;
      hits.push({ status: s.status, weight: s.weight, phrase: m[0],
                  quote: text.slice(Math.max(0, i - 120), i + 180).replace(/\s+/g, ' ').trim() });
      break;
    }
  }
  if (!hits.length) return { status: STATUS.ACTIVE, confidence: 'assumed', hits: [] };

  hits.sort((a, b) => b.weight - a.weight);
  const top = hits[0];
  const successor = (text.match(SUCCESSOR) || [])[1] || null;
  return { status: top.status, confidence: top.weight >= 8 ? 'stated' : 'implied',
           quote: top.quote, phrase: top.phrase, successor, hits };
}

export async function checkStatus(accountName, { onEvent = () => {} } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const say = (msg, extra = {}) => onEvent({ stage: 'status', msg, ...extra });
  const acct = lookupICP(accountName) || ICP.find(a => a.name.toLowerCase() === String(accountName).toLowerCase());
  if (!acct) return { account: accountName, error: 'NOT_IN_REGISTRY' };

  const surfaces = (acct.surfaces || []).filter(s => s.status === 'verified');
  let best = { status: STATUS.ACTIVE, confidence: 'assumed', hits: [] }, source = null;

  for (const sf of surfaces) {
    const src = await fetchSource(sf.url, { skipWhitelist: true });
    if (!src.ok) continue;
    const r = readStatus(src.pageText, [acct.name, ...(acct.aliases || [])]);
    if (r.status !== STATUS.ACTIVE && (!best.hits.length || r.hits[0].weight > (best.hits[0]?.weight ?? 0))) {
      best = r; source = src.url;
    }
  }

  if (best.status !== STATUS.ACTIVE)
    say(`${acct.name}: ${best.status.toUpperCase()} (${best.confidence}) - "${best.phrase}" on ${source}`, { entity: acct.name });
  else
    say(`${acct.name}: no cessation statement on ${surfaces.length} surface(s) - treated as active`);

  return { account: acct.name, ...best, source, checkedAt: today,
           surfacesRead: surfaces.length };
}

// The gate. A dead company is not a prospect, whatever its evidence looks like.
export function statusBlocksOutreach(status) {
  return status === STATUS.CEASED || status === STATUS.ACQUIRED || status === STATUS.SUCCEEDED;
}
