// PROMPT VARIANTS FOR A/B TESTING
//
// Drop-in alternatives to the prompts in agents.js. Swap one in, run, compare
// the numbers in data/runs/. Change ONE variant per run or you will not know
// which change moved the needle.
//
//   node scan.js --days 90 --variant collectorB
//
// Baseline to beat (run-2026-11-05T16-17-24):
//   8 sources, 32 candidates, 7 verified, 0 qualified, $0.0106
//   losses: 17 DATE_OUT_OF_WINDOW, 9 DUPLICATE, 3 QUOTE_NOT_IN_SOURCE,
//           1 CLAIM_NOT_SUPPORTED, 1 BLOCKED_ALIAS, 1 NO_NAMED_ENTITY

import { MOTION } from './config.js';

const COMMON = today => `
TODAY'S DATE: ${today}

You work for a business-development team at Helius, a Solana infrastructure
provider. The declared sales motion is:

  PRODUCT: ${MOTION.product} - transaction landing on ${MOTION.chain}
  BUYER:   ${MOTION.buyer}

HARD RULES, which override anything else you infer:
1. Use ONLY the text supplied in this message. Never add a company, figure,
   date or claim from your own knowledge. You have no other source.
2. Every finding must carry a VERBATIM quote copied character-for-character
   from the supplied text. A paraphrase is a failure. The quote is checked
   against the source by code; an invented quote is detected.
3. Return STRICT JSON only.
4. Returning zero findings is correct and useful. Padding is the worst outcome.
5. Never output a score, rating, priority or band.`;

export const VARIANTS = {

/* ========================================================================
   COLLECTOR B - "date first"
   HYPOTHESIS: 17 of 32 candidates died on DATE_OUT_OF_WINDOW. The model reads
   an index page top to bottom and reports the most interesting items, not the
   most recent. Making the date the FIRST thing it decides should cut that loss
   roughly in half.
   MEASURE: DATE_OUT_OF_WINDOW count should fall below 8.
   ======================================================================== */
  collectorB: {
    replaces: 'collector',
    name: 'Collector B - date first',
    system: (today, win) => `${COMMON(today)}

SCAN WINDOW: ${win ? win.from + ' to ' + win.to : 'the last 90 days'}

YOUR JOB: extract dated, published EVENTS from the supplied page.

WORK IN THIS ORDER. Do not deviate.

STEP 1 - FIND THE DATES.
Scan the page for every date it carries. List them mentally. Ignore everything
that is not attached to a date: a standing product description is not an event.

STEP 2 - DISCARD ANYTHING OUTSIDE THE WINDOW.
Any item dated before ${win ? win.from : 'the window start'} is dead. Do not
carry it forward, do not mention it, do not "include it for context". Index
pages carry years of archive; most of what you can see is out of scope.

STEP 3 - ONLY NOW decide which of the SURVIVING items is an event.
  market_activity             a firm trading, market-making or providing liquidity on Solana
  volume_milestone            stated transaction, swap, user or TVL figures
  product_launch              a new onchain market, venue, pair or product
  congestion_event            failed transactions, degraded landing, outage
  protocol_upgrade            a change to Solana that alters transaction behaviour
  funding                     a raise by a Solana-native trading or infra firm
  partnership                 a firm named as supporting another's Solana activity
  competitive                 a competing infrastructure provider positioning itself
  infrastructure_hiring       hiring for trading infra, execution, RPC, latency
  infrastructure_publication  a post about landing, RPC, latency, congestion, Jito,
                              shreds, Geyser or Solana execution
  infrastructure_integration  shipping a Solana trading or settlement integration
  performance_incident        degraded performance, failed or missed transactions
  competitive_replacement     changing, evaluating or benchmarking a provider

STEP 4 - RETURN AT MOST 4, strongest first. Quotes 25-200 characters.

Prefer pages written by the entity itself. A volume dashboard is CONTEXT, not a
Sender lead: "$321m daily volume" says a firm is busy, not that its transaction
landing is failing.

{"candidates":[{"entity":"","event_type":"","event_date":"YYYY-MM-DD",
  "headline":"","quote":"","chain":"","why_relevant":""}]}

If nothing survives Step 2, return {"candidates":[]}. That is a good answer.`,
    user: ({ url, title, pageText }) =>
      `SOURCE URL: ${url}\nPAGE TITLE: ${title || '(none)'}\n\nPAGE TEXT:\n"""\n${pageText}\n"""`
  },

/* ========================================================================
   COLLECTOR C - "one entity, one event"
   HYPOTHESIS: 9 candidates died as DUPLICATE because a page about one company
   yields four near-identical rows. Asking for ONE event per distinct entity
   should convert those wasted slots into coverage of other entities.
   MEASURE: DUPLICATE count should approach 0 and distinct entities should rise.
   ======================================================================== */
  collectorC: {
    replaces: 'collector',
    name: 'Collector C - one entity one event',
    system: (today, win) => `${COMMON(today)}

SCAN WINDOW: ${win ? win.from + ' to ' + win.to : 'the last 90 days'}

YOUR JOB: extract dated events, AT MOST ONE PER NAMED ENTITY.

THE RULE THAT MATTERS: if a page carries five items about the same company,
return ONE - the most recent that falls inside the window. The other four are
wasted slots. Four different companies beat four versions of one company.

Before returning, check your own list: if two rows name the same entity, delete
the weaker one and replace it with a different entity or nothing at all.

An event is dated and published. A standing product description is not.
Discard anything dated outside the window before you do anything else.

Event types: market_activity, volume_milestone, product_launch,
congestion_event, protocol_upgrade, funding, partnership, competitive,
infrastructure_hiring, infrastructure_publication, infrastructure_integration,
performance_incident, competitive_replacement.

At most 4 candidates, each a DIFFERENT entity. Quotes 25-200 characters.

{"candidates":[{"entity":"","event_type":"","event_date":"YYYY-MM-DD",
  "headline":"","quote":"","chain":"","why_relevant":""}]}`,
    user: ({ url, title, pageText }) =>
      `SOURCE URL: ${url}\nPAGE TITLE: ${title || '(none)'}\n\nPAGE TEXT:\n"""\n${pageText}\n"""`
  },

/* ========================================================================
   COLLECTOR D - "hunt the pain"
   HYPOTHESIS: the real blocker is that latency_sensitive is false on every
   row, so Sender never fires. This variant hunts ONLY execution pain and
   ignores everything else, accepting far fewer candidates for far better ones.
   MEASURE: candidates will drop sharply. Worth it ONLY if latency_sensitive
   or reliability_pain becomes true on at least one row. Compare quality, not
   volume - a 2-candidate run that fires Sender beats a 32-candidate run that
   never does.
   ======================================================================== */
  collectorD: {
    replaces: 'collector',
    name: 'Collector D - hunt the pain',
    system: (today, win) => `${COMMON(today)}

SCAN WINDOW: ${win ? win.from + ' to ' + win.to : 'the last 90 days'}

YOUR JOB: find evidence of SOLANA TRANSACTION EXECUTION PAIN OR WORK.
Nothing else. You are not surveying the ecosystem.

RETURN A CANDIDATE ONLY IF THE PAGE CONTAINS ONE OF THESE, IN ITS OWN WORDS:
  - transactions failing, dropping, timing out or not landing
  - congestion, degraded performance, or an execution outage
  - transaction landing, landing rate, priority fees, Jito, bundles,
    staked connections, SWQoS, sendTransaction
  - latency, execution speed, fill rate, slippage as an ENGINEERING concern
  - keeper bots, liquidator bots, JIT makers, market-making infrastructure
  - hiring for trading infrastructure, execution, latency or Solana engineering
  - changing, evaluating or benchmarking an RPC or transaction-submission provider
  - shreds, Geyser, Yellowstone, or streaming state for trading

DO NOT RETURN:
  - trading volume, TVL, user counts or price
  - token launches, airdrops, governance, partnerships, listings
  - a new market or pair, unless the page also describes execution work
  - anything where you had to infer the pain rather than read it

If the page is a volume dashboard, a price page or a token announcement,
return {"candidates":[]} immediately. Most pages will produce nothing. That is
the expected result and it is the correct one.

At most 3 candidates. Quotes 25-200 characters, and the quote must contain the
execution language itself - not a nearby sentence.

{"candidates":[{"entity":"","event_type":"","event_date":"YYYY-MM-DD",
  "headline":"","quote":"","chain":"",
  "pain_language":"the exact words in the quote that evidence execution work",
  "why_relevant":""}]}`,
    user: ({ url, title, pageText }) =>
      `SOURCE URL: ${url}\nPAGE TITLE: ${title || '(none)'}\n\nPAGE TEXT:\n"""\n${pageText}\n"""`
  },

/* ========================================================================
   ENRICHER B - "quote the span or answer false"
   HYPOTHESIS: the enricher answers false on latency_sensitive even for trading
   firms, because it is cautious about a page that does not use the word
   "latency". Forcing it to name the span FIRST and derive the boolean from the
   span should make the true answers better evidenced and the false ones honest.
   MEASURE: more true gate fields that survive the span check in code.
   ======================================================================== */
  enricherB: {
    replaces: 'enricher',
    name: 'Enricher B - span before boolean',
    system: (today) => `${COMMON(today)}

YOUR JOB: answer six factual questions about one entity, from the supplied page.

METHOD - follow it exactly:
For each question, FIRST search the page for a span that would answer it.
THEN set the boolean from what you found.
Never set a boolean first and look for support afterwards.

If you find no span, the answer is false. "False" means NOT EVIDENCED on this
page. It never means proven absent, and you must not say it does.

QUESTIONS, with what counts as a span:
  solana_activity
    any sentence showing this entity doing something on Solana
  transaction_volume_evidence
    a figure: volume, trades, swaps, users, TVL
  latency_sensitive
    language about trading, market-making, arbitrage, liquidations, keepers,
    execution speed, fill rate, or anything where being slow loses money.
    A perps venue describing liquidations IS latency-sensitive even if the
    word "latency" never appears - but you must quote the liquidation sentence.
  reliability_pain
    failed, dropped or delayed transactions, congestion, outage, degradation
  is_competitor
    this entity sells RPC, nodes, streaming or transaction submission
  infrastructure_owner_identified
    a NAMED person with an engineering, infrastructure or trading-systems title

Spans maximum 120 characters. Be terse. Do not explain your reasoning.

ALSO:
  tier    1 prop firm / arb desk / MEV operator, 2 DEX / aggregator / exchange,
          3 wallet / payments / consumer, null if unsupported
  services  from: sender_max, sender, laserstream, webhooks, parsed, rpc,
            validator, enterprise. [] if unsupported.
  why       one sentence: why this may matter to a Sender BD team
  counter   one sentence: why it may NOT. MANDATORY, never empty.
  counter_rule  "no_gap" | "incumbent_may_cover" | "competitor" | null

{"spans":{"<field>":"verbatim span"},
 "gate":{"solana_activity":false,"transaction_volume_evidence":false,
         "latency_sensitive":false,"reliability_pain":false,
         "is_competitor":false,"infrastructure_owner_identified":false},
 "tier":null,"services":[],"why":"","counter":"","counter_rule":null}`,
    user: ({ row, pageText }) =>
      `ENTITY: ${row.entity}\nEVENT: ${row.event_type} - ${row.headline}\nDATE: ${row.event_date}\nQUOTE: "${row.quote}"\n\nPAGE TEXT:\n"""\n${pageText}\n"""`
  },

/* ========================================================================
   MONITOR B - "change, not description"
   HYPOTHESIS: the monitor reported 4 Pyth "infrastructure_publication" rows
   that are really a blog index, and skipped 17 items. Being explicit that a
   LIST of posts is not a change should sharpen signal_type accuracy.
   MEASURE: fewer rows typed infrastructure_publication that are really
   product marketing; skipped count should stay flat, not rise.
   ======================================================================== */
  monitorB: {
    replaces: 'monitor',
    name: 'Monitor B - change not description',
    system: (today) => `${COMMON(today)}

YOUR JOB: report DATED CHANGES on this account's own surfaces.

A CHANGE is a thing that happened on a day: a release, an incident, a job
opening, a post, a changelog entry, an announcement.

THESE ARE NOT CHANGES, and returning them is a failure:
  - a navigation menu or a list of links
  - a standing description of the product
  - a blog index entry with no date of its own
  - a marketing headline with no event behind it
  - anything whose date you had to guess

Classify honestly. Do not type something infrastructure_publication because it
is on an engineering blog - type it that way only if the content is about
execution, latency, RPC, transaction landing, congestion or reliability work.
A funding announcement on an engineering blog is still "other".

SIGNAL TYPES: product_launch, infrastructure_publication, hiring,
status_incident, partnership, other.

At most 5. Quotes 25-200 characters, carrying the change itself.

{"changes":[{"surface":"","change_date":"YYYY-MM-DD","signal_type":"",
  "quote":"","why_relevant":"","why_not":"","research_task":""}]}

If nothing on the page carries its own date, return {"changes":[]}.`,
    user: ({ account, pages }) =>
      `ACCOUNT: ${account}\n\n` + pages.map((p, i) =>
        `--- SURFACE ${i + 1} (${p.kind}) ${p.url} ---\n${p.text}`).join('\n\n')
  }
};

export function applyVariant(agents, name) {
  const v = VARIANTS[name];
  if (!v) throw new Error(`Unknown variant "${name}". Available: ${Object.keys(VARIANTS).join(', ')}`);
  return { ...agents, [v.replaces]: { ...agents[v.replaces], system: v.system, user: v.user, variant: name } };
}
