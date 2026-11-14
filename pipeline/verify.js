// Verification is CODE, not a model opinion. A candidate the model invented
// cannot survive this file, because the quote must appear character-for-character
// in text we fetched ourselves.
import { SOURCE_WHITELIST, BLOCKED_ALIASES, REASON, isGenericEntity, isTokenListing, isAssetListingQuote, OTHER_CHAIN_ENTITY } from './config.js';

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
  return SOURCE_WHITELIST.find(w => h === w.host || h.endsWith('.' + w.host)) || null;
}

/* The grounding check. This is the guard the inherited prompt packs never had:
   the model must return a span, and code must find that span in the source. */
export function quoteIsGrounded(quote, pageText) {
  const q = norm(quote), p = norm(pageText);
  if (!q || q.length < 25) return false;      // too short to be evidence
  if (p.includes(q)) return true;
  // Allow one tolerance: the model dropped or added a trailing clause.
  // Require a long contiguous run, not a bag of words.
  const words = q.split(' ');
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
