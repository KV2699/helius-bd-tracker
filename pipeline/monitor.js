// The Account Monitor. Turns the verified registry into a repeatable workflow:
// for every account we can actually read, what changed, when, in their words.
//
// It never decides need. It reports dated change and a research task.
import { ICP, surfaceReport, routeMotion } from './icp.js';
import { fetchSource } from './fetch.js';
import { quoteIsGrounded } from './verify.js';
import { AGENTS } from './agents.js';
import { NEAR } from './config.js';

export async function monitorAccounts({ ai, window, onEvent = () => {}, only = null }) {
  const today = new Date().toISOString().slice(0, 10);
  const changes = [], skipped = [], errors = [];

  const targets = ICP.filter(a =>
    (a.surfaces || []).some(s => s.status === 'verified') &&
    (!only || only.includes(a.name))
  );

  onEvent({ stage: 'monitor', msg: `${targets.length} account(s) with a verified surface` });

  for (const acct of targets) {
    // An account can be research-blocked and still have a readable surface.
    // We monitor what we CAN read and say plainly what we cannot.
    const rep = surfaceReport(acct);
    if (acct.blocked) {
      onEvent({ stage:'monitor', entity:acct.name,
        msg:`${acct.name}: ${acct.blockedReason} - monitoring ${rep.verified.join('/')} only` });
    }

    const pages = [];
    for (const sfc of acct.surfaces.filter(s => s.status === 'verified')) {
      const f = await fetchSource(sfc.url);
      if (f.ok) pages.push({ kind: sfc.kind, url: f.url, text: f.modelText });
      else errors.push({ account: acct.name, url: sfc.url, error: f.error });
    }
    if (!pages.length) {
      skipped.push({ account: acct.name, reason: 'no surface fetched' });
      continue;
    }

    let out;
    try {
      out = await ai.json('monitor', {
        system: AGENTS.monitor.system(today),
        user: AGENTS.monitor.user({ account: acct.name, pages }),
        model: NEAR.models.light, maxTokens: 6000
      });
    } catch (e) {
      errors.push({ account: acct.name, error: e.code || 'MALFORMED_JSON', detail: e.message });
      continue;
    }

    const blob = pages.map(p => p.text).join('\n');
    const raw = Array.isArray(out.parsed?.changes) ? out.parsed.changes : [];
    let kept = 0;
    for (const c of raw) {
      // Same discipline as everywhere else: the quote must exist in the page
      // we fetched, and the date must be inside the window.
      if (!c.quote || !quoteIsGrounded(c.quote, blob)) {
        skipped.push({ account: acct.name, reason: 'QUOTE_NOT_IN_SOURCE', quote: String(c.quote || '').slice(0, 90) });
        continue;
      }
      const d = String(c.change_date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        skipped.push({ account: acct.name, reason: 'DATE_UNVERIFIABLE', quote: c.quote.slice(0, 60) });
        continue;
      }
      if (d < window.from || d > window.to) {
        skipped.push({ account: acct.name, reason: 'DATE_OUT_OF_WINDOW', date: d });
        continue;
      }
      if (!c.why_not || String(c.why_not).trim().length < 8) {
        skipped.push({ account: acct.name, reason: 'NO_COUNTER', quote: c.quote.slice(0, 60) });
        continue;
      }
      const surface = pages.find(p => p.kind === c.surface) || pages[0];
      // Relevance filter: a dated change is not automatically a Sender signal.
      // Eleven irrelevant updates to find zero leads is a worse product than
      // three labelled buckets.
      const r = routeMotion(c.quote + ' ' + (c.why_relevant || ''));
      const relevance = rep.status && rep.status !== 'ACTIVE' ? 'blocked'
                      : r.motion === 'SENDER' ? 'sender_relevant'
                      : r.motion === 'RPC_ENTERPRISE' ? 'wrong_motion'
                      : /solana/i.test(c.quote + (c.why_relevant||'')) ? 'context' : 'not_solana';
      changes.push({
        relevance, motion: r.motion, matched: r.matched,
        account: acct.name, relationship: acct.rel, tier: acct.tier,
        surface: c.surface, url: surface.url,
        change_date: d, signal_type: c.signal_type || 'other',
        quote: c.quote, why_relevant: c.why_relevant || '', why_not: c.why_not,
        research_task: c.research_task || '',
        account_status: rep.status, blocked_surfaces: rep.blocked
      });
      kept++;
    }
    onEvent({ stage:'monitor', entity:acct.name, msg:`${acct.name}: ${kept} dated change(s) from ${raw.length} reported` });
  }

  const buckets = changes.reduce((a, c) => { a[c.relevance] = (a[c.relevance] || 0) + 1; return a; }, {});
  onEvent({ stage:'monitor',
    msg:`relevance: ${buckets.sender_relevant||0} Sender-relevant, ${buckets.context||0} context, ${buckets.wrong_motion||0} wrong-motion, ${buckets.not_solana||0} not Solana, ${buckets.blocked||0} research-blocked` });
  return { changes, buckets, skipped, errors, monitored: targets.map(a => a.name) };
}
