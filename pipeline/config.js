import { readFileSync } from 'node:fs';
// NEAR AI Cloud is the only inference path. There is no local fallback and no
// Claude call anywhere in this pipeline - if the key is absent the run aborts.
export const NEAR = {
  baseUrl: process.env.NEAR_AI_BASE_URL || 'https://cloud-api.near.ai/v1',
  apiKey:  process.env.NEAR_AI_API_KEY || '',
  // Claimed free from the builders dashboard during the hackathon.
  // Spend-limited, expires with the event.
  models: {
    // cheap + fast: extraction and classification
    light: process.env.NEAR_AI_MODEL_LIGHT || 'google/gemini-2.5-flash-lite',
    // reasoning: enrichment and the brief
    heavy: process.env.NEAR_AI_MODEL_HEAVY || 'google/gemini-2.5-flash-lite'
  }
};

// The declared motion. Everything the pipeline does is scoped to this.
export const MOTION = {
  product: 'Sender',
  buyer:   'infrastructure lead at a Solana-native trading firm or exchange',
  chain:   'Solana'
};

// Source whitelist. A candidate citing anything not on this list is rejected.
// "Fish where the fish are" - a lesson carried from the Acre v3 post-mortem.
// What KIND of surface a host is. Market context can never produce an
// actionable lead, however good the evidence looks.
export const SOURCE_CLASS = {
  buyer_owned:         ['buyer_surface','company','company_ir','vendor'],
  technical_ecosystem: ['official','repo','docs'],
  market_context:      ['news','press'],
  directory:           ['data','aggregator','competitor']
};
export function sourceTypeOf(type){
  for (const k of Object.keys(SOURCE_CLASS)) if (SOURCE_CLASS[k].includes(type)) return k;
  return 'directory';
}
export const SOURCE_TYPE_CAP = {
  buyer_owned: 'ACTIONABLE', technical_ecosystem: 'ACTIONABLE',
  market_context: 'RESEARCH', directory: 'RESEARCH'
};

export const SOURCE_WHITELIST = [
  // Added 2026-11-05 after fetching each one and confirming it is the account's
  // own surface - not a redirect, not a JS shell.
  { host:'titan-exchange.gitbook.io', type:'docs',          tier:1 },
  { host:'docs.velocity.exchange',    type:'docs',          tier:1 },
  // Discovered 2026-11-10 by surfaces.js and verified readable + dated.
  { host:'developers.jup.ag',         type:'docs',          tier:1 },
  { host:'docs.zeta.markets',         type:'docs',          tier:1 },
  { host:'zeta.markets',              type:'buyer_surface', tier:1 },
  { host:'docs.backpack.exchange',    type:'docs',          tier:1 },
  { host:'backpack.exchange',         type:'buyer_surface', tier:1 },
  { host:'flint.trade',               type:'buyer_surface', tier:1 },

  // tier 1 - primary, the company's own words
  { host: 'solana.com',            tier: 1, type: 'official'   },
  { host: 'helius.dev',            tier: 1, type: 'vendor'     },
  { host: 'investors.securitize.io', tier: 1, type: 'company_ir' },
  { host: 'jumpcrypto.com',        tier: 1, type: 'company'    },
  { host: 'github.com',            tier: 1, type: 'repo'       },
  { host: 'anza.xyz',              tier: 1, type: 'official'   },
  { host: 'solanafloor.com',       tier: 2, type: 'news'       },
  { host: 'jupresear.ch',          tier: 1, type: 'company'    },
  // tier 1 - trading venues and firms: the declared buyer publishes here
  { host: 'jup.ag',                tier: 1, type: 'company'    },
  { host: 'drift.trade',           tier: 1, type: 'company'    },
  { host: 'zeta.markets',          tier: 1, type: 'company'    },
  { host: 'raydium.io',            tier: 1, type: 'company'    },
  { host: 'orca.so',               tier: 1, type: 'company'    },
  { host: 'marginfi.com',          tier: 1, type: 'company'    },
  { host: 'kamino.finance',        tier: 1, type: 'company'    },
  { host: 'ellipsislabs.xyz',      tier: 1, type: 'company'    },
  { host: 'mirror.xyz',            tier: 1, type: 'company'    },
  { host: 'medium.com',            tier: 2, type: 'company'    },
  { host: 'substack.com',          tier: 2, type: 'company'    },
  // tier 1 - BUYER-OWNED SURFACES: where a firm talks about its own stack
  { host: 'jito.network',             tier: 1, type: 'buyer_surface' },
  { host: 'jitolabs.com',             tier: 1, type: 'buyer_surface' },
  { host: 'wintermute.com',           tier: 1, type: 'buyer_surface' },
  { host: 'gsr.io',                   tier: 1, type: 'buyer_surface' },
  { host: 'ambergroup.io',            tier: 1, type: 'buyer_surface' },
  { host: 'flowtraders.com',          tier: 1, type: 'buyer_surface' },
  { host: 'pyth.network',             tier: 1, type: 'buyer_surface' },
  { host: 'mango.markets',            tier: 1, type: 'buyer_surface' },
  { host: 'jobs.ashbyhq.com',         tier: 1, type: 'buyer_surface' },
  { host: 'boards.greenhouse.io',     tier: 1, type: 'buyer_surface' },
  { host: 'job-boards.greenhouse.io', tier: 1, type: 'buyer_surface' },
  { host: 'jobs.lever.co',            tier: 1, type: 'buyer_surface' },
  { host: 'wellfound.com',            tier: 1, type: 'buyer_surface' },
  { host: 'status.jito.network',      tier: 1, type: 'buyer_surface' },
  { host: 'docs.jito.network',        tier: 1, type: 'buyer_surface' },
  { host: 'x.com',                    tier: 1, type: 'buyer_surface' },
  { host: 'titandex.io',              tier: 1, type: 'buyer_surface' },
  { host: 'titan.exchange',           tier: 1, type: 'buyer_surface' },
  { host: 'flintlabs.io',             tier: 1, type: 'buyer_surface' },
  { host: 'bags.fm',                  tier: 1, type: 'buyer_surface' },
  { host: 'pump.fun',                 tier: 1, type: 'buyer_surface' },
  { host: 'ellipsislabs.xyz',         tier: 1, type: 'buyer_surface' },
  { host: 'woo.org',                  tier: 1, type: 'buyer_surface' },
  { host: 'woofi.com',                tier: 1, type: 'buyer_surface' },
  { host: 'status.kraken.com',        tier: 1, type: 'buyer_surface' },
  { host: 'kraken.com',               tier: 1, type: 'buyer_surface' },
  { host: 'status.coinbase.com',      tier: 1, type: 'buyer_surface' },
  { host: 'dflow.net',                tier: 1, type: 'buyer_surface' },
  { host: 'solana.org',               tier: 1, type: 'buyer_surface' },
  { host: 'drift.trade',              tier: 1, type: 'buyer_surface' },
  { host: 'app.drift.trade',          tier: 1, type: 'buyer_surface' },
  { host: 'velocity.exchange',        tier: 1, type: 'buyer_surface' },
  { host: 'docs.titandex.io',         tier: 1, type: 'buyer_surface' },
  // tier 2 - trade press, corroboration only
  { host: 'theblock.co',           tier: 2, type: 'news'       },
  { host: 'cryptobriefing.com',    tier: 2, type: 'news'       },
  { host: 'coindesk.com',          tier: 2, type: 'news'       },
  { host: 'solanacompass.com',     tier: 2, type: 'news'       },
  { host: 'dune.com',              tier: 2, type: 'data'       },
  { host: 'blockworks.co',         tier: 2, type: 'news'       },
  { host: 'blockworks.com',        tier: 2, type: 'news'       },
  { host: 'dlnews.com',            tier: 2, type: 'news'       },
  { host: 'theblockbeats.info',    tier: 2, type: 'news'       },
  { host: 'defillama.com',         tier: 2, type: 'data'       }
];

// Blocked aliases - the name-collision guard, enforced before anything else.
export const BLOCKED_ALIASES = [
  'helius medical technologies', 'hsdt', 'solana company'
];

// A chain is not a company. The collector will happily return "Solana" as the
// entity when a page talks about the ecosystem, and a row like that scored 61
// and reached QUALIFY before this list existed. You cannot sell Sender to a
// blockchain, so these are not named entities.
export const GENERIC_ENTITIES = [
  'solana', 'solana network', 'solana blockchain', 'solana ecosystem',
  'defi', 'solana defi', 'crypto', 'web3', 'the network', 'ethereum',
  'blockchain', 'the ecosystem', 'solana foundation ecosystem'
];
// A token listing is not a company. The targeted collectors pulled 15 rows of
// "Bonk (BONK)", "Unicorn Fart Dust (UFD)" and "Tether USD (USDT)" out of
// exchange listing tables - each a grounded quote naming a real ticker, and
// none of them a business anyone can sell infrastructure to.
// "Fwog (FWOG)" is a token. "Amazon Web Services (AWS)" and "Intercontinental
// Exchange (ICE)" are companies, and the flat paren-caps rule rejected both.
// The difference is structural: a ticker is a NEW string, an acronym is built
// from the initials of the words in front of it. So build the initials and
// compare. "Fwog" -> "F" != "FWOG"; "Amazon Web Services" -> "AWS" == "AWS".
const initialsOf = words =>
  words.filter(w => /^[A-Za-z]/.test(w)).map(w => w[0].toUpperCase()).join('');

export const isAcronymOfName = name => {
  const m = /^(.+?)\s*\(([A-Z0-9]{2,10})\)\s*$/.exec(String(name || '').trim());
  if (!m) return false;
  const words = m[1].trim().split(/[\s\-&.]+/).filter(Boolean);
  if (words.length < 2) return false;            // "Fwog (FWOG)" cannot qualify
  const inits = initialsOf(words);
  if (inits === m[2]) return true;
  // Allow the small words to be skipped: "Bank of America (BOA)" and "(BA)".
  const big = words.filter(w => !/^(of|the|and|for|de|du|la|le)$/i.test(w));
  return initialsOf(big) === m[2];
};
// KNOWN LIMIT, deliberately accepted. An acronym that takes letters from
// INSIDE a word is not recognised: "Intercontinental Exchange (ICE)" gives
// initials "IE", so it is still treated as a token listing. Every looser rule
// tried - subsequence matching on the name's letters - let "Goatseus Maximus
// (GOAT)" and "Tether USD (USDT)" back through, which is the worse error: this
// pipeline's job is to keep memecoins out of a BD list, and in practice those
// companies arrive as "ICE" or "Intercontinental Exchange" with no bracket.

export const isTokenListing = name =>
  (/\([A-Z0-9]{2,10}\)/.test(String(name || '')) && !isAcronymOfName(name)) ||
  /\b(token|coin)\s*\(/i.test(String(name || ''));

// An ASSET ROW on an exchange's status or markets page is not a company.
// Kraken's status page lists every tradeable asset as "Name (TICKER) - Solana
// / Operational". The entity name alone looks like a company ("Grass",
// "Frontier Stable Token"), so the name test cannot catch it - but the quote
// always puts a ticker directly after the name. Test the evidence, not the name.
/* ---- BRIDGE-VERIFIED SURFACES -----------------------------------------
   The whitelist governs PROVENANCE: it is the list of hosts a piece of
   evidence may come from. Every entry above was fetched and confirmed by hand.

   The bridge does exactly that job automatically, and more strictly than a
   hand-check: before it records a surface it confirms the page fetches, that
   the company PUBLISHES it (its own registrable domain, or a docs/GitHub space
   carrying its name), and that the page NAMES the company. A surface that has
   passed all three is, by definition, a first-party source.

   Without this, the bridge's output was locked out of the pipeline entirely:
   the 90-day sweep planned 179 surfaces and rejected 125 of them as
   SOURCE_NOT_WHITELISTED - every single surface of all 59 promoted accounts,
   including save.finance, sanctum.so, loopscale.com, astralane.io and
   basis.markets. The bridge verified them with skipWhitelist, the scan refused
   them, and the two halves of the system could not talk to each other.

   Only hosts carrying a surface marked status:'verified' are admitted, and each
   records the account it was verified for, so provenance is still traceable. */
export const BRIDGE_VERIFIED_HOSTS = (() => {
  try {
    const added = JSON.parse(readFileSync('data/registry-additions.json', 'utf8'));
    const out = new Map();
    for (const a of (added.accounts || [])) {
      if (!a.surface_verified) continue;
      for (const sf of (a.surfaces || [])) {
        if (!sf.url || sf.status !== 'verified') continue;
        let h; try { h = new URL(sf.url).hostname.replace(/^www\./, ''); } catch { continue; }
        if (!out.has(h))
          out.set(h, { host: h, tier: 1, type: 'bridge_verified',
                       verified_for: a.name, basis: 'fetched, published by them, and names them' });
      }
    }
    return [...out.values()];
  } catch { return []; }
})();

export const isAssetListingQuote = (entity, quote) => {
  const name = String(entity || '').trim();
  const text = String(quote || '');
  if (name.length < 2 || !text) return false;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // The name sits in front of its ticker: "Fwog (FWOG) - Solana".
  if (new RegExp(`${esc}\\s*\\([A-Z0-9]{2,10}\\)`).test(text)) return true;
  // Or the model took the TICKER as the entity: "Tether USD (USDT) - Solana".
  // Only a bare ticker-shaped name can match, so "Kraken" is never caught by
  // a quote that happens to contain a parenthesised ticker elsewhere.
  return /^[A-Z0-9]{2,10}$/.test(name) && new RegExp(`\\w\\s*\\(${esc}\\)`).test(text);
};

// Another chain's name is not a Solana account. Same rule as the fork crawler's
// WRONG_CHAIN verdict, applied at the entity rather than the company.
export const OTHER_CHAIN_ENTITY =
  /^(stacks|hedera|dot network|polkadot|ethereum|eth\/erc20|evmsei|sei network|flare|dash|aerodrome|velodrome|polygon|avalanche|arbitrum|optimism|sui|aptos|tron|ripple|cardano|near protocol)\b/i;

export const isGenericEntity = name =>
  GENERIC_ENTITIES.includes(String(name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim());

// Every rejection carries one of these. Nothing is dropped silently.
export const REASON = {
  NO_SOURCE_URL:            'no source URL supplied',
  SOURCE_NOT_WHITELISTED:   'source host is not on the whitelist',
  SOURCE_UNREACHABLE:       'source URL did not fetch',
  QUOTE_NOT_IN_SOURCE:      'verbatim quote does not appear in the fetched page',
  DATE_OUT_OF_WINDOW:       'event date outside the requested window',
  DATE_UNVERIFIABLE:        'no event date could be established',
  NO_NAMED_ENTITY:          'no named legal entity',
  BLOCKED_ALIAS:            'matched the blocked name-collision list',
  NOT_SOLANA:               'no Solana activity evidenced',
  DUPLICATE:                'same entity and event already in this run',
  MODEL_RETURNED_NOTHING:   'agent returned no candidates',
  INFERENCE_FAILED:         'NEAR AI call failed (auth, quota, network or model error)',
  CLAIM_NOT_SUPPORTED:      'quote is real but does not support the claim made about it',
  REDIRECTED_OFF_WHITELIST: 'the URL redirected to a host that is not on the whitelist',
  DOCS_SURFACE_MISMATCH:    'a registry surface resolved to another company\'s documentation; content must not be attributed to this account',
  RESEARCH_BLOCKED:         'no readable first-party surface for this account',
  OUTPUT_TRUNCATED:         'agent ran out of output tokens before completing its JSON',
  MALFORMED_JSON:           'agent did not return parseable JSON'
};
