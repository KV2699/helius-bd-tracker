// Real HTTP. No search API, no scraping service, no invented URLs.
// The pipeline only ever reads pages it actually fetched, from hosts on the
// whitelist. "Do not construct or guess a URL" - carried from the Scott Logic
// pack, where fabricated regulator paths returned 404 and killed a run.
import { whitelistEntry } from './verify.js';

const UA = 'helius-bd-tracker/1.0 (NEAR Hackathon 2026; research prototype)';

export function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function titleOf(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripHtml(m[1]).slice(0, 200) : null;
}

export async function fetchSource(url, { timeoutMs = 20000, maxChars = 14000, retries = 2, skipWhitelist = false, fullText = 220000 } = {}) {
  // The whitelist governs EVIDENCE. Classification is a different job: to decide
  // whether a discovered company is a competitor we have to read a site that is
  // not on the whitelist yet - that is the whole point of discovering it.
  // Nothing fetched this way may become a source for a pipeline row; it decides
  // a classification and nothing else.
  if (!skipWhitelist && !whitelistEntry(url)) {
    return { ok: false, url, error: 'SOURCE_NOT_WHITELISTED' };
  }
  let lastError = 'UNKNOWN';
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await sleep(1200 * Math.pow(2, attempt - 1));   // 1.2s, 2.4s
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
        signal: ctrl.signal,
        redirect: 'follow'
      });
      clearTimeout(t);
      // Rate limits and transient upstream errors are worth one more try.
      if (res.status === 429 || res.status === 503 || res.status === 502) {
        lastError = `HTTP_${res.status}`;
        continue;
      }
      if (!res.ok) return { ok: false, url, error: `HTTP_${res.status}` };
      // A redirect can land on a host we never allowed. Re-check the FINAL url:
      // reading content from an unapproved host and attributing it to the one we
      // asked for would be a provenance failure.
      const finalUrl = res.url || url;
      if (!skipWhitelist && !whitelistEntry(finalUrl)) {
        return { ok: false, url, finalUrl, error: 'REDIRECTED_OFF_WHITELIST' };
      }
      const html = await res.text();
      const text = stripHtml(html);
      if (text.length < 200) return { ok: false, url, error: 'TOO_LITTLE_TEXT' };
      return {
        ok: true,
        url: res.url || url,
        title: titleOf(html),
        pageText: text,                      // full text, for the grounding check
        modelText: text.slice(0, maxChars),  // a slice, for a single-shot read
        truncated: text.length > maxChars,
        fullChars: text.length,
        bytes: html.length,
        attempts: attempt + 1
      };
    } catch (e) {
      clearTimeout(t);
      lastError = e.name === 'AbortError' ? 'TIMEOUT' : String(e.message || e);
    }
  }
  return { ok: false, url, error: lastError };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Read the WHOLE page, in small batches.
//
// The collector used to get one 14,000-character slice per page and a hard cap
// of four candidates. On status.kraken.com - 128,512 characters of dated Solana
// incidents - that discarded 89% of the page and returned one row. The cap was
// binding on most pages and the truncation was silent.
//
// So: split the page into overlapping windows and give each its own candidate
// budget. A smaller batch is an easier read, and the model stops having to
// choose "the strongest four" out of forty.
//
// The overlap matters. An event whose date sits in one window and whose quote
// sits in the next would be lost at the seam, so windows share a tail.
// Defaults sized to cover the largest page in the registry in one pass:
// status.kraken.com at 128,512 characters needs 16 windows of 9,000 with a 600
// overlap. Most registry surfaces are under 6,000 and stay a single shard.
export function shardText(text, { size = 9000, overlap = 600, max = 16 } = {}) {
  if (!text) return [];
  if (text.length <= size) return [{ i: 0, of: 1, from: 0, to: text.length, text }];

  const step = size - overlap;
  const total = Math.ceil((text.length - overlap) / step);
  const n = Math.min(total, max);
  const out = [];
  for (let i = 0; i < n; i++) {
    const from = i * step;
    out.push({ i, of: n, from, to: Math.min(from + size, text.length),
               text: text.slice(from, from + size) });
  }
  // Say so when a page is too long even for the shard budget, rather than
  // silently dropping the tail the way the old slice did.
  if (total > n) out.truncatedShards = total - n;
  return out;
}
