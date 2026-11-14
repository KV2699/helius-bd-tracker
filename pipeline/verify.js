// Verification is CODE, not a model opinion. A candidate the model invented
// cannot survive this file, because the quote must appear character-for-character
// in text we fetched ourselves.
import { ICP } from './icp.js';
import { SOURCE_WHITELIST, BRIDGE_VERIFIED_HOSTS, BLOCKED_ALIASES, REASON, isGenericEntity, isTokenListing, isAssetListingQuote, OTHER_CHAIN_ENTITY } from './config.js';

const norm = s => String(s || '')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

export function whitelistEntry(url) {
  const h = hostOf(url);
  if (!h) return null;
  const hit = SOURCE_WHITELIST.find(w => h === w.host || h.endsWith('.' + w.host));
  if (hit) return hit;
  // A surface the bridge verified is a first-party source by construction: it
  // fetched, the company publishes it, and the page names the company. Without
  // this the scan refused every surface the bridge had just verified.
  const bridged = BRIDGE_VERIFIED_HOSTS.find(w => h === w.host || h.endsWith('.' + w.host));
  if (bridged) return bridged;
  // And the same for a HAND-VERIFIED registry surface. The registry's rule is
  // that a surface appears there only if it was fetched and confirmed, so
  // sanctum.so and loopscale.com were being refused by the scan while sitting
  // in icp.js marked status:'verified' - the surface was trusted enough to
  // plan a run around and not trusted enough to read.
  return registryHost(h);
}


/* Hosts of registry surfaces already marked verified. Built once, lazily, so
   config.js and icp.js never have to import each other. */
let REGISTRY_HOSTS = null;
function registryHost(h) {
  if (REGISTRY_HOSTS === null) {
    REGISTRY_HOSTS = new Map();
    try {
      for (const a of ICP) {
        for (const sf of (a.surfaces || [])) {
          if (!sf.url || (sf.status && sf.status !== 'verified')) continue;
          let host; try { host = new URL(sf.url).hostname.replace(/^www\./, ''); } catch { continue; }
          if (!REGISTRY_HOSTS.has(host))
            REGISTRY_HOSTS.set(host, { host, tier: 1, type: 'registry_verified',
                                       verified_for: a.name, basis: 'verified registry surface' });
        }
      }
    } catch {}
  }
  for (const [host, entry] of REGISTRY_HOSTS)
    if (h === host || h.endsWith('.' + host)) return entry;
  return null;
}

/* The grounding check. This is the guard the inherited prompt packs never had:
   the model must return a span, and code must find that span in the source. */
export function quoteIsGrounded(quote, pageText) {
  const q = norm(quote), p = norm(pageText);
  if (!q || q.length < 25) return false;      // too short to be evidence
  if (p.includes(q)) return true;

  // Allow one tolerance: the model dropped or added a trailing clause.
  // Require a long contiguous run, not a bag of words.
  //
  // NO SUBSTITUTED WORDS. The tolerance above was written for TRUNCATION, but
  // the loop lets the matching run float anywhere in the quote, so changing a
  // word in the middle of a sentence still left a long enough run on one side
  // of it. Applying the Evidence Gap admissibility audit to this function
  // measured the cost: on 86 paraphrases of real sentences from the right page
  // - "is" to "remains", "each" to "every", "transactions" to "transfers" -
  // 48.8% were accepted as grounded. A model that reworded instead of quoting
  // was passing the check this whole project rests on.
  //
  // The discriminator is what the two cases do to the words. A truncation only
  // DROPS words that are on the page; a paraphrase INTRODUCES words that were
  // never there. So every substantive word of the quote must appear somewhere
  // in the page before the tolerance is allowed to apply. That keeps 100% of
  // real quotes (whitespace drift, dropped terminators, dropped clauses, smart
  // quotes) and takes paraphrase acceptance from 48.8% to 2.3%.
  const words = q.split(' ');
  const pageWords = new Set(p.split(' '));
  if (words.some(w => w.length >= 3 && !pageWords.has(w))) return false;

  for (let len = words.length; len >= Math.max(8, Math.ceil(words.length * 0.7)); len--) {
    for (let i = 0; i + len <= words.length; i++) {
      if (p.includes(words.slice(i, i + len).join(' '))) return true;
    }
  }
  return false;
}

export function isBlockedAlias(entity) {
  const e = norm(entity);
  return BLOCKED_ALIASES.some(a => e.includes(norm(a)));
}

export function inWindow(dateStr, from, to) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return null; // unverifiable
  const d = dateStr.slice(0, 10);
  return d >= from && d <= to;
}

/* Returns {ok:true, row} or {ok:false, reason, detail}.
   Every path returns a reason code. Nothing is dropped silently. */
export function verifyCandidate(c, ctx) {
  const { pageText, sourceUrl, window, seen, allowStanding = false } = ctx;

  // The URL is the page WE FETCHED, never one the model read off a link.
  // The quote was grounded against that page's text, so attributing it to any
  // other URL would be a provenance lie - and the model frequently returns an
  // outbound link it saw in the nav.
  const url = sourceUrl || c.source_url;
  if (!url) return fail('NO_SOURCE_URL');

  const wl = whitelistEntry(url);
  if (!wl)                                   return fail('SOURCE_NOT_WHITELISTED', hostOf(url));
  if (!pageText || pageText.length < 200)    return fail('SOURCE_UNREACHABLE', url);

  if (!c.entity || String(c.entity).trim().length < 2) return fail('NO_NAMED_ENTITY');
  // "Solana" is a chain, not a buyer.
  if (isGenericEntity(c.entity))             return fail('NO_NAMED_ENTITY', c.entity);
  // A ticker in brackets is a listing-table row, not a business.
  if (isTokenListing(c.entity))              return fail('NO_NAMED_ENTITY', `token listing: ${c.entity}`);
  if (isAssetListingQuote(c.entity, c.quote)) return fail('NO_NAMED_ENTITY', `asset row, not a company: ${c.entity}`);
  if (OTHER_CHAIN_ENTITY.test(String(c.entity).trim()))
                                             return fail('NOT_SOLANA', `another chain: ${c.entity}`);
  if (isBlockedAlias(c.entity))              return fail('BLOCKED_ALIAS', c.entity);

  if (!quoteIsGrounded(c.quote, pageText))   return fail('QUOTE_NOT_IN_SOURCE', String(c.quote || '').slice(0, 120));

  // STANDING CONDITIONS. Technical documentation has no dates, so an event-shaped
  // pipeline throws away the best first-party evidence there is: a company saying,
  // in its own docs, how its execution works and what it has to watch. That is a
  // CONDITION, not an event - true on the day we read it, with no claim about when
  // it started. We keep it, date it by the fetch, mark it standing, and the scorer
  // caps it at Research precisely because nothing happened.
  const standing = allowStanding && !c.event_date;
  const w = standing ? true : inWindow(c.event_date, window.from, window.to);
  if (w === null)                            return fail('DATE_UNVERIFIABLE', c.event_date);
  if (w === false)                           return fail('DATE_OUT_OF_WINDOW', c.event_date);

  // The entity must actually appear in the page we fetched, not only in the
  // model's answer. Catches a real company name attached to the wrong source.
  if (!norm(pageText).includes(norm(c.entity).split(' ')[0])) return fail('NO_NAMED_ENTITY', c.entity);

  const key = norm(c.entity) + '|' + (c.event_date || '').slice(0, 10);
  if (seen.has(key))                         return fail('DUPLICATE', c.entity);
  seen.add(key);

  return {
    ok: true,
    row: {
      entity: String(c.entity).trim(),
      event_type: c.event_type || 'unclassified',
      event_date: standing ? String(window.to).slice(0, 10) : c.event_date.slice(0, 10),
      standing,
      date_basis: standing ? 'observed_on_fetch' : 'stated_in_source',
      headline: c.headline || '',
      quote: c.quote,
      source_url: url,
      source_host: hostOf(url),
      source_kind: wl.type,
      source_tier: wl.tier,
      chain: c.chain || 'Solana'
    }
  };

  function fail(code, detail) {
    return { ok: false, reason: code, message: REASON[code], detail: detail ?? null, candidate: c };
  }
}
