// THE DISCOVERY-TO-REGISTRY BRIDGE.
//
// Discovery produces 149 names. This is the road from a name to an account.
//
// TWO FLAGS, NOT ONE GATE. "Verified" was doing two different jobs: confirming
// a company is real, and confirming we have read its own surface. Requiring
// both to enter the registry meant HumidiFi, Gemini, Robinhood and BisonFi -
// real companies, named by credible sources - were blocked before a human had
// looked at them, which turns discovery into a dead end.
//
//   identity_confirmed  SET BY THIS PASS, with evidence. The name is a real
//                       company: not a token, a chain, a product or a generic
//                       phrase, and it appears in a credible cited source with
//                       a quote grounded against that source in code.
//
//   surface_verified    A CONFIDENCE FLAG. We have fetched the company's own
//                       site, docs, GitHub or status page AND that page names
//                       the company. False is a normal state, not a failure:
//                       it lowers confidence and sets the next action. It never
//                       hides an account and never blocks an opportunity.
//
// So a candidate is promoted on IDENTITY. What stays hard is everything that
// protects against fabrication: a grounded quote, no invented URL, no inferred
// purchase intent, no competitor, no seller-side account, no ceased company.
//
// Which means the domain can never be guessed. "HumidiFi" does not become
// "humidifi.com" because that string is available - the first draft of
// sources.js guessed six blog URLs and four were 404s, and a fabricated
// surface would poison every row built on it.
//
// So the domain comes from a CITED SOURCE, in this order:
//   1. The roster that named the company. solanacompass rosters link each row
//      to a /projects/<slug> page, and that page carries the company's own
//      labelled links: Visit, Blog, Docs, GitHub, Status, Careers.
//   2. DefiLlama's protocol list, which publishes each protocol's declared
//      `url` (the same source seeds.js already trusts).
// If neither names a domain, the account is still promoted - with
// surface_verified false and "find the official surface" as its next action.
// Losing a real company because we have not yet found its docs page is the
// expensive mistake; carrying it with an honest flag is the cheap one.
//
// Ownership is then CHECKED, not assumed: the fetched page must say the
// company's name. The directory's own GitHub account is linked from Mango
// Markets' project page (github.com/solanaguide), so a link being present on
// a company's page does not make it the company's surface.
import { fetchSource } from './fetch.js';
import { solanaProtocols, nameVariants } from './seeds.js';
import { lookupICP } from './icp.js';
import { ownSideReason } from './discover.js';
import { readStatus, STATUS } from './status.js';
import { writeFile, mkdir } from 'node:fs/promises';

const UA = 'helius-bd-tracker';

// Labels a company uses for its own surfaces, on a directory page.
const LINK_KINDS = [
  { kind: 'site',      re: /\b(visit|website|home|official)\b/i },
  { kind: 'blog',      re: /\b(blog|news|updates|newsroom|press)\b/i },
  { kind: 'docs',      re: /\b(docs|documentation|developers?|api|guides)\b/i },
  { kind: 'github',    re: /\b(github|source|code|repo)\b/i },
  { kind: 'status',    re: /\b(status|uptime|incidents)\b/i },
  { kind: 'careers',   re: /\b(careers|jobs|hiring)\b/i },
  { kind: 'changelog', re: /\b(changelog|releases|release notes)\b/i }
];

// Somebody else's surface. A Discord invite is not evidence about a company's
// infrastructure, and a directory's own socials are not the company's at all.
const OFFSITE = /twitter\.com|x\.com|linkedin|discord|t\.me|telegram|youtube|facebook|instagram|reddit|thegrid\.id|wsrv\.nl/i;

// FIRST-PARTY MEANS THEIR OWN DOMAIN - or a platform they control a space on.
//
// The first full run filed this as Flash Trade's blog:
//   solanafloor.com/news/flash-trade-winds-down-citing-shrinking-market
// A news article about a company is not a surface the company owns, and the
// ownership check passed it because the article does name Flash Trade. The
// check was answering "does this page mention them?" when the question is
// "do they publish this page?".
//
// Companies do legitimately host their own docs on a platform - gitbook,
// readthedocs, notion, a GitHub org - so those are allowed only when the
// company's own name is in the subdomain, the path or the org. Everything else
// must share the registrable domain of the company's own site.
const DOC_PLATFORM = /(^|\.)(gitbook\.io|readthedocs\.io|notion\.site|github\.io|mintlify\.app|vercel\.app|netlify\.app)$/i;
const CODE_PLATFORM = /(^|\.)github\.com$/i;

export const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const registrable = h => String(h || '').split('.').slice(-2).join('.');

/* Is this url a surface the company PUBLISHES, rather than one that merely
   mentions it? `primary` is the registrable domain of the company's own site. */
export function firstParty(name, url, primary) {
  let u; try { u = new URL(url); } catch { return { ok: false, why: 'unparseable url' }; }
  const host = u.hostname.replace(/^www\./, '');
  if (primary && registrable(host) === primary) return { ok: true, how: 'their own domain' };
  const want = new Set([norm(name), ...nameVariants(name).map(norm)].filter(v => v.length >= 4));
  const hay = norm(host + ' ' + u.pathname);
  if (DOC_PLATFORM.test(host) || CODE_PLATFORM.test(host)) {
    for (const v of want)
      if (hay.includes(v)) return { ok: true, how: `a ${host} space carrying their name` };
    return { ok: false, why: `${host} space does not carry their name` };
  }
  // No primary domain established yet: accept a host that IS the name, which is
  // how the primary gets established in the first place.
  if (!primary) {
    for (const v of want) if (norm(host).includes(v)) return { ok: true, how: 'the domain is the name' };
  }
  return { ok: false, why: `${host} is not a domain this company publishes` };
}

export async function rawHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return { html: await res.text(), finalUrl: res.url || url };
}

/* Every <a> on a page, with its text. Kept separate from surfaces.js's version
   because that one strips `page` parameters - which is exactly what the
   source-depth pass needs to keep. */
export function links(html, baseUrl) {
  const out = new Map();
  // Match the OPENING TAG, then look for the closing tag separately.
  //
  // A single regex with the text inline needs a length cap on the inner
  // content, and that cap silently drops exactly the links that matter: a
  // solanacompass roster row is
  //   <a href="/projects/mango-markets" class="project-row">
  //     <div class="project-row__rank">10</div><img src="...wsrv.nl?url=..." ...>
  // which is well over 160 characters of nested markup before </a>. With the
  // cap in place the lazy match failed on every project row and the extractor
  // returned only the short category links - so the bridge reported "no cited
  // source names a domain" for companies whose link was right there.
  const open = /<a\b([^>]*)>/gi;
  let m;
  while ((m = open.exec(html))) {
    const hrefM = /href=["']([^"']+)["']/i.exec(m[1]);
    if (!hrefM) continue;
    const href = hrefM[1].trim().replace(/&amp;/gi, '&').replace(/&#38;/g, '&');
    const from = m.index + m[0].length;
    const close = html.indexOf('</a', from);
    const inner = html.slice(from, close < 0 ? from + 4000 : Math.min(close, from + 4000));
    const text = inner.replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/gi, '&').replace(/&#39;/g, "'").replace(/&quot;/gi, '"')
      .replace(/\s+/g, ' ').trim();
    if (!href || /^(#|mailto:|javascript:|tel:)/i.test(href)) continue;
    let u; try { u = new URL(href, baseUrl); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    u.hash = '';
    const prev = out.get(u.href);
    // Keep the most descriptive text seen for a url.
    if (!prev || text.length > prev.length) out.set(u.href, text);
  }
  return [...out.entries()].map(([url, text]) => ({ url, text }));
}

/* STEP 1 - the roster's own page for this company.
   A roster row links to the directory's page for that company. Find it by
   matching the slug or the row text against the name, never by building a
   slug from the name. */
export function directoryPageFor(name, rosterHtml, rosterUrl) {
  const want = norm(name);
  if (!want) return null;
  const host = new URL(rosterUrl).hostname;
  const candidates = links(rosterHtml, rosterUrl)
    .filter(l => new URL(l.url).hostname === host && /\/projects?\//i.test(l.url));
  // Exact: the slug's letters equal the name's letters.
  const slugOf = u => norm(u.split('/').filter(Boolean).pop());
  let hit = candidates.find(l => slugOf(l.url) === want);
  // Else the link text names the company and the slug is a prefix of it.
  if (!hit) hit = candidates.find(l => norm(l.text).includes(want) && want.startsWith(slugOf(l.url).slice(0, 4)));
  if (!hit) hit = candidates.find(l => slugOf(l.url).startsWith(want) || want.startsWith(slugOf(l.url)));
  return hit ? hit.url : null;
}

/* STEP 2 - the company's own links, off the directory page. */
export function surfaceLinks(dirHtml, dirUrl) {
  const dirHost = new URL(dirUrl).hostname;
  const found = [];
  for (const l of links(dirHtml, dirUrl)) {
    const u = new URL(l.url);
    if (u.hostname === dirHost) continue;            // the directory's own pages
    if (OFFSITE.test(u.hostname)) continue;
    const hay = `${l.text} ${u.pathname}`;
    const k = LINK_KINDS.find(x => x.re.test(hay));
    if (!k) continue;
    found.push({ kind: k.kind, url: l.url, text: l.text, host: u.hostname });
  }
  return found;
}

/* STEP 3 - does this page belong to the company it claims to?
   The page must say the name. This is what stops a directory's own GitHub
   account being filed as the company's repository. */
export function pageClaimsName(name, pageText, url) {
  const text = norm(pageText);
  const variants = new Set([norm(name), ...nameVariants(name).map(norm)]);
  for (const v of variants) if (v.length >= 3 && text.includes(v)) return { ok: true, matched: v, how: 'name appears in the page text' };
  // A domain that IS the name is its own evidence: mango.markets for "Mango
  // Markets". Letters only, so punctuation and TLD never carry the match.
  try {
    const h = norm(new URL(url).hostname.replace(/^www\./, ''));
    for (const v of variants) if (v.length >= 4 && h.includes(v)) return { ok: true, matched: v, how: 'the domain is the name' };
  } catch {}
  return { ok: false };
}

/* ---- BUYER SEGMENT, FROM THE ROSTER TIER ------------------------------
   The funnel cannot call anything an opportunity without a buyer segment, and
   the first run after promotion showed why that mattered: 28 promoted accounts
   had real product fit - BAM 59 on validator, BlockPI 59 on rpc, Chorus One 55
   on vaas, Astralane 51 on shreds - and every one was parked in research
   reading "no buyer segment is assigned".

   The roster tier is already a classification of what kind of company it is,
   and it is grounded: the discoverer had to quote the page verbatim and the
   quote was checked in code. So the tier maps to a segment, and the mapping is
   recorded with its basis rather than asserted.

   'unclear' maps to nothing. A tier that says "the page does not say enough to
   place it" must not be laundered into a buyer segment. */
export const TIER_SEGMENT = {
  trading:       'trader',          // desks, prop shops, market makers, prop AMMs
  institutional: 'institutional',   // exchanges, custodians, DATs, ETF issuers
  builder:       'defi',            // protocols, wallets and apps at scale
  infra:         'infrastructure',  // validator operators, staking, bridges
  data:          'infrastructure',  // explorers and indexers buy the same products
  unclear:       null               // deliberately unplaced
};

export const segmentFor = tier => TIER_SEGMENT[tier] ?? null;

/* The whole bridge, for one candidate. */
export async function bridgeCandidate(c, { rosterCache, llama, onEvent = () => {} }) {
  const out = { name: c.name, tier: c.tier, roster: c.source_url,
                identity_confirmed: false, identity_basis: null,
                surface_verified: false,
                domain: null, domain_basis: null, surfaces: [], rejected: [],
                promoted: false, reason: null, held_reason: null };

  // THE ONLY HARD STOPS. Each is a stated fact about the company, not a
  // judgement about our own research progress.
  const own = ownSideReason(c.name);
  if (own) { out.reason = `not a prospect - ${own}`; out.held_reason = 'disqualified'; return out; }
  if (lookupICP(c.name)) { out.reason = 'already in the registry'; out.held_reason = 'duplicate'; return out; }

  // IDENTITY. The discovery pass already proved this in code before writing
  // the candidate: the name is not a token, an asset row, a chain or a generic
  // phrase, and its quote was grounded character-for-character against a page
  // fetched from a whitelisted host. That is the evidence, and it is recorded
  // rather than asserted.
  out.identity_confirmed = true;
  out.identity_basis = {
    cited_source: c.source_url,
    quote: c.quote,
    grounded: 'quote matched against the fetched page in code',
    checks: 'not a token ticker, asset row, chain, product name or generic phrase',
    roster_tier: c.tier
  };

  /* --- domain, from a cited source only ------------------------------- */
  let dirUrl = null;
  try {
    if (!rosterCache.has(c.source_url))
      rosterCache.set(c.source_url, (await rawHtml(c.source_url)).html);
    dirUrl = directoryPageFor(c.name, rosterCache.get(c.source_url), c.source_url);
  } catch (e) { out.rejected.push({ step: 'roster', detail: e.message }); }

  let linksFound = [];
  if (dirUrl) {
    try {
      const d = await rawHtml(dirUrl);
      linksFound = surfaceLinks(d.html, d.finalUrl);
      out.domain_basis = { source: dirUrl, how: 'the roster\'s own page for this company' };
      onEvent({ stage: 'bridge', msg: `${c.name}: ${linksFound.length} declared link(s) via ${dirUrl}` });
    } catch (e) { out.rejected.push({ step: 'directory_page', url: dirUrl, detail: e.message }); }
  }

  // Fall back to DefiLlama's declared url for the protocol.
  if (!linksFound.length && llama) {
    const want = new Set([norm(c.name), ...nameVariants(c.name).map(norm)]);
    const hit = llama.find(p => want.has(norm(p.name)) && p.url);
    if (hit) {
      linksFound = [{ kind: 'site', url: hit.url, text: 'DefiLlama declared url', host: new URL(hit.url).hostname }];
      out.domain_basis = { source: 'https://api.llama.fi/protocols', how: 'the protocol\'s own declared url on DefiLlama' };
      onEvent({ stage: 'bridge', msg: `${c.name}: declared url from DefiLlama` });
    }
  }

  if (!linksFound.length) {
    // Promoted anyway. Identity is confirmed; we simply have not found its own
    // pages yet, and that is a research task, not a reason to drop a company.
    out.promoted = true;
    out.reason = 'identity confirmed; no cited source names a domain yet - surface not yet verified';
    return out;
  }

  /* --- verify each surface: it fetches, and it is theirs -------------- */
  const site = linksFound.find(l => l.kind === 'site') || linksFound[0];
  out.domain = registrable(site.host);

  const seen = new Set();
  for (const l of linksFound) {
    if (seen.has(l.url)) continue;
    seen.add(l.url);
    let page;
    try { page = await fetchSource(l.url, { skipWhitelist: true }); }
    catch (e) { out.rejected.push({ step: 'fetch', kind: l.kind, url: l.url, detail: e.message }); continue; }
    if (!page.ok) { out.rejected.push({ step: 'fetch', kind: l.kind, url: l.url, detail: page.error }); continue; }

    // TWO CHECKS, and they ask different questions. firstParty asks "do they
    // publish this?"; pageClaimsName asks "does it name them?". A news article
    // about a company passes the second and fails the first, which is why both
    // are needed - solanafloor's "Flash Trade winds down" story was being
    // filed as Flash Trade's own blog.
    const fp = firstParty(c.name, page.url, out.domain);

    // STATUS IS READ FROM EVERY PAGE FETCHED, first-party or not, and the
    // basis is recorded. These are different jobs: a third-party page can
    // never be EVIDENCE OF NEED, but it can certainly report that a company
    // has shut down - and solanafloor's "Flash Trade winds down" story is
    // exactly that. Rejecting it as a surface and then promoting the company
    // anyway is how a dead account enters the registry, which is the single
    // most expensive error this system has made (Zeta, promoted eighteen
    // months after it ceased).
    //
    // A first-party cessation is decisive. A third-party one HOLDS the
    // candidate for a human instead of silently dropping or silently
    // promoting it, because a news story can be wrong or out of date.
    const st = readStatus(page.pageText, [c.name, ...nameVariants(c.name)]);
    if (st && st.status && st.status !== STATUS.ACTIVE) {
      const better = !out.status || (fp.ok && out.status_basis !== 'first_party');
      if (better) {
        out.status = st.status;
        out.status_basis = fp.ok ? 'first_party' : 'third_party';
        out.status_evidence = { url: page.url, quote: st.quote || null,
                                basis: fp.ok ? 'the company\'s own page' : 'a third-party report' };
      }
    }

    if (!fp.ok) {
      out.rejected.push({ step: 'first_party', kind: l.kind, url: page.url, detail: fp.why });
      continue;
    }
    const claim = pageClaimsName(c.name, page.pageText, page.url);
    if (!claim.ok) {
      // This is the github.com/solanaguide case: a link on the company's
      // directory page that belongs to somebody else entirely.
      out.rejected.push({ step: 'ownership', kind: l.kind, url: page.url,
                          detail: `page never names ${c.name} - not verified as theirs` });
      continue;
    }

    out.surfaces.push({ kind: l.kind, url: page.url, host: new URL(page.url).hostname,
                        chars: page.fullChars, title: page.title || null,
                        verified: 'fetched, published by them, and names them',
                        first_party: fp.how, ownership: claim.how, matched: claim.matched });
  }

  // CEASED COMPANIES STAY EXCLUDED - one of the guards the two-flag rule
  // explicitly does not loosen.
  if (out.status) {
    out.promoted = false;
    out.held_reason = out.status_basis === 'first_party' ? 'ceased' : 'ceased_unconfirmed';
    out.reason = out.status_basis === 'first_party'
      ? `company status is ${String(out.status).toUpperCase()} on its own page - not a prospect`
      : `a third-party report says this company is ${String(out.status).toUpperCase()} - ` +
        `held for a human to confirm, not promoted and not dropped`;
    return out;
  }

  out.promoted = true;
  if (!out.surfaces.length) {
    out.reason = 'identity confirmed; every candidate surface failed to fetch or ' +
                 'could not be verified as theirs - surface not yet verified';
    return out;
  }
  out.surface_verified = true;
  out.reason = `${out.surfaces.length} first-party surface(s) verified`;
  return out;
}

export async function runBridge({ candidates, onEvent = () => {}, limit = 40 }) {
  const rosterCache = new Map();
  let llama = null;
  try { llama = await solanaProtocols(); } catch { onEvent({ stage: 'bridge', msg: 'DefiLlama unavailable - roster links only' }); }

  const results = [];
  for (const c of candidates.slice(0, limit)) {
    let r;
    try { r = await bridgeCandidate(c, { rosterCache, llama, onEvent }); }
    catch (e) { r = { name: c.name, tier: c.tier, promoted: false, reason: `bridge failed: ${e.message}`, surfaces: [], rejected: [] }; }
    results.push(r);
    const tag = !r.promoted ? 'hold    ' : r.surface_verified ? 'PROMOTE ' : 'promote*';
    onEvent({ stage: 'bridge', msg: `${tag} ${r.name} - ${r.reason}` });
  }

  const promoted = results.filter(r => r.promoted);
  const withSurface = promoted.filter(r => r.surface_verified);
  return {
    kind: 'bridge',
    bridgeId: `bridge-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
    generatedAt: new Date().toISOString(),
    counts: {
      considered: results.length,
      promoted: promoted.length,
      identity_confirmed: promoted.length,
      surface_verified: withSurface.length,
      surface_not_yet_verified: promoted.length - withSurface.length,
      held: results.length - promoted.length,
      held_disqualified: results.filter(r => r.held_reason === 'disqualified').length,
      held_ceased: results.filter(r => r.held_reason === 'ceased').length,
      held_ceased_unconfirmed: results.filter(r => r.held_reason === 'ceased_unconfirmed').length,
      held_duplicate: results.filter(r => r.held_reason === 'duplicate').length,
      surfaces: promoted.reduce((a, r) => a + r.surfaces.length, 0)
    },
    // Ready to paste into icp.js. Emitted rather than written, because the
    // registry is hand-curated on purpose and a human should see what enters it.
    registryEntries: promoted.map(r => ({
      name: r.name, aliases: [r.name],
      segment: segmentFor(r.tier),
      segment_basis: segmentFor(r.tier)
        ? `roster tier "${r.tier}", from a quote grounded against ${r.roster}`
        : 'the roster did not say enough to place this company',
      rel: 'PROSPECT',
      status: 'active', domain: r.domain,
      // Both flags travel with the account, so nothing downstream has to guess
      // which kind of "verified" it is looking at.
      identity_confirmed: r.identity_confirmed,
      identity_basis: r.identity_basis,
      surface_verified: r.surface_verified,
      basis: r.domain_basis,
      surfaces: r.surfaces.map(s => ({ url: s.url, kind: s.kind, status: 'verified',
                                       chars: s.chars, verified_on: new Date().toISOString().slice(0, 10) })),
      next_action: r.surface_verified
        ? 'Run the batch scan against these surfaces.'
        : 'Find and verify the official surface - site, docs, GitHub or status page - then run the batch scan.',
      note: `Promoted from the discovery pass on IDENTITY. ` +
            (r.surface_verified
              ? `Domain from ${r.domain_basis?.how}. `
              : `Surface not yet verified: no first-party page has been fetched and confirmed as theirs. `) +
            `Tier ${r.tier} on the roster. No dated evidence yet - run the batch scan.`
    })),
    results,
    disclaimer: 'A promoted account has a CONFIRMED IDENTITY and nothing else. It has ' +
      'evidenced no need for any Helius product. surface_verified says whether its own ' +
      'pages have been read yet - false is a normal state that lowers confidence and sets ' +
      'the next action, never a reason to hide the account. The batch scan is what finds ' +
      'evidence; the funnel is what turns evidence into an opportunity.'
  };
}

export async function saveBridge(result, dir = 'data/bridge') {
  await mkdir(dir, { recursive: true });
  const file = `${dir}/${result.bridgeId}.json`;
  await writeFile(file, JSON.stringify(result, null, 2));
  return file;
}
