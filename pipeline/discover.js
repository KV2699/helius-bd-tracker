// THE DISCOVERY PASS.
//
// The dated scan answers "what changed at an account I know?". It cannot
// answer "who should I know about?", and three runs of the same window proved
// why: sourcePlan() reads the surfaces of accounts already in the registry, so
// no prompt can name a company that is not on a page the run fetched. The last
// run threw away 100 of 307 candidates for DATE_OUT_OF_WINDOW or
// DATE_UNVERIFIABLE - the name lists that would lengthen the pipeline were
// being discarded for having no dated event attached.
//
// This pass reads ROSTER pages - pages whose purpose is to list firms - and
// collects NAMES. It drops the date gate and keeps every other discipline:
//   - every name carries a verbatim quote, grounded against the fetched page
//     in code, exactly as the dated scan does;
//   - every name carries a mandatory counter-rationale;
//   - the whole page is read in overlapping windows, so nothing is truncated;
//   - Helius's own customers, partners and logo wall are filtered out;
//   - tickers, asset rows, other chains and generic phrases are filtered out.
//
// WHAT IT PRODUCES IS A REGISTRY CANDIDATE, NEVER A LEAD. A name with no dated
// event is not evidence of need, and this file never pretends otherwise: every
// candidate is capped at 'research' and carries date_basis 'undated_roster'.
// The dated scan is what turns a candidate into a lead, once the name is in
// the registry and its own surfaces are being read.
import { fetchSource, shardText } from './fetch.js';
import { quoteIsGrounded } from './verify.js';
import { AGENTS } from './agents.js';
import { isGenericEntity, isTokenListing, isAssetListingQuote, OTHER_CHAIN_ENTITY } from './config.js';
import { heliusRelationship, sellerSideReason } from './helius.js';
import { lookupICP } from './icp.js';
import { writeFile, mkdir } from 'node:fs/promises';

export const TIERS = ['trading', 'institutional', 'builder', 'infra', 'data', 'unclear'];

// Revenue tier of the Helius products each buyer tier plausibly buys, from the
// seller's own price list. Used only to ORDER candidates for a human, never to
// score one: a name on a roster has not evidenced need for anything.
export const TIER_VALUE = {
  trading: 1, institutional: 2, infra: 3, builder: 4, data: 5, unclear: 6
};

// A name is not a company. These rules are the same ones the dated scan uses,
// applied before a candidate is ever written.
export function candidateProblem(c, pageText) {
  const name = String(c.name || '').trim();
  if (name.length < 2)                      return 'no name';
  if (name.length > 80)                     return 'not a name, a sentence';
  if (isGenericEntity(name))                return `generic entity: ${name}`;
  if (isTokenListing(name))                 return `token listing: ${name}`;
  if (OTHER_CHAIN_ENTITY.test(name))        return `another chain: ${name}`;
  if (!TIERS.includes(c.tier))              return `tier must be one of ${TIERS.join('|')}`;
  if (!c.counter || String(c.counter).trim().length < 8)
                                            return 'counter-rationale is mandatory';
  if (!c.quote || String(c.quote).length < 25) return 'quote must be a real span, 25+ chars';
  if (isAssetListingQuote(name, c.quote))   return `asset row, not a company: ${name}`;
  if (!quoteIsGrounded(c.quote, pageText))  return 'quote does not appear in the fetched page';
  return null;
}

// Helius's own side of the table is not a prospect. This is the gate that
// caught twelve existing customers sitting in the prospect list, three of them
// in the opportunity band.
export function ownSideReason(name) {
  // The seller and its rivals first: the first pass offered Helius itself as a
  // prospect, and a roster of RPC vendors is a roster of competitors.
  const seller = sellerSideReason(name);
  if (seller) return seller;
  const rel = heliusRelationship(name);
  if (!rel) return null;
  return `${rel.relationship.toLowerCase().replace(/_/g, ' ')}: ${rel.basis || 'on the Helius wall'}`;
}

/* Reads one roster page end to end and returns grounded company names.
   Every rejection carries a reason; nothing is dropped silently. */
export async function discoverPage({ url, ai, today, onEvent = () => {} }) {
  const found = [], rejected = [];
  // fetchSource reports failure in the return value, not by throwing, and the
  // full page text is `pageText` - `modelText` is only the first slice.
  let page;
  try {
    page = await fetchSource(url);
  } catch (e) {
    return { url, found, rejected, error: `fetch threw: ${e.message}` };
  }
  if (!page.ok) return { url, found, rejected, error: page.error || 'fetch failed' };
  const text = page.pageText || '';
  if (!text) return { url, found, rejected, error: 'page fetched empty' };

  const shards = shardText(text);
  onEvent({ stage: 'discoverer', msg: `${url} - ${text.length} chars in ${shards.length} window(s)` });

  // shardText returns { i, of, from, to, text } - the TEXT is a field on it.
  // Passing the shard itself put "[object Object]" in the prompt, the model
  // correctly reported no companies, and the pass looked like a clean zero.
  for (const [i, shard] of shards.entries()) {
    let out;
    try {
      out = await ai.json('discoverer', {
        system: AGENTS.discoverer.system(today),
        user: AGENTS.discoverer.user({ url, text: shard.text, window: { i: i + 1, n: shards.length } })
      });
    } catch (e) {
      rejected.push({ url, window: i + 1, reason: e.code || 'INFERENCE_FAILED', detail: e.message });
      if (e.message && e.message.startsWith('Budget stop')) throw e;
      continue;
    }
    for (const c of (out.parsed?.companies || [])) {
      // Ground against the WHOLE page, not just this window: the model
      // sometimes quotes across an overlap boundary.
      const problem = candidateProblem(c, text);
      if (problem) { rejected.push({ url, name: c.name ?? null, reason: 'NOT_A_CANDIDATE', detail: problem }); continue; }
      const own = ownSideReason(c.name);
      if (own) { rejected.push({ url, name: c.name, reason: 'HELIUS_OWN_SIDE', detail: own }); continue; }
      found.push({
        name: String(c.name).trim(),
        tier: c.tier,
        tier_value: TIER_VALUE[c.tier],
        says: String(c.says || '').trim() || 'named in a list, no detail',
        counter: String(c.counter).trim(),
        quote: String(c.quote).trim(),
        source_url: url,
        source_type: 'roster',
        // A roster says nothing about WHEN. The candidate carries that fact
        // rather than borrowing the fetch date and pretending it is an event.
        date_basis: 'undated_roster',
        observed_on: today,
        cap: 'research',
        in_registry: !!lookupICP(String(c.name).trim())
      });
    }
  }
  return { url, title: page.title ?? null, found, rejected, chars: text.length, windows: shards.length };
}

/* The whole pass. Dedupes on lower-cased name, keeping the first grounded
   sighting and recording every other page that named it. */
export async function runDiscovery({ urls, ai, today, onEvent = () => {} }) {
  const pages = [], rejected = [];
  const byName = new Map();
  let budgetStopped = false;

  for (const url of urls) {
    let r;
    try {
      r = await discoverPage({ url, ai, today, onEvent });
    } catch (e) {
      if (e.message && e.message.startsWith('Budget stop')) { budgetStopped = true; onEvent({ stage: 'discoverer', msg: e.message }); break; }
      rejected.push({ url, reason: 'PAGE_FAILED', detail: e.message });
      continue;
    }
    pages.push({ url: r.url, title: r.title ?? null, found: r.found.length, rejected: r.rejected.length,
                 chars: r.chars ?? 0, windows: r.windows ?? 0, error: r.error ?? null });
    rejected.push(...r.rejected);
    for (const c of r.found) {
      const k = c.name.toLowerCase();
      if (!byName.has(k)) byName.set(k, { ...c, also_named_by: [] });
      else {
        const seen = byName.get(k);
        if (!seen.also_named_by.includes(c.source_url) && seen.source_url !== c.source_url)
          seen.also_named_by.push(c.source_url);
        // Keep the most specific tier if the first sighting could not place it.
        if (seen.tier === 'unclear' && c.tier !== 'unclear') {
          seen.tier = c.tier; seen.tier_value = c.tier_value; seen.says = c.says; seen.quote = c.quote;
        }
      }
    }
    onEvent({ stage: 'discoverer', msg: `${r.found.length} candidate(s), ${r.rejected.length} rejected - ${url}` });
  }

  // Highest-value buyer tier first, then names corroborated by more than one
  // page, then alphabetical so the order is stable between runs.
  const candidates = [...byName.values()].sort((a, b) =>
    a.tier_value - b.tier_value ||
    b.also_named_by.length - a.also_named_by.length ||
    a.name.localeCompare(b.name));

  const fresh = candidates.filter(c => !c.in_registry);
  return {
    kind: 'discovery',
    discoveryId: `discover-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
    generatedAt: new Date().toISOString(),
    observed_on: today,
    budgetStopped,
    pages,
    counts: {
      pages: pages.length,
      candidates: candidates.length,
      new_to_registry: fresh.length,
      already_in_registry: candidates.length - fresh.length,
      rejected: rejected.length,
      by_tier: TIERS.reduce((m, t) => (m[t] = candidates.filter(c => c.tier === t).length, m), {})
    },
    candidates,
    rejected,
    // Said in the artefact itself, so nobody downstream can mistake what this
    // file is: a list of names to research, not a list of leads.
    disclaimer: 'Roster-sourced names, undated. A candidate here has evidenced ' +
      'no need for any Helius product and cannot authorise outreach. Every row ' +
      'is capped at research. The dated scan is what makes a lead.'
  };
}

export async function saveDiscovery(result, dir = 'data/discovered') {
  await mkdir(dir, { recursive: true });
  const file = `${dir}/${result.discoveryId}.json`;
  await writeFile(file, JSON.stringify(result, null, 2));
  return file;
}
