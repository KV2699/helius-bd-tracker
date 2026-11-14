#!/usr/bin/env node
// The BD worklist. Opportunities, research, monitor, disqualified.
// An opportunity is a credible Helius product CONVERSATION - never a promise
// that anyone will buy, and never outreach.
//   node funnel.js
import { ICP } from './pipeline/icp.js';
import { productFit } from './pipeline/products.js';
import { placeInFunnel, summarise, STATE, SEGMENTS } from './pipeline/funnel.js';
import { loadSignals, byOrg } from './pipeline/discovery.js';
import { PRODUCTS } from './pipeline/products.js';
import { writeFile, mkdir, readdir, readFile } from 'node:fs/promises';

async function signalsFor(name) {
  const out = [];
  try {
    const latest = (await readdir('data/runs')).filter(f => f.startsWith('run-')).sort().pop();
    if (!latest) return out;
    const run = JSON.parse(await readFile(`data/runs/${latest}`, 'utf8'));
    const key = String(name).toLowerCase().split(' ')[0];
    for (const r of (run.rows || []))
      if (String(r.entity).toLowerCase().includes(key))
        out.push({ type: r.event_type || 'event', date: r.event_date, quote: r.quote, source: r.source_url });
  } catch {}
  return out;
}

console.log(`\nHELIUS BD WORKLIST\n${'='.repeat(74)}`);
const rows = [];

// EVERY registry account, including those with no verified surface. Skipping
// them left DFlow (an existing customer) and Bullet (a named successor)
// invisible - which is the exact failure the funnel exists to prevent. An
// account with nothing readable still belongs on the list, as monitor or
// disqualified, so nobody re-adds it as a fresh prospect later.
for (const a of ICP) {
  const readable = (a.surfaces || []).some(s => s.status === 'verified');
  let fit = {}, detail = {};
  if (readable) {
    try { const pf = await productFit(a.name, { onEvent: () => {} }); fit = pf.vector || {}; detail = pf.detail || {}; } catch {}
  }
  const placed = placeInFunnel({ account: a, fit, detail, signals: await signalsFor(a.name), segment: a.segment });
  if (!readable && placed.state !== STATE.DISQUALIFIED) {
    placed.why = a.blocked ? `${a.blockedReason || a.blocked}: no readable surface.` : 'No verified surface to read.';
    placed.next_action = a.humanTask || `Find a surface ${a.name} owns. Do not guess a domain.`;
  }
  rows.push(placed);
}

// Web-discovered businesses, same funnel. Search-sourced evidence is capped at
// RESEARCH in code: it can open a question, never name a conversation.
const disc = await loadSignals();
if (disc.rejected.length) {
  console.log(`\n${disc.rejected.length} signal(s) rejected on the schema:`);
  disc.rejected.forEach(r => console.log(`   ${r.org || r.file}: ${r.problems.join('; ')}`));
}
for (const o of byOrg(disc.signals)) {
  if (ICP.find(a => a.name.toLowerCase() === o.org.toLowerCase())) continue;
  const fit = {}, detail = {};
  for (const s of o.signals) for (const p of (s.products || [])) {
    fit[p] = Math.max(fit[p] || 0, 22);
    (detail[p] ||= { evidence: [] }).evidence.push({ term: s.type, excerpt: s.quote, url: s.source });
  }
  const placed = placeInFunnel({
    account: { name: o.org, segment: o.segment, rel: 'UNCLEAR', status: 'active', origin: 'web discovery' },
    fit, detail, signals: o.signals.map(s => ({ type: s.type, date: s.date, quote: s.quote, source: s.source })),
    segment: o.segment });
  if (placed.state === STATE.OPPORTUNITY) {
    placed.state = STATE.RESEARCH;
    placed.why += ' Capped at research: evidence is search-sourced, not read from a page the company owns.';
    placed.next_action = `Verify the ${PRODUCTS[placed.primary_product]?.name || placed.primary_product} fit from a page ${o.org} owns, then re-run.`;
  }
  rows.push(placed);
}

const ORDER = [STATE.OPPORTUNITY, STATE.RESEARCH, STATE.MONITOR, STATE.DISQUALIFIED];
rows.sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || b.product_fit_score - a.product_fit_score);

const s = summarise(rows);
console.log(`${s.opportunities} opportunities · ${s.byState.research || 0} research tasks · ` +
            `${s.byState.monitor || 0} to monitor · ${s.byState.disqualified || 0} disqualified`);

for (const state of ORDER) {
  const group = rows.filter(r => r.state === state);
  if (!group.length) continue;
  console.log(`\n${'='.repeat(74)}\n${state.toUpperCase()}  (${group.length})\n${'='.repeat(74)}`);
  for (const r of group) {
    if (state === STATE.OPPORTUNITY) {
      console.log(`\nAccount          : ${r.account}${r.origin !== 'registry' ? '  * ' + r.origin : ''}`);
      console.log(`Segment          : ${r.segment_label}`);
      console.log(`Primary product  : ${PRODUCTS[r.primary_product]?.name || r.primary_product}  (fit ${r.product_fit_score})`);
      console.log(`Secondary        : ${r.secondary_products.map(p => PRODUCTS[p]?.name || p).join(', ') || 'none'}`);
      if (r.why_now) console.log(`Why now          : ${r.why_now}`);
      if (r.quote)   console.log(`Evidence         : "${String(r.quote).slice(0, 150)}"`);
      console.log(`Source           : ${r.source || '-'}  (${r.date || r.date_basis})`);
      console.log(`Counter          : ${r.counter_rationale}`);
      console.log(`NEXT ACTION      : ${r.next_action}`);
    } else {
      console.log(`\n  ${r.account}${r.primary_product ? `  [${r.primary_product} ${r.product_fit_score}]` : ''}${r.origin !== 'registry' ? '  * ' + r.origin : ''}`);
      console.log(`     ${r.why}`);
      console.log(`     NEXT: ${r.next_action}`);
    }
  }
}

console.log(`\n${'='.repeat(74)}`);
console.log(`${s.total} accounts placed · ${s.worklist} on the worklist · nothing dropped`);
console.log(`Opportunity = a credible product conversation. Not a lead, not intent to buy.`);
console.log(`Every next action is human work. The system never sends anything.`);

const runId = 'funnel-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
await mkdir('data/runs', { recursive: true });
await writeFile(`data/runs/${runId}.json`, JSON.stringify({ runId, summary: s, rows }, null, 2));
console.log(`\nSaved: data/runs/${runId}.json\n`);
