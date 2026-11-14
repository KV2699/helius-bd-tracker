// Motion classification from evidence already collected.
//
// The split that matters: CODE finds the evidence, the model only interprets
// excerpts that are already grounded, and CODE decides the classification from
// what was actually found. A model asked "is Backpack a Sender buyer?" will
// answer from the shape of the question. A model shown twelve verbatim excerpts
// and asked what they describe cannot invent a thirteenth.
import { fetchSource, shardText } from './fetch.js';
import { ICP, lookupICP } from './icp.js';
import { INFRA_ROLE } from './score.js';

// Signals, per motion. Each is a term we search for in the account's OWN pages.
// Generic wallet or payments language is deliberately in its own bucket: it is
// the main way a consumer app gets mistaken for an execution buyer.
// Terms that can ONLY mean Solana execution. No context needed.
const SENDER_INHERENT = [
  'transaction landing', 'land your transaction', 'landing rate', 'sendTransaction',
  'priority fee', 'compute unit price', 'setComputeUnitPrice', 'jito bundle', 'jito tip', 'block engine', 'tip account',
  'blockhash', 'keeper bot', 'jit maker', 'crank', 'dropped transaction'
];

// Terms that mean Solana execution ONLY in a Solana / on-chain context.
// Backpack's docs contain 35 instances of "liquidation" - every one of them a
// CEX margin liquidation handled internally, nothing to do with a keeper bot
// racing a transaction on-chain. Counting those made an exchange look like an
// execution buyer. Same failure mode as routing a Sonic outage as Solana.
const SENDER_CONTEXTUAL = [
  'send transaction', 'bundle', 'keeper', 'liquidation bot', 'liquidator',
  'market making', 'market maker', 'arbitrage', 'retry', 'failed transaction',
  'slot', 'latency', 'low-latency', 'execution engine', 'order matching'
];
const ONCHAIN_CONTEXT = /\b(solana|on-?chain|sol\b|spl|validator|rpc|program|wallet address|mainnet)\b/i;

export const SIGNALS = {
  SENDER: [...SENDER_INHERENT, ...SENDER_CONTEXTUAL],
  RPC_ENTERPRISE: [
    'rpc endpoint', 'rpc provider', 'rpc node', 'getProgramAccounts',
    'websocket subscription', 'websocket', 'rate limit', 'archival', 'validator',
    'node operator', 'dedicated node', 'geyser', 'yellowstone'
  ],
  DATA: [
    'webhook', 'indexer', 'indexing', 'historical data', 'data api',
    'enhanced transactions', 'parsed transaction'
  ],
  // Not a motion - a warning. If this dominates, the account is a consumer
  // product and the execution language above is probably incidental.
  CONSUMER: [
    'wallet', 'custody', 'self-custody', 'seed phrase', 'onramp', 'on-ramp',
    'buy crypto', 'payments', 'send and receive', 'portfolio', 'swap interface'
  ]
};

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Find every occurrence with enough context to be judged, and record WHERE.
export function findSignals(text, terms, { maxPer = 3, window = 160 } = {}) {
  const hits = [];
  for (const term of terms) {
    const re = new RegExp(`[^.]{0,${window}}\\b${esc(term)}\\b[^.]{0,${window}}`, 'gi');
    let m, found = 0;
    while ((m = re.exec(text)) && found < maxPer) {
      hits.push({ term, excerpt: m[0].replace(/\s+/g, ' ').trim().slice(0, 300) });
      found++;
    }
  }
  return hits;
}

export async function classifyAccount(name, { ai, onEvent = () => {} } = {}) {
  const say = (msg, extra = {}) => onEvent({ stage: 'classify', msg, ...extra });
  const acct = lookupICP(name) || ICP.find(a => a.name.toLowerCase() === String(name).toLowerCase());
  if (!acct) return { name, error: 'NOT_IN_REGISTRY' };

  const surfaces = (acct.surfaces || []).filter(s => s.status === 'verified');
  if (!surfaces.length) return { name: acct.name, error: 'NO_VERIFIED_SURFACE' };

  const perMotion = { AMBIGUOUS: [] }, sources = [];
  for (const k of Object.keys(SIGNALS)) perMotion[k] = [];

  // Legal boilerplate is not evidence. Zeta's terms-and-conditions is 46,230
  // characters - enough on its own to push the corpus past the "we read a lot
  // and found nothing" threshold and manufacture a confident NOT_SENDER.
  const LEGAL = /\/(legal|terms|privacy|cookie|disclaimer|location-restrictions)\b/i;
  for (const sf of surfaces) {
    if (LEGAL.test(sf.url)) { say(`${acct.name}: skipping ${sf.url} - legal boilerplate, not evidence`); continue; }
    const src = await fetchSource(sf.url, { skipWhitelist: true });
    if (!src.ok) { say(`${acct.name}: ${sf.url} did not fetch (${src.error})`); continue; }
    sources.push({ url: src.url, chars: src.pageText.length, kind: sf.kind });
    say(`${acct.name}: reading ${src.url} (${src.pageText.length} chars)`);
    for (const [motion, terms] of Object.entries(SIGNALS)) {
      for (const h of findSignals(src.pageText, terms)) {
        // A contextual term only counts with on-chain context in the excerpt.
        if (motion === 'SENDER' && !SENDER_INHERENT.includes(h.term) &&
            !ONCHAIN_CONTEXT.test(h.excerpt)) {
          perMotion.AMBIGUOUS.push({ ...h, url: src.url,
            why: 'term appears without any on-chain context - probably not Solana execution' });
          continue;
        }
        perMotion[motion].push({ ...h, url: src.url });
      }
    }
  }

  // Deduplicate by excerpt - a term repeated in a nav bar is one piece of
  // evidence, not forty.
  for (const k of Object.keys(perMotion)) {
    const seen = new Set();
    perMotion[k] = perMotion[k].filter(h => {
      const key = h.excerpt.slice(0, 80).toLowerCase();
      if (seen.has(key)) return false; seen.add(key); return true;
    });
  }

  const counts = Object.fromEntries(Object.entries(perMotion).map(([k, v]) => [k, v.length]));
  const distinctTerms = Object.fromEntries(
    Object.entries(perMotion).map(([k, v]) => [k, new Set(v.map(h => h.term)).size]));

  // THE DECISION IS CODE. A motion needs distinct terms, not one word repeated,
  // and it has to beat the consumer signal rather than merely appear beside it.
  const corpus = sources.reduce((a, s) => a + s.chars, 0);
  // An INHERENT term is worth more than a contextual one. "priority fee" and
  // "crank" can only mean Solana execution; "rpc" and "validator" appear in any
  // chain's documentation. Counting them equally made Zeta - which ships
  // updatePriorityFee() and crank instructions - read as an RPC account.
  const inherentHits = new Set(perMotion.SENDER.filter(h => SENDER_INHERENT.includes(h.term)).map(h => h.term));
  const verdict = decide(counts, distinctTerms, corpus, inherentHits);

  let interpretation = null;
  if (ai && (perMotion.SENDER.length || perMotion.RPC_ENTERPRISE.length)) {
    const ev = [...perMotion.SENDER.slice(0, 12), ...perMotion.RPC_ENTERPRISE.slice(0, 8)]
      .map((h, i) => `${i + 1}. [${h.term}] "${h.excerpt}"`).join('\n');
    try {
      const out = await ai.json('classify', {
        system: `You are classifying ONE company's product motion for Helius BD.

You will be shown VERBATIM excerpts taken from the company's own pages. Judge ONLY these.
Do not use anything you know about the company. Do not infer from the company's name.

Decide which is true of THIS company, from the excerpts alone:
 - "operates"  : the company itself runs the automation / submits the transactions
 - "documents" : the company documents these things for OTHER people to run
 - "mentions"  : the words appear but describe something else entirely
 - "sells"     : the company SELLS this capability to others (it is a competitor)

Return STRICT JSON:
{"relation":"operates|documents|mentions|sells",
 "what":"one sentence on what the excerpts actually describe",
 "strongest_excerpt":"the single most telling excerpt, copied verbatim",
 "owner_named":true|false,
 "owner_evidence":"verbatim span naming an infrastructure role, or null"}

Returning "mentions" is a correct and common answer. Do not upgrade it.`,
        user: `COMPANY: ${acct.name}\n\nEXCERPTS FROM THEIR OWN PAGES:\n${ev}`,
        maxTokens: 1200
      });
      interpretation = out.parsed || null;
      // The model said owner_named: true with the evidence "exchange". A role
      // test in code, not the model's word - the same rule the gate uses.
      if (interpretation?.owner_named &&
          !INFRA_ROLE.test(String(interpretation.owner_evidence || ''))) {
        interpretation.owner_named = false;
        interpretation.owner_rejected = `"${interpretation.owner_evidence}" names no infrastructure role`;
        interpretation.owner_evidence = null;
      }
    } catch (e) { say(`${acct.name}: interpretation failed (${e.code || e.message})`); }
  }

  return {
    name: acct.name, currentRelationship: acct.rel, currentTier: acct.tier,
    sources, counts, distinctTerms, verdict, interpretation,
    evidence: {
      SENDER: perMotion.SENDER.slice(0, 10),
      RPC_ENTERPRISE: perMotion.RPC_ENTERPRISE.slice(0, 6),
      DATA: perMotion.DATA.slice(0, 4),
      CONSUMER: perMotion.CONSUMER.slice(0, 4),
      AMBIGUOUS: perMotion.AMBIGUOUS.slice(0, 6)
    },
    classifiedAt: new Date().toISOString().slice(0, 10)
  };
}

// Pure code. Thresholds are deliberately blunt: one term appearing once is
// noise, and consumer language outweighing execution language means the
// execution words are incidental.
function decide(counts, distinct, corpus = 0, inherent = new Set()) {
  const reasons = [];
  const sender = distinct.SENDER, rpc = distinct.RPC_ENTERPRISE, consumer = distinct.CONSUMER;

  if (sender < 3 && rpc < 3) {
    // "We found nothing" and "we read nothing" are different answers, and the
    // first version returned the same verdict for both. Backpack: 387,000
    // characters of API reference with zero grounded Sender terms - that is a
    // confident NO. Zeta: 2,799 characters of navigation - that is not an
    // answer at all.
    if (corpus < 20000) {
      reasons.push(`Only ${corpus.toLocaleString()} characters were readable across all verified surfaces.`);
      reasons.push('That is too little to classify. This is a missing corpus, not an absent signal.');
      return { motion: 'INSUFFICIENT_EVIDENCE', confidence: 'none', reasons };
    }
    reasons.push(`${corpus.toLocaleString()} characters read across the account's own surfaces.`);
    reasons.push(`Zero grounded Sender terms and ${rpc} RPC term(s) in all of it.`);
    reasons.push('A corpus this size with no execution language is evidence of absence, not absence of evidence.');
    return { motion: 'NOT_SENDER', confidence: corpus > 100000 ? 'high' : 'medium', reasons };
  }
  if (consumer >= sender && consumer >= rpc) {
    reasons.push(`Consumer language (${consumer} distinct terms) outweighs execution language (${sender} Sender, ${rpc} RPC).`);
    reasons.push('A wallet or payments product is not an execution buyer.');
    return { motion: 'NOT_SENDER', confidence: 'medium', reasons };
  }
  // Two or more unambiguous Solana-execution terms outrank any amount of
  // generic infrastructure vocabulary.
  if (inherent.size >= 2) {
    reasons.push(`${inherent.size} unambiguous Solana-execution term(s): ${[...inherent].join(', ')}.`);
    reasons.push('These cannot mean anything but transaction landing on Solana.');
    return { motion: 'SENDER_CANDIDATE', confidence: inherent.size >= 4 ? 'high' : 'medium', reasons };
  }
  if (sender >= rpc && sender >= 4) {
    reasons.push(`${sender} distinct Sender terms across ${counts.SENDER} grounded excerpt(s).`);
    return { motion: 'SENDER_CANDIDATE', confidence: sender >= 7 ? 'high' : 'medium', reasons };
  }
  reasons.push(`${rpc} distinct RPC/infrastructure terms, ${sender} Sender terms - the evidence is about nodes, not landing.`);
  return { motion: 'RPC_ENTERPRISE', confidence: 'medium', reasons };
}
