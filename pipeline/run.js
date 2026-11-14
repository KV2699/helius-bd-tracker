// The orchestrator. Six stages, in sequence, with a reason code on every
// rejection and a ledger line on every model call.
//
//   1 Collector  (NEAR AI)  find dated events in a fetched page
//   2 Verifier   (code+AI)  grounding in code, claim-support by model
//   3 Enricher   (NEAR AI)  gate fields, each with a supporting span
//   4 Scorer     (code)     the rubric
//   5 Gate       (code)     caps and the counter-rationale veto
//   6 Writer     (NEAR AI)  internal brief - never outreach
//
// Stages 4 and 5 have no model by design.

import { writeFile, mkdir } from 'node:fs/promises';
import { NEAR, REASON } from './config.js';
import { NearAI, Ledger, loadPrices } from './near.js';
import { AGENTS as BASE_AGENTS } from './agents.js';
import { applyVariant } from './prompts-v2.js';
import { fetchSource, shardText } from './fetch.js';
import { verifyCandidate, quoteIsGrounded } from './verify.js';
import { sourceTypeOf } from './config.js';
import { COLLECTORS, COLLECTOR_KEYS } from './collectors.js';
import { assess, servicesFor, PRIMARY_LENS, rubricFor } from './score.js';
import { lookupICP, productFitPoints, routeMotion, isProspectable, GRADE_BY_SURFACE } from './icp.js';

const today = () => new Date().toISOString().slice(0, 10);

export async function runScan({ urls, window, budgetUsd = 2.0, variant = null, collectors = null, deep = false, onEvent = () => {} }) {
  const AGENTS = variant ? applyVariant(BASE_AGENTS, variant) : BASE_AGENTS;
  // Tag the run with its window so a batch is identifiable on disk without
  // opening it. Batches must never collide or overwrite each other.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runId = window?.from && window?.to
    ? `run-${window.from}_to_${window.to}-${stamp}`
    : `run-${stamp}`;
  const ledger = new Ledger(runId, budgetUsd);
  const ai = new NearAI(ledger);          // throws immediately if no key
  await loadPrices();                     // cost comes from NEAR's own price list
  const T = today();

  const rejected = [];
  const verified = [];
  const seen = new Set();
  const fetched = [];
  const log = [];

  const say = (stage, msg, extra) => {
    const e = { t: new Date().toISOString(), stage, msg, ...extra };
    log.push(e); onEvent(e);
  };

  const reject = (stage, r) => {
    rejected.push({ stage, reason: r.reason, message: r.message || REASON[r.reason], detail: r.detail ?? null,
                    entity: r.candidate?.entity ?? r.entity ?? null, source_url: r.candidate?.source_url ?? r.source_url ?? null });
    say(stage, `rejected: ${r.reason}`, { entity: r.candidate?.entity ?? r.entity ?? null });
  };

  /* ---- 1. COLLECT ---------------------------------------------------- */
  say('collector', `fetching ${urls.length} whitelisted sources`);
  // `urls` may be bare strings or sourcePlan() entries carrying the surface's
  // owner and type. The type travels with the row so the scorer can cap it.
  for (const entry of urls) {
    const plan = typeof entry === 'string' ? { url: entry } : entry;
    const url = plan.url;
    const src = await fetchSource(url);
    if (!src.ok) { reject('collector', { reason: 'SOURCE_UNREACHABLE', detail: `${url} (${src.error})`, source_url: url }); continue; }
    fetched.push({ url: src.url, title: src.title, chars: src.pageText.length,
                   source_type: plan.source_type || null, account: plan.account || null });
    say('collector', `fetched ${src.url} (${src.pageText.length} chars)`);

    // SHARDED COLLECTION. One 14,000-character slice per page was throwing away
    // 89% of status.kraken.com, and the four-candidate cap was binding on most
    // pages. Each window now gets its own budget, and grounding still runs
    // against the WHOLE page, never the window.
    const shards = shardText(src.pageText);
    if (shards.length > 1)
      say('collector', `${src.pageText.length} chars -> ${shards.length} window(s)` +
          (shards.truncatedShards ? `, ${shards.truncatedShards} beyond the budget` : ''));

    // TARGETED COLLECTORS. One prompt carrying fourteen event types and a cap
    // of six made the model pick six winners across fourteen competing
    // categories on every read. Each narrow collector gets its own budget, so
    // execution evidence never has to lose to a funding round on the same page.
    // ROUTE BY SOURCE TYPE. The A/B test said targeted collectors cost 95% more
    // and returned 15% FEWER distinct real companies - because a narrow prompt
    // told to find one thing and allowed six reaches harder into whatever the
    // page holds, and on an exchange listing table that means fifteen rows of
    // token tickers. The broad fourteen-category prompt was acting as a
    // relevance filter.
    //
    // So: targeted collectors on FIRST-PARTY surfaces, where the extra recall
    // found the dpi-keepers repos. The single broad prompt on market-context
    // and directory pages, where it keeps the noise out.
    // MEASURED, not assumed. Three runs over the same window and the same 29
    // sources:
    //   broad only                 60 rows, 33 distinct companies, $0.1250
    //   targeted everywhere        78 rows, 28 distinct, 25 token-ticker rows, $0.2434
    //   targeted + routing+filters 52 rows, 30 distinct, 0 noise, $0.2170
    //
    // The mechanism: a narrow collector capped at six returns its six best
    // signals WITHIN ONE CATEGORY, which are often six quotes from the same
    // company's docs. The broad prompt returns its six best across the whole
    // page, which spreads across more companies. Targeted collectors buy
    // evidence DEPTH per account and cost company BREADTH.
    //
    // So discovery stays broad by default. Targeted passes are for qualifying
    // an account you already hold, deeply - which is how dpi-keepers surfaced.
    const firstParty = plan.source_type === 'buyer_owned' || plan.source_type === 'technical_ecosystem';
    const useTargeted = collectors && firstParty && (deep || plan.account);
    const passes = useTargeted
      ? collectors.map(k => ({ key: k, agent: COLLECTORS[k] })).filter(x => x.agent)
      : [{ key: 'all', agent: null }];
    if (collectors && !useTargeted)
      say('collector', `${src.url}: broad prompt (targeted passes cost 74% more and return fewer distinct companies)`);

    const cands = [];
    for (const sh of shards) {
      for (const pass of passes) {
        let out;
        try {
          out = await ai.json(pass.agent ? pass.agent.id : 'collector', {
            system: pass.agent ? pass.agent.system(T, window) : AGENTS.collector.system(T, window),
            user: AGENTS.collector.user({ url: src.url, title: src.title, pageText: sh.text,
                                          shard: sh.of > 1 ? { i: sh.i + 1, of: sh.of } : null }),
            model: NEAR.models.light, maxTokens: 6000
          });
        } catch (e) {
          reject('collector', { reason: e.code || 'MALFORMED_JSON',
                                detail: `${url} [${pass.key} ${sh.i + 1}/${sh.of}]: ${e.message}` });
          continue;
        }
        const got = Array.isArray(out.parsed?.candidates) ? out.parsed.candidates : [];
        for (const c of got) cands.push({ ...c, _collector: pass.key });
        if (ledger && ledger.overBudget?.()) {
          say('collector', `budget reached during ${pass.key}, window ${sh.i + 1}/${sh.of}`);
          break;
        }
      }
      if (ledger && ledger.overBudget?.()) break;
    }
    say('collector', `${cands.length} candidate(s) from ${src.url}` +
        (shards.length > 1 ? ` across ${shards.length} window(s)` : ''));
    if (!cands.length) continue;

    /* ---- 2a. VERIFY IN CODE (grounding) ------------------------------ */
    for (const c of cands) {
      // Only a first-party surface may contribute a standing condition. A news
      // site with no date is just an undated news story.
      const allowStanding = plan.source_type === 'buyer_owned' ||
                            plan.source_type === 'technical_ecosystem';
      const v = verifyCandidate(c, { pageText: src.pageText, sourceUrl: src.url, window, seen, allowStanding });
      if (!v.ok) { reject('verifier', v); continue; }
      v.row._modelText = src.modelText;
      v.row._pageText = src.pageText;
      v.row.why_relevant = c.why_relevant || '';
      v.row.source_type = plan.source_type || sourceTypeOf(v.row.source_kind);
      v.row.collector = c._collector || 'all';
      v.row.surface_owner = plan.account || null;
      verified.push(v.row);
      say('verifier', `grounded: ${v.row.entity}`, { entity: v.row.entity });
    }
  }

  if (!verified.length) {
    say('verifier', 'no candidate survived grounding - returning an empty run');
    return finish();
  }

  /* ---- 2b. VERIFY WITH THE MODEL (claim support) --------------------- */
  let supported = verified;
  try {
    const out = await ai.json('verifier', {
      system: AGENTS.verifier.system(T),
      user: AGENTS.verifier.user({ rows: verified }),
      model: NEAR.models.light, maxTokens: 6000
    });
    const verdicts = Array.isArray(out.parsed?.verdicts) ? out.parsed.verdicts : [];
    supported = verified.filter((row, i) => {
      const v = verdicts[i];
      if (v && v.supported === false) {
        reject('verifier', { reason: 'CLAIM_NOT_SUPPORTED', entity: row.entity, source_url: row.source_url,
                             detail: (v.reason || 'the quote does not support the claim made about it').trim() });
        return false;
      }
      if (v?.corrected_event_type) row.event_type = v.corrected_event_type;
      return true;
    });
  } catch (e) {
    say('verifier', `model verification unavailable (${e.message}); code grounding stands`);
  }

  /* ---- 2.5 BUYER DISCOVERY -------------------------------------------
     The entity's OWN surfaces decide ICP membership. An entity not in the
     registry is "unknown" - a research task, not a lead. We never guess a URL
     to find out.                                                            */
  const discovered = [];
  for (const row of supported) {
    const hit = lookupICP(row.entity);
    // Relationship gate FIRST. A competitor never reaches Buyer Discovery, and
    // never costs a model call.
    if (hit && !isProspectable(hit.rel)) {
      row.relationship = hit.rel;
      row.discovery = { is_sender_icp:'false', sender_fit:'none', icp_tier:null, evidence:[], surfaces:[],
        counter: hit.note || `${hit.name} is classified ${hit.rel}, not a prospect.`, counter_rule:'competitor' };
      say('discovery', `${row.entity}: ${hit.rel} - gated out before Buyer Discovery`, { entity: row.entity });
      discovered.push(row);
      continue;
    }
    if (hit && hit.blocked) {
      row.relationship = hit.rel;
      row.discovery = { is_sender_icp:'unknown', sender_fit:'none', icp_tier:hit.tier, evidence:[], surfaces:[],
        counter: hit.note || 'No fetchable first-party surface.', counter_rule:'no_gap', research_blocked:true };
      say('discovery', `${row.entity}: RESEARCH_BLOCKED - ${hit.note || 'no fetchable surface'}`, { entity: row.entity });
      discovered.push(row);
      continue;
    }
    if (!hit) {
      row.discovery = { is_sender_icp:'unknown', sender_fit:'none', icp_tier:null,
        evidence:[], counter:'Entity is not in the Sender ICP registry, so none of its own surfaces were read.',
        counter_rule:'no_gap', surfaces:[] };
      say('discovery', `${row.entity}: not in the ICP registry - research task, not a lead`, { entity: row.entity });
      discovered.push(row);
      continue;
    }
    const pages = [];
    for (const sfc of hit.surfaces) {
      const f = await fetchSource(sfc.url);
      if (f.ok) pages.push({ kind: sfc.kind, url: f.url, text: f.modelText });
      else say('discovery', `${row.entity}: surface unreachable ${sfc.url} (${f.error})`, { entity: row.entity });
    }
    if (!pages.length) {
      row.discovery = { is_sender_icp:'unknown', sender_fit:'none', icp_tier:hit.tier, evidence:[],
        counter:'No surface for this entity could be fetched.', counter_rule:'no_gap', surfaces:[] };
      discovered.push(row); continue;
    }
    try {
      const out = await ai.json('discovery', {
        system: AGENTS.discovery.system(T),
        user: AGENTS.discovery.user({ entity: hit.name, pages }),
        model: NEAR.models.light, maxTokens: 6000
      });
      const d = out.parsed || {};
      // Grounding again: every discovery quote must exist in a surface we fetched.
      const blob = pages.map(p => p.text).join('\n');
      d.evidence = (d.evidence || []).filter(e => e.quote && quoteIsGrounded(e.quote, blob));
      d.surfaces = pages.map(p => ({ kind: p.kind, url: p.url }));
      d.icp_tier = d.icp_tier ?? hit.tier;
      // Volume alone can never be "strong". Code enforces it, not the prompt.
      const fitText = d.evidence.map(e => e.quote).join(' ');
      const fit = productFitPoints(fitText);
      if (d.sender_fit === 'strong' && fit.points < 12) {
        d.sender_fit = 'possible';
        say('discovery', `${row.entity}: downgraded strong -> possible, no latency or landing evidence`, { entity: row.entity });
      }
      d.product_fit = fit;
      // Best (lowest-letter) grade across the surfaces we actually read.
      d.evidence_grade = (d.evidence || [])
        .map(e => GRADE_BY_SURFACE[e.surface] || 'D')
        .sort()[0] || 'D';
      d.motion = routeMotion(fitText + ' ' + (d.counter || '')).motion;
      if (hit.route) d.motion = hit.route;      // registry override, e.g. Kraken
      row.relationship = hit.rel;
      row.discovery = d;
      say('discovery', `${row.entity}: ICP ${d.is_sender_icp}, fit ${d.sender_fit}, ${d.evidence.length} grounded quote(s)`, { entity: row.entity });
    } catch (e) {
      reject('discovery', { reason: e.code || 'MALFORMED_JSON', entity: row.entity, detail: e.message });
      continue;
    }
    discovered.push(row);
  }

  /* ---- 3. ENRICH ----------------------------------------------------- */
  const enriched = [];
  for (const row of discovered) {
    let out;
    try {
      out = await ai.json('enricher', {
        system: AGENTS.enricher.system(T),
        user: AGENTS.enricher.user({ row, pageText: row._modelText }),
        model: NEAR.models.heavy, maxTokens: 6000
      });
    } catch (e) { reject('enricher', { reason: e.code || 'MALFORMED_JSON', entity: row.entity,
        detail: e.message + (e.raw ? ' || RAW: ' + String(e.raw).replace(/\s+/g,' ').slice(0, 1500) : '') }); continue; }

    const p = out.parsed || {};
    const spans = p.spans || {};
    // Every gate field must exist. A field the model omitted is NOT evidence,
    // so it defaults to false rather than disappearing from the row.
    // Roles that actually own transaction landing. A CEO or a generic founder
    // listing does not clear this - it is who you would call about an RPC bill.
    const INFRA_ROLE = /\b(infrastructur|engineer|engineering|cto|chief technolog|technical|tech lead|devops|sre|platform|backend|protocol|trading systems?|head of (engineering|technology|infrastructure|trading)|architect|core (dev|contributor))/i;
    const GATE_FIELDS = ['solana_activity','transaction_volume_evidence','latency_sensitive',
                         'reliability_pain','is_competitor','infrastructure_owner_identified'];
    const gate = {};
    for (const k of GATE_FIELDS) gate[k] = (p.gate && p.gate[k]) === true;

    // A true gate field with no supporting span is downgraded to false.
    // The model may assert; it may not assert without evidence.
    for (const k of Object.keys(gate)) {
      if (gate[k] === true && k !== 'is_competitor' && !spans[k]) {
        gate[k] = false;
        say('enricher', `dropped unsupported gate field ${k} for ${row.entity}`, { entity: row.entity });
      }
    }
    // "Infrastructure owner identified" means we know who owns the
    // transaction-landing decision. Flint scored 80 partly because the page
    // lists "Founder Joshua Watts Co-Founder, CEO" - a grounded span naming a
    // real person, who is not an infrastructure owner. A name is not a role.
    if (gate.infrastructure_owner_identified && !INFRA_ROLE.test(spans.infrastructure_owner_identified || '')) {
      gate.infrastructure_owner_identified = false;
      say('enricher', `owner span names no infrastructure role for ${row.entity}`, { entity: row.entity });
    }
    if (!p.counter || String(p.counter).trim().length < 10) {
      reject('enricher', { reason: 'MALFORMED_JSON', entity: row.entity, detail: 'no counter-rationale returned; counter is mandatory' });
      continue;
    }

    enriched.push({
      ...row, gate, spans,
      tier: row.discovery?.is_sender_icp === 'unknown' ? null : (row.discovery?.icp_tier ?? p.tier ?? null),
      // Registry membership is a FACT from icp.js, not a model opinion. Discovery
      // may decline to call an account an ICP fit; that must not erase the fact
      // that we already track it, or a known exchange loses its routing task.
      registry_tier: lookupICP(row.entity)?.tier ?? null,
      services: Array.isArray(p.services) ? p.services : [],
      why: p.why || row.why_relevant || '',
      counter: p.counter,
      discovery: row.discovery,
      relationship: row.relationship || 'UNCLEAR',
      evidence_grade: row.discovery?.evidence_grade || null,
      source_type: row.source_type || sourceTypeOf(row.source_kind),
      surface_owner: row.surface_owner || null,
      motion: row.discovery?.motion || 'UNROUTED',
      counterRule: p.counter_rule ?? null,
      blocked: false,
      // The rubric is filled from the GATE, in code. The model never sets a number.
      // Derived in score.js so a later gate correction moves the number too.
      rubric: rubricFor(row, gate),
      penalties: penaltiesFor(row, gate)
    });
    say('enricher', `enriched ${row.entity}`, { entity: row.entity });
  }

  /* ---- 4 + 5. SCORE AND GATE (pure code) ----------------------------- */
  const scored = enriched.map(row => {
    const a = assess(row, PRIMARY_LENS);
    return { ...row, assessment: a, services_fired: servicesFor(row) };
  });
  say('scorer', `${scored.length} row(s) scored`);
  say('gate', `${scored.filter(r => r.assessment.verdict !== r.assessment.band).length} row(s) moved by a cap or the gate`);

  /* ---- 6. WRITE (internal brief only) -------------------------------- */
  for (const row of scored) {
    if (!['ACTIONABLE', 'QUALIFY'].includes(row.assessment.verdict)) continue;
    try {
      const out = await ai.json('writer', {
        system: AGENTS.writer.system(T),
        user: AGENTS.writer.user({ row, assessment: row.assessment }),
        model: NEAR.models.heavy, maxTokens: 6000
      });
      row.brief = out.parsed?.brief || null;
      // Belt and braces: if the model produced outreach anyway, bin it.
      const blob = JSON.stringify(row.brief || {}).toLowerCase();
      if (/subject:|dear |hi there|best regards|kind regards/.test(blob)) {
        row.brief = null;
        say('writer', `discarded brief for ${row.entity}: contained outreach copy`, { entity: row.entity });
      } else {
        say('writer', `brief written for ${row.entity}`, { entity: row.entity });
      }
    } catch (e) { say('writer', `brief failed for ${row.entity}: ${e.message}`, { entity: row.entity }); }
  }

  return finish(scored);

  function finish(rows = []) {
    for (const r of rows) { delete r._pageText; delete r._modelText; }
    const t = ledger.totals;
    return {
      runId,
      mode: 'live',
      generatedAt: new Date().toISOString(),
      window, variant,
      motion: { product: 'Sender', lens: PRIMARY_LENS },
      inference: { provider: 'NEAR AI Cloud', baseUrl: NEAR.baseUrl, models: NEAR.models },
      sourcesFetched: fetched,
      rows,
      rejected,
      log,
      cost: {
        calls: t.calls, promptTokens: t.inTok, completionTokens: t.outTok,
        usd: t.usd, priced: t.priced, wallMs: t.ms,
        budgetUsd, lines: ledger.lines
      }
    };
  }
}

function penaltiesFor(row, gate) {
  const p = [];
  if (row.source_tier === 2) p.push(['secondary source only', -6]);
  if (row.event_type === 'product_launch' && !gate.transaction_volume_evidence) p.push(['evidence is a product announcement only', -8]);
  if (row.event_type === 'competitive') p.push(['competitive positioning, not a prospect', -10]);
  return p;
}

export async function saveRun(result, dir = 'data/runs') {
  await mkdir(dir, { recursive: true });
  const file = `${dir}/${result.runId}.json`;
  await writeFile(file, JSON.stringify(result, null, 2), 'utf8');
  await writeFile(`${dir}/latest.json`, JSON.stringify(result, null, 2), 'utf8');
  return file;
}
