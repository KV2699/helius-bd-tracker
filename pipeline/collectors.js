// Targeted collectors.
//
// The single collector carried FOURTEEN event types and a cap of six
// candidates, so the model had to choose six winners across fourteen competing
// categories on every read. A page describing a keeper bot, an outage and a
// funding round in the same window returned whichever three the model liked.
//
// Five narrow collectors each get their own six-candidate budget. A prompt that
// is only looking for execution evidence does not have to weigh it against
// hiring news. Same grounding, same date rules, same window - more recall per
// page, because nothing has to lose.
import { AGENTS } from './agents.js';

const SHARED = (today, window) => `TODAY IS ${today}.
WINDOW: ${window.from} to ${window.to}. An event dated outside it is rejected in code.

HARD RULES, identical for every collector:
1. The quote must be a VERBATIM span copied from the page below, 25-200
   characters. Code searches the page for it after you answer; an invented
   quote is detected and the candidate is destroyed.
2. event_date must be a date PRINTED IN THE PAGE. Never infer one, never use
   today's date. An undated story is not an event.
3. Return STRICT JSON only. No prose, no markdown.
4. Returning zero candidates is a correct and common answer. Padding the list
   is the worst outcome - a wrong candidate costs more than a missed one.
5. Never output a score, rating or priority. Numbers are computed in code.
6. At most 6 candidates. You are reading ONE WINDOW of one page and only ONE
   KIND of signal - other kinds are collected separately, so do not reach.

Return JSON exactly:
{"candidates":[{
  "entity":"legal or trading name, as written in the page",
  "event_type":"<one of this collector's types>",
  "event_date":"YYYY-MM-DD as printed, or null only where this collector allows it",
  "headline":"one factual sentence under 100 characters",
  "quote":"VERBATIM span, 25-200 chars",
  "chain":"Solana | multi-chain | other",
  "why_relevant":"one sentence on why a Helius BD team would read this"
}]}`;

export const COLLECTORS = {
  // 1. Does this company move transactions, and does it struggle to?
  execution: {
    id: 'collector:execution', name: 'Execution', motion: 'sender',
    system: (today, window) => `You collect EXECUTION evidence for Helius BD. ${SHARED(today, window)}

LOOK ONLY FOR: how a company gets transactions onto Solana, and what that costs it.

TYPES:
  landing_pain       failed, dropped or delayed transactions; congestion; retries
  execution_config   priority fees, compute budget, blockhash handling, send paths
  bundle_usage       Jito bundles, tips, block engine, staked connections, shreds
  automation         keeper bots, liquidators, JIT makers, cranks, order triggers,
                     market-making or arbitrage systems the company RUNS
  standing_condition the company's OWN docs describing how its execution works or
                     what its operators must watch. No date - use event_date: null.
                     Only on a company's own docs, never on a news story.

IGNORE: funding, hiring, partnerships, product launches, volume figures, data
and indexing. Other collectors have those. A page with none of the above
returns {"candidates":[]} and that is the right answer.` },

  // 2. What does it read from the chain, and how?
  infrastructure: {
    id: 'collector:infrastructure', name: 'Infrastructure', motion: 'rpc',
    system: (today, window) => `You collect INFRASTRUCTURE evidence for Helius BD. ${SHARED(today, window)}

LOOK ONLY FOR: how a company READS Solana, and the limits it hits doing so.

TYPES:
  rpc_dependency     RPC endpoints, providers, node operations, rate limits, credits
  stream_dependency  websockets, gRPC, Geyser, Yellowstone, account or slot updates
  data_dependency    indexing, parsed or decoded transactions, webhooks, archival
  capacity_limit     a stated limit, quota, throttle or tier that constrains them
  standing_condition their OWN docs describing the read path. event_date: null.

IGNORE: transaction sending, priority fees, Jito, keeper bots - the execution
collector has those. Ignore funding, hiring and launches. Empty is correct when
the page says nothing about reading the chain.` },

  // 3. Something broke, and they said so.
  incident: {
    id: 'collector:incident', name: 'Incident', motion: 'any',
    system: (today, window) => `You collect INCIDENTS for Helius BD. ${SHARED(today, window)}

LOOK ONLY FOR: a company reporting that something degraded, failed or was delayed.

TYPES:
  outage             a service, network or component unavailable
  degradation        slow, delayed, backlogged or partially failing
  postmortem         a published account of a past failure and its cause
  maintenance        planned downtime that reveals the stack

CRITICAL: record WHICH CHAIN OR SERVICE the incident is about, in the quote. An
incident on another chain is not a Solana signal, and code checks this. Do not
summarise a Solana incident from a page about a different network.

Status pages list many incidents - return the SIX most relevant to Solana, or
to the company's own trading or settlement path. IGNORE funding, hiring,
launches, docs.` },

  // 4. Why now - the dated commercial trigger.
  commercial: {
    id: 'collector:commercial', name: 'Commercial', motion: 'any',
    system: (today, window) => `You collect COMMERCIAL triggers for Helius BD. ${SHARED(today, window)}

LOOK ONLY FOR: dated events that change a company's capacity or urgency.

TYPES:
  funding            a raise, round, grant or strategic investment, with the amount
  partnership        a named integration, listing or commercial agreement
  product_launch     a new market, venue, pair, product or mainnet go-live
  volume_milestone   stated transaction, swap, user, TVL or volume figures
  regulatory         a filing, licence, approval or compliance milestone

These must be DATED. There is no standing-condition option here: a company's
general description of itself is not a trigger. IGNORE docs, RPC, execution and
hiring.` },

  // 5. Who they are paying to build it - a route as well as a signal.
  hiring: {
    id: 'collector:hiring', name: 'Hiring', motion: 'any',
    system: (today, window) => `You collect HIRING signals for Helius BD. ${SHARED(today, window)}

LOOK ONLY FOR: roles a company is advertising that reveal what it is building.

TYPES:
  infra_role         infrastructure, platform, SRE, DevOps, node or reliability
  execution_role     trading systems, execution, latency, market-making engineering
  protocol_role      Solana / protocol / smart-contract engineering
  data_role          data, indexing, streaming or analytics engineering
  leadership_role    CTO, Head of Engineering, Head of Infrastructure

Capture the ROLE TITLE in the quote - a title is the evidence here. If the
posting states a closing date use it; otherwise use the posting date. If neither
is printed, return null and code will reject it.

IGNORE everything that is not a role being advertised.` },
};

// The same user message for all of them - one window of one page.
export const collectorUser = AGENTS.collector.user;

export const COLLECTOR_KEYS = Object.keys(COLLECTORS);
