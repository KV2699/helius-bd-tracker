// Surface discovery. The run is account-led, but most accounts contribute a
// single page - so the ceiling on leads is the number of surfaces we know about,
// not the quality of the prompts.
//
// This widens that ceiling WITHOUT guessing a URL. Every candidate below is a
// link read off a page the account owns. We never construct "blog.<company>.com"
// and hope; if the company does not link to it, we do not know about it.
import { fetchSource } from './fetch.js';
import { ICP } from './icp.js';

// Paths that tend to carry dated, first-party events. Matched against the link
// text and the href, so "Changelog" linked from "/updates" is caught either way.
const SURFACE_HINTS = [
  { kind: 'blog',      re: /\b(blog|news|updates|posts|articles|insights|writing)\b/i },
  { kind: 'changelog', re: /\b(changelog|releases|release-notes|whats-new)\b/i },
  { kind: 'status',    re: /\b(status|uptime|incidents)\b/i },
  { kind: 'careers',   re: /\b(careers|jobs|hiring|work-with-us|join)\b/i },
  { kind: 'docs',      re: /\b(docs|documentation|developers|developer|api|guides)\b/i },
  { kind: 'eng',       re: /\b(engineering|tech|technical|research)\b/i }
];

// Never follow these off a company page - they are somebody else's surface.
const OFFSITE = /twitter\.com|x\.com|linkedin|discord|t\.me|telegram|youtube|medium\.com|mirror\.xyz|facebook|instagram|reddit/i;

function linksFrom(html, baseUrl) {
  const base = new URL(baseUrl);
  const out = new Map();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    // Decode entities BEFORE parsing. A raw href carries &amp;, which turns
    // "?tag=x&amp;sort=y" into a parameter literally named "amp;sort" - so the
    // strip-parameters rule below silently missed every one of them.
    let href = m[1].trim()
      .replace(/&amp;/gi, '&').replace(/&#38;/g, '&').replace(/&#x26;/gi, '&')
      .replace(/&quot;/gi, '"').replace(/&#39;/g, "'");
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) continue;
    let u;
    try { u = new URL(href, baseUrl); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    if (OFFSITE.test(u.hostname)) continue;
    // Same registrable site only: the account's own surfaces, including
    // subdomains like docs.<company> and status.<company>.
    const root = h => h.split('.').slice(-2).join('.');
    if (root(u.hostname) !== root(base.hostname)) continue;
    u.hash = '';
    // Strip filter and sort parameters. flint.trade/blog?sort=title-desc is the
    // same surface as flint.trade/blog, and four of them is four wasted fetches.
    for (const k of [...u.searchParams.keys()])
      if (/^(sort|tag|tags|filter|order|page|utm_|ref)/i.test(k)) u.searchParams.delete(k);
    if (!out.has(u.href)) out.set(u.href, text);
  }
  return [...out.entries()].map(([url, text]) => ({ url, text }));
}

// Legal boilerplate is not a surface. Loopscale's terms page is 74,907
// characters and was being offered as its most substantial "docs" surface -
// enough on its own to dominate a corpus and manufacture confidence. The
// classifier already excluded these; discovery was still admitting them.
const LEGAL_PATH = /\/(legal|terms|privacy|cookie|disclaimer|imprint|location-restrictions)\b/i;

function classify(link) {
  if (LEGAL_PATH.test(link.url)) return null;
  const hay = `${link.text} ${link.url}`;
  for (const h of SURFACE_HINTS) if (h.re.test(hay)) return h.kind;
  return null;
}

export async function discoverSurfaces({ accounts = null, onEvent = () => {}, perAccount = 4 } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const say = (msg, extra = {}) => onEvent({ stage: 'surfaces', msg, ...extra });

  const targets = (accounts || ICP).filter(a => (a.surfaces || []).some(s => s.status === 'verified'));
  say(`reading ${targets.length} account(s) for surfaces they link to themselves`);

  const found = [], rejected = [];
  for (const acct of targets) {
    const known = new Set((acct.surfaces || []).map(s => s.url.replace(/\/$/, '')));
    const seeds = (acct.surfaces || []).filter(s => s.status === 'verified');

    const candidates = new Map();
    for (const seed of seeds) {
      const src = await fetchSource(seed.url, { skipWhitelist: true });
      if (!src.ok) { rejected.push({ account: acct.name, url: seed.url, reason: 'SOURCE_UNREACHABLE', detail: src.error }); continue; }
      // fetchSource strips tags, so re-fetch raw for the hrefs.
      let html = '';
      try { html = await (await fetch(src.url, { headers: { 'User-Agent': 'helius-bd-tracker' } })).text(); } catch { continue; }
      for (const l of linksFrom(html, src.url)) {
        const kind = classify(l);
        if (!kind) continue;
        const norm = l.url.replace(/\/$/, '');
        if (known.has(norm)) continue;
        if (!candidates.has(norm)) candidates.set(norm, { url: l.url, kind, text: l.text });
      }
    }

    // Prefer INDEX pages over individual articles. /updates keeps producing
    // events; /updates/recovery-plan-for-affected-users was written once and is
    // finished. Shortest path wins within a kind.
    const byKind = new Map();
    for (const c of candidates.values()) {
      const depth = new URL(c.url).pathname.replace(/\/$/, '').split('/').filter(Boolean).length;
      const cur = byKind.get(c.kind);
      if (!cur || depth < cur.depth) byKind.set(c.kind, { ...c, depth });
    }
    // Keep the best index per kind, then any remaining articles as filler.
    const indexes = [...byKind.values()];
    const rest = [...candidates.values()].filter(c => !indexes.some(i => i.url === c.url));
    const list = [...indexes, ...rest].slice(0, perAccount * 3);
    say(`${acct.name}: ${list.length} linked surface(s) to check`);

    let kept = 0;
    for (const c of list) {
      if (kept >= perAccount) break;
      const src = await fetchSource(c.url, { skipWhitelist: true });
      if (!src.ok) { rejected.push({ account: acct.name, url: c.url, kind: c.kind, reason: src.error }); continue; }
      // A surface is only worth adding if it carries readable text. A JS shell
      // that returns four characters is how bags.fm wasted a slot.
      if (src.pageText.length < 600) {
        rejected.push({ account: acct.name, url: c.url, kind: c.kind, reason: 'TOO_LITTLE_TEXT',
                        detail: `${src.pageText.length} chars` });
        continue;
      }
      // Does it carry DATES? A surface with no dates cannot produce an event.
      const dates = (src.pageText.match(/\b(20[0-9]{2}-[01][0-9]-[0-3][0-9]|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+[0-3]?[0-9],?\s+20[0-9]{2})\b/g) || []).length;
      // An ARTICLE is not a surface. A surface keeps producing; an article was
      // written once and is finished. "what-is-a-sui-wallet-everything-you-
      // need-to-know" is SEO content, and admitting it adds a page that will
      // never change to a list we re-read every week.
      // decodeURI first: "%20monad-wallet" counted as two words and slipped
      // through a test meant to catch article slugs.
      let last = '';
      try { last = decodeURIComponent(new URL(src.url).pathname).replace(/\/$/, '').split('/').pop() || ''; }
      catch { last = new URL(src.url).pathname.split('/').pop() || ''; }
      last = last.trim().replace(/\s+/g, '-');
      // Two shapes of article: a long slug, or ANY segment sitting under a
      // collection path. /updates is an index; /updates/<anything> is one post.
      // "monad-wallet" is only two words and needed the second test.
      let path = '/';
      try { path = decodeURIComponent(new URL(src.url).pathname); } catch { path = new URL(src.url).pathname; }
      const underCollection = /\/(articles?|posts?|blog|updates?|news|stories)\/[^/]+\/?$/i.test(path);
      if (last.split('-').length >= 4 || underCollection) {
        rejected.push({ account: acct.name, url: src.url, kind: c.kind, reason: 'ARTICLE_NOT_SURFACE',
                        detail: 'slug reads as a one-off article, not an index' });
        continue;
      }
      // Docs and changelogs are judged on TEXT, not dates. Documentation has no
      // dates because nothing happened - it carries standing conditions, which
      // is a candidate class of its own.
      const isTechnical = c.kind === 'docs' || c.kind === 'changelog';
      found.push({ account: acct.name, url: src.url, kind: c.kind, linkText: c.text,
                   chars: src.pageText.length, dateMentions: dates,
                   dated: isTechnical ? src.pageText.length >= 2000 : dates >= 2,
                   worthWhy: isTechnical
                     ? `technical surface, ${src.pageText.length} chars - yields standing conditions`
                     : `${dates} dated item(s)`,
                   discovered: today,
                   host: new URL(src.url).hostname,
                   basis: 'linked from a surface the account already owns' });
      kept++;
      say(`${acct.name}: ${c.kind} ${src.url} (${src.pageText.length} chars, ${dates} date mention(s))`, { entity: acct.name });
    }
  }

  const dated = found.filter(f => f.dated);
  say(`${found.length} readable surface(s), ${dated.length} carrying dates, ${rejected.length} rejected`);
  return { runId: 'surfaces-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19),
           generatedAt: new Date().toISOString(), found, dated, rejected,
           scanned: targets.map(t => t.name) };
}
