// Seed resolution. Surface discovery can only read links off a page an account
// already owns - so an account with NO verified surface can never be started.
// That is where the six candidate orgs in the universe map were stuck.
//
// The rule against constructing URLs still holds: we do not turn "Raydium" into
// "raydium.io" and hope. Instead a SOURCE supplies the URL. DefiLlama's public
// API returns each protocol's own declared `url`, which we then fetch and
// verify ourselves before admitting it. The directory is the citation for where
// to look; the fetched page is the evidence.
import { fetchSource } from './fetch.js';

const LLAMA = 'https://api.llama.fi/protocols';
let cache = null;

export async function solanaProtocols() {
  if (cache) return cache;
  const r = await fetch(LLAMA, { headers: { 'user-agent': 'helius-bd-tracker' } });
  if (!r.ok) { const e = new Error(`DefiLlama ${r.status}`); e.code = 'DIRECTORY_UNREACHABLE'; throw e; }
  const all = await r.json();
  cache = all.filter(p => (p.chains || []).includes('Solana'));
  return cache;
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// What a JS shell declares about itself, in its own markup. Never a guess.
async function declaredLinks(url) {
  let html = '';
  try { html = await (await fetch(url, { headers: { 'User-Agent': 'helius-bd-tracker' } })).text(); }
  catch { return []; }
  const out = new Set();
  const push = h => {
    if (!h) return;
    try { const u = new URL(h, url); if (/^https?:$/.test(u.protocol)) out.add(u.href); } catch {}
  };
  // canonical and og:url - the page's own statement of where it lives
  for (const m of html.matchAll(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/gi)) push(m[1]);
  for (const m of html.matchAll(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/gi)) push(m[1]);
  // JSON-LD sameAs / url
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1]);
      for (const v of [].concat(j.url || [], j.sameAs || [])) push(v);
    } catch {}
  }
  // docs / changelog links the shell hard-codes in its markup
  for (const m of html.matchAll(/href=["']([^"']*(?:docs|developer|changelog)[^"']*)["']/gi)) push(m[1]);
  return [...out].filter(u => !/twitter\.com|x\.com|discord|t\.me|linkedin|youtube|github\.com\/?$/i.test(u));
}

// A directory name carries a product suffix - "Orca DEX", "Templar Lending",
// "Exponent Yield Exchange" - but the company's own page just says "Orca".
// Matching the full normalised string rejected six of sixteen seeds as
// NAME_NOT_ON_PAGE when the name was right there.
const SUFFIX = /\b(dex|amm|v[0-9]+|lend(ing)?|yield|exchange|protocol|finance|infinity|aggregator|swap|perps?|markets?|labs?|network)\b/gi;
export function nameVariants(name) {
  const full = norm(name);
  const stripped = norm(String(name).replace(SUFFIX, ' '));
  const firstWord = norm(String(name).trim().split(/\s+/)[0]);
  return [...new Set([full, stripped, firstWord].filter(v => v && v.length >= 3))];
}

function namesItself(src, want) {
  const hay = [norm(src.pageText.slice(0, 4000)), norm(src.title || ''),
               norm(new URL(src.url).hostname)].join(' ');
  const variants = Array.isArray(want) ? want : [want];
  return variants.some(v => hay.includes(v));
}

function seedRecord(matches, requested, src, basis, today) {
  return { name: matches[0].name, requested, url: src.url, host: new URL(src.url).hostname,
           chars: src.pageText.length, title: src.title || null,
           category: matches[0].category || null, tvl: Math.round(matches[0].tvl || 0),
           products: matches.length, basis, discovered: today };
}

export async function resolveSeeds({ names, minTvl = 0, onEvent = () => {} }) {
  const today = new Date().toISOString().slice(0, 10);
  const say = (msg, extra = {}) => onEvent({ stage: 'seeds', msg, ...extra });

  const sol = await solanaProtocols();
  say(`DefiLlama lists ${sol.length} protocols on Solana`);

  const admitted = [], rejected = [];
  for (const name of names) {
    const want = nameVariants(name);
    const matches = sol
      .filter(p => want.some(v => norm(p.name).includes(v) || norm(p.slug).includes(v)))
      .filter(p => (p.tvl || 0) >= minTvl)
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0));

    if (!matches.length) { rejected.push({ name, reason: 'NOT_IN_DIRECTORY' }); say(`${name}: not listed on Solana`); continue; }

    // One seed per NAME, not per protocol entry - Meteora lists four products
    // that all point at the same site.
    const urls = [...new Set(matches.map(m => m.url).filter(Boolean))];
    if (!urls.length) { rejected.push({ name, reason: 'NO_DECLARED_URL', detail: `${matches.length} entries, none with a url` });
                        say(`${name}: listed, but declares no URL`); continue; }

    let seeded = false;
    for (const url of urls.slice(0, 2)) {
      const src = await fetchSource(url, { skipWhitelist: true });
      // fetchSource returns TOO_LITTLE_TEXT as a FAILURE below 200 chars, so a
      // JS shell never reached the rescue path below - it exited here first.
      const isShell = !src.ok && src.error === 'TOO_LITTLE_TEXT';
      if (!src.ok && !isShell) { rejected.push({ name, url, reason: src.error }); continue; }
      if (isShell || src.pageText.length < 600) {
        // A JS shell renders nothing, but it still DECLARES things in its head:
        // canonical links, og:url, JSON-LD, and links to its own docs. Raydium
        // and Meteora were lost here. We read only what the shell itself
        // declares - still never guessing a domain.
        const rendered = src.pageText?.length ?? 0;
        const declared = await declaredLinks(url);
        say(`${name}: ${url} renders ${rendered} chars - reading what it declares (${declared.length} link(s))`);
        let rescued = false;
        for (const d of declared.slice(0, 4)) {
          const alt = await fetchSource(d, { skipWhitelist: true });
          if (!alt.ok || alt.pageText.length < 600) continue;
          if (!namesItself(alt, want)) continue;
          admitted.push(seedRecord(matches, name, alt, 'declared by the protocol\'s own JS shell (canonical, og:url, JSON-LD or docs link), then fetched and confirmed', today));
          say(`${name}: rescued via ${alt.url} (${alt.pageText.length} chars)`, { entity: name });
          rescued = true; break;
        }
        if (rescued) { seeded = true; break; }
        rejected.push({ name, url, reason: 'TOO_LITTLE_TEXT',
                        detail: `${rendered} chars rendered; ${declared.length} declared link(s), none readable and naming the company` });
        continue;
      }
      // Does the fetched page actually look like this company's own site? A
      // directory can be stale or point at a parked domain.
      const ownsItself = namesItself(src, want);
      if (!ownsItself) {
        rejected.push({ name, url, finalUrl: src.url, reason: 'NAME_NOT_ON_PAGE',
                        detail: 'the page does not name the company the directory attributed it to' });
        say(`${name}: ${src.url} does not name ${name} - not admitted`);
        continue;
      }
      admitted.push({
        name: matches[0].name, requested: name,
        url: src.url, host: new URL(src.url).hostname,
        chars: src.pageText.length, title: src.title || null,
        category: matches[0].category || null,
        tvl: Math.round(matches[0].tvl || 0),
        products: matches.length,
        basis: 'URL declared by the protocol in the DefiLlama directory, then fetched and confirmed to name the company',
        discovered: today
      });
      say(`${name}: ${src.url} (${src.pageText.length} chars, ${matches[0].category})`, { entity: name });
      seeded = true;
      break;
    }
    if (!seeded && !rejected.some(r => r.name === name)) rejected.push({ name, reason: 'NO_READABLE_URL' });
  }

  say(`${admitted.length} seed(s) admitted, ${rejected.length} rejected`);
  return { runId: 'seeds-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19),
           generatedAt: new Date().toISOString(), admitted, rejected,
           requested: names };
}
