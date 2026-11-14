// Builds the Helius BD Tracker workbook. Tab parity with Bob W v2, plus one
// extra tab the reviewer asked for: the Contact Verification Queue.
import fs from 'node:fs';
import { buildWorkbook } from './xlsx.js';
import { ROWS, EXCLUDED } from './rows.js';
import { scoreProspect, motionTag, DIMENSIONS, BANDS } from './rubric.js';
import { ICP } from '../pipeline/icp.js';
import { PROMPTS } from './prompts.js';
import { UNIVERSE } from './universe.js';

const T = (v, s = 1) => ({ v, s });
const H = cells => ({ cells: cells.map(c => ({ v: c, s: 2 })), h: 30 });
const B = cells => ({ cells: cells.map(c => ({ v: c, s: 3 })) });
const M = cells => ({ cells: cells.map(c => ({ v: c, s: 4 })) });

const STATUS = { RETAIN:'\u{1F7E2} RETAIN', 'FREE NOW':'\u{1F7E1} FREE NOW', EXPIRED:'\u{1F534} EXPIRED' };

// Contacts discovered by the HX-GA2 agent, grounded in a fetched page. A row
// with a verified contact scores 20 on Identifiability instead of 8, so the
// workbook has to reflect the agent's output or the queue goes stale.
function latestOperatorRun() {
  try {
    const f = fs.readdirSync('data/runs').filter(x => x.startsWith('operators-')).sort().pop();
    return f ? JSON.parse(fs.readFileSync('data/runs/' + f, 'utf8')) : null;
  } catch { return null; }
}

export function buildTracker() {
  const ops = latestOperatorRun();
  const contactsBy = new Map();
  for (const c of (ops?.contacts || [])) {
    if (!contactsBy.has(c.org)) contactsBy.set(c.org, []);
    contactsBy.get(c.org).push(c);
  }
  const withContacts = ROWS.map(r => {
    const found = contactsBy.get(r.org);
    if (!found?.length) return r;
    const lead = found[0];
    return { ...r,
      points: { ...r.points, identity: 20 },
      why: { ...r.why, identity: `VERIFIED from the organisation's own page: ${lead.person} (${lead.source_url}, ${lead.observed})` },
      contact: `${lead.person} — VERIFIED, named on ${lead.source_url}, observed ${lead.observed}. ${found.length - 1} further contact(s) on the same page. Confirm the title is current before outreach.`,
      lastVerified: lead.observed, contactsFound: found };
  });

  const scored = withContacts.map(r => ({ r, s: scoreProspect(r) })).sort((a, b) => b.s.total - a.s.total);
  const crit = scored.filter(x => x.s.band === 'Critical').length;
  const high = scored.filter(x => x.s.band === 'High').length;
  const mon  = scored.filter(x => x.s.band === 'Monitor').length;
  const spec = scored.filter(x => x.r.speculative).length;
  const today = new Date().toISOString().slice(0, 10).split('-').reverse().join('/');

  /* ---- Cover -------------------------------------------------------- */
  const cover = { name:'Cover', widths:[4,120], rows:[
    [T('HELIUS  ·  BD TRACKER v1  —  Solana Infrastructure Pipeline')],
    B(['', `Generated ${today} | 7 streams | ${scored.length} pipeline rows | Critical: ${crit} | High: ${high} | Monitor: ${mon} | Speculative: ${spec}`]),
    B(['', '\u{1F7E2} RETAIN = commercial hook active | \u{1F7E1} FREE NOW = window <90 days | \u{1F534} EXPIRED = no live hook, build the relationship']),
    [''],
    B(['', 'READ THIS FIRST — WHAT THE NUMBERS MEAN']),
    B(['', 'Rows meeting the Bob W standard IN FULL: zero. That standard requires a VERIFIED named contact, and no contact here is verified.']),
    B(['', 'That is a technical truth about the contact bar, NOT a statement that the pipeline is empty. Velocity at ' +
          (scored[0]?.s.total ?? '') + ' carries first-party documentation naming Helius and naming its own keeper bots — a stronger']),
    B(['', 'signal than several rows that would clear the contact bar on weaker evidence. The gap is one verification step, not one of substance.']),
    [''],
    B(['', 'MOTION DISCIPLINE: any row routed away from Sender carries "(not Sender)" in its Stream cell, on every tab. The routing']),
    B(['', 'layer exists to stop a reliability incident being read as a Sender lead; the display must not undo that.']),
    [''],
    B(['', '\u{1F534} PRIORITY ACTIONS — THIS WEEK']),
    ...scored.slice(0, 3).map((x, i) => B(['', `${i + 1}. ${x.r.org}${motionTag(x.r)} — ${x.r.next}`])),
    B(['', `4. Run HX-GA2 against Velocity and Flint. Neither protocol operates the bots or makers it documents. The operators are Stream B,`]),
    B(['', `   have no Helius relationship, and are the first genuine COLD candidates this system can point at.`]),
    B(['', `5. Verify ONE contact at Velocity. That single step moves the row from ${scored[0]?.s.total} to ${(scored[0]?.s.total ?? 0) + 12} — Critical. Cheapest points in the system.`]),
    [''],
    B(['', 'TABS']),
    B(['', 'Tab 1 — Existing & Expansion | Check here FIRST. Never cold-approach an account with a relationship.']),
    B(['', 'Tab 2 — Pipeline | Scored rows, sorted by score. Every signal dated + first-party sourced.']),
    B(['', 'Tab 3 — Verification Queue | Every UNVERIFIED contact, the prompt that fills it, sorted by score. This is the worklist.']),
    B(['', 'Tab 4 — Live Signals | Weekly monitor output with relevance buckets.']),
    B(['', 'Tab 5 — Prompt Pack | HX-G1/G2 search, HX-P1 verify, HX-GA1/GA2 scan, HX-CG1 score, HX-C1 write.']),
    B(['', 'Tab 6 — Solana Universe | Where the buyers are. Registry vs candidate, hosting posture.']),
    B(['', 'Tab 7 — Key & Methodology | Rubric, streams, status codes, data hygiene rules.'])
  ]};

  /* ---- Tab 1: Existing & Expansion ---------------------------------- */
  const existing = { name:'Tab 1 — Existing & Expansion', widths:[4,26,22,30,60], rows:[
    [T('TAB 1 — EXISTING ACCOUNTS & EXPANSION')],
    B(['', 'Check this tab BEFORE adding anything to Tab 2. An existing relationship is an EXPANSION motion, never a cold lead.']),
    [''],
    H(['', 'Organisation', 'Relationship', 'Evidence', 'Rule']),
    B(['', 'Helius', 'US', 'Self', 'Excluded from all outreach.']),
    B(['', 'Velocity Protocol', 'EXPANSION — free tier',
        'Their own developer docs name Helius as sufficient to get started (docs.velocity.exchange, 05/11/2026)',
        'Stream X. Approach on displacement-from-free, not as a new logo. Confirm the account record before contact.']),
    [''],
    B(['', 'EXCLUDED FROM THE PIPELINE — kept visible so nobody re-adds them blind']),
    H(['', 'Organisation', 'Classification', 'Why', '']),
    ...EXCLUDED.map(e => B(['', e[0], e[1], e[2], '']))
  ]};

  /* ---- Tab 2: Pipeline ---------------------------------------------- */
  const PIPE_H = ['Organisation','Score','Band','Stream','Sector','Multi-Surface','Surfaces Overlap',
    'Entry Signal (dated, first-party sourced)','Source URL','Signal Type','Signal Date','Contact',
    'Entry Point','Next Action','Verification','Data Status','Days Remaining','Last Verified'];
  const pipeline = { name:'Tab 2 — Pipeline',
    widths:[26,7,11,34,22,13,30,78,46,24,13,46,30,90,30,26,20,16], rows:[
    [T('TAB 2 — HELIUS BD PIPELINE')],
    B([`Generated ${today} | CHECK TAB 1 FIRST | ${scored.length} rows | Critical ${crit} | High ${high} | Monitor ${mon} | Speculative ${spec} | No contact on this tab is verified`]),
    B(['Scores are computed by code from the Tab 7 rubric. Nothing here is hand-scored. Rows routed away from Sender say so in the Stream cell.']),
    [''],
    H(PIPE_H),
    ...scored.map(({ r, s }) => B([
      r.org, s.total, s.band + (r.expansion ? ' · EXPANSION' : '') + (r.speculative ? ' · SPECULATIVE' : ''),
      r.streamName + motionTag(r), r.sector, r.multiSurface, r.surfaces,
      r.signal, r.source, r.signalType, r.signalDate, r.contact, r.entry, r.next, r.verification,
      (STATUS[r.status] || r.status) + ' — ' + r.statusWhy, r.days, r.lastVerified
    ])),
    [''],
    B(['SCORE WORKING — every row, every dimension, and the reason for each award']),
    H(['Organisation','Total','', ...DIMENSIONS.map(d => `${d.name} (0-${d.max})`), 'Caps applied']),
    ...scored.map(({ r, s }) => B([r.org, s.total, '',
      ...s.notes.map(n => `${n.points} — ${n.why}`), s.caps.join(' ') || '—']))
  ]};

  /* ---- Tab 3: Verification Queue ------------------------------------ */
  const queue = scored.filter(x => /UNVERIFIED/i.test(x.r.contact));
  const done  = scored.filter(x => !/UNVERIFIED/i.test(x.r.contact));
  const verq = { name:'Tab 3 — Verification Queue', widths:[4,26,7,11,34,30,40,60,14], rows:[
    [T('TAB 3 — CONTACT VERIFICATION QUEUE')],
    B(['', 'Every row whose contact is UNVERIFIED, sorted by score. This is a worklist, not a caveat.']),
    B(['', 'A contact must be VERIFIED — name, title, employer, primary-source URL and date — before ANY outreach.']),
    B(['', 'Verifying a contact awards 12 points (8 → 20 on Identifiability). It is the cheapest score movement in the system.']),
    [''],
    H(['', 'Organisation', 'Score', 'If verified', 'Band now → after', 'Prompt that fills it',
        'What a VERIFIED contact looks like', 'Why this one is worth doing', 'Owner / due']),
    ...queue.map(({ r, s }) => {
      const after = scoreProspect({ ...r, points:{ ...r.points, identity:20 } });
      const prompt = /HX-GA2/.test(r.contact) ? 'HX-GA2 (operator discovery)' : 'HX-GA1 (organisation deep scan)';
      return B(['', r.org + motionTag(r), s.total, after.total, `${s.band} → ${after.band}`, prompt,
        'Name + title + employer, from the company’s own site, docs, repo or press release. URL + date recorded.',
        after.band !== s.band
          ? `Band change: ${s.band} → ${after.band}. Highest-leverage verification on this tab.`
          : (r.speculative ? 'Speculative row — verify the SIGNAL before spending time on the contact.'
                           : 'Score movement only, no band change. Do after the band-changers.'),
        'UNASSIGNED']);
    }),
    [''],
    [''],
    B(['', 'VERIFIED — contacts found by the HX-GA2 agent, grounded in a page we fetched']),
    H(['', 'Organisation', 'Score', '', 'Person', 'Quote from the fetched page', 'Source URL', 'Observed', 'Next step']),
    ...done.flatMap(({ r, s }) => (r.contactsFound || []).map((c, i) => B(['',
      i === 0 ? r.org + motionTag(r) : '', i === 0 ? s.total : '', '',
      c.person, c.quote, c.source_url, c.observed,
      i === 0 ? 'Confirm the title is current, then approach per the Tab 2 Next Action.' : 'Secondary contact.']))),
    ...(done.length ? [] : [B(['', 'None yet. Run: node operators.js'])]),
    [''],
    B(['', 'RULE: do not verify a contact on a speculative row until the row has a dated signal. Verifying a contact at an']),
    B(['', 'organisation with no evidenced pain produces a person to call and nothing to say to them.']),
    B(['', 'RULE: a name on a company page is VERIFIED as written on the day it was read. It is not proof the person still holds']),
    B(['', 'that title. Confirm currency before outreach — the tracker records what the page said, not what is true today.'])
  ]};

  /* ---- Tab 4: Live Signals ------------------------------------------ */
  const opsNote = ops
    ? `HX-GA2 last run ${ops.runId}: ${ops.scanned.length} protocol(s) scanned, ${(ops.operators||[]).length} third-party operator(s) grounded, ${(ops.contacts||[]).length} named contact(s), ${(ops.skipped||[]).length} rejected.`
    : 'HX-GA2 has not been run. Run: node operators.js';
  let mon_ = null;
  try {
    const f = fs.readdirSync('data/runs').filter(x => x.startsWith('monitor-')).sort().pop();
    if (f) mon_ = JSON.parse(fs.readFileSync('data/runs/' + f, 'utf8'));
  } catch {}
  const live = { name:'Tab 4 — Live Signals', widths:[4,14,22,20,18,70,46], rows:[
    [T('TAB 4 — LIVE SIGNALS')],
    B(['', mon_ ? `Latest monitor run: ${mon_.runId} | ${(mon_.changes||[]).length} dated changes | ${(mon_.skipped||[]).length} skipped with a reason | $${(mon_.cost?.usd ?? 0).toFixed(4)} on NEAR AI`
                : 'No monitor run found. Run: node monitor.js']),
    B(['', mon_?.buckets ? `RELEVANCE — ${mon_.buckets.sender_relevant||0} Sender-relevant, ${mon_.buckets.context||0} context, ${mon_.buckets.wrong_motion||0} wrong motion, ${mon_.buckets.not_solana||0} not Solana, ${mon_.buckets.blocked||0} research-blocked` : '']),
    B(['', 'A dated change is not a lead. The relevance bucket is the first thing to read.']),
    B(['', opsNote]),
    [''],
    H(['', 'Date', 'Account', 'Relevance', 'Signal Type', 'In their words (verbatim, grounded in the fetched page)', 'Source URL']),
    ...((mon_?.changes) || []).map(c => B(['', c.change_date, c.account,
      String(c.relevance || 'unclassified').replace(/_/g, ' '), c.signal_type, c.quote, c.url]))
  ]};

  /* ---- Tab 5: Prompt Pack ------------------------------------------- */
  const prompts = { name:'Tab 5 — Prompt Pack', widths:[4,11,22,20,13,46,110,40], rows:[
    [T('TAB 5 — PROMPT PACK')],
    B(['', 'Run order: HX-G1 + HX-G2 + HX-G3 (search, Thursday) → HX-P1 (verify) → HX-GA1 / HX-GA2 v2 (deep scan) → HX-CG1 (score) → HX-C1 (write the row)']),
    B(['', 'HX-GA2 v2 runs as CODE against the GitHub API (pipeline/forks.js) - no model touches discovery. HX-G2 and HX-G3 are strict 30-day windows.']),
    [''],
    H(['', 'ID', 'Tool', 'When', 'Frequency', 'Job', 'Prompt text (copy verbatim)', 'Notes']),
    ...PROMPTS.map(p => M(['', p.id, p.tool, p.when, p.freq, p.job, p.text, p.notes]))
  ]};

  /* ---- Tab 6: Universe ---------------------------------------------- */
  const reg = new Map(ICP.map(a => [a.name.toLowerCase(), a]));
  const universe = { name:'Tab 6 — Solana Universe', widths:[4,34,34,26,26,56], rows:[
    [T('TAB 6 — SOLANA UNIVERSE: WHERE THE BUYERS ARE')],
    B(['', 'The equivalent of Bob W’s city map. Drives the Ecosystem Surface Overlap score.']),
    B(['', 'REGISTRY = a surface this pipeline has fetched and verified. CANDIDATE = publicly known, not yet verified — a target for HX-G1, not a row.']),
    B(['', 'Hosting posture is UNKNOWN unless first-party evidence says otherwise. Guessing it mis-scores a whole category.']),
    [''],
    H(['', 'Category', 'Organisations', 'Status', 'Hosting posture', 'Note']),
    ...UNIVERSE.map(u => {
      const hit = reg.get(String(u.orgs).toLowerCase());
      const status = u.status || (hit ? (hit.blocked ? 'Registry — ' + hit.blockedReason : 'Registry — verified') : 'Candidate');
      return B(['', u.cat, u.orgs, status, u.hosting, u.note || '']);
    })
  ]};

  /* ---- Tab 7: Key & Methodology ------------------------------------- */
  const key = { name:'Tab 7 — Key & Methodology', widths:[4,34,12,96], rows:[
    [T('TAB 7 — KEY, SCORING RUBRIC & DATA METHODOLOGY')],
    [''],
    B(['', 'STREAM DEFINITIONS']),
    ...[['Stream A — Protocol / DeFi operator','Perp DEXs, order books, lending protocols that depend on automated submission. Buys Sender, RPC, websockets, gPA. Contact: protocol engineer, Head of Infrastructure.'],
        ['Stream B — Keeper-bot / automation operator','The THIRD PARTIES running liquidators, JIT makers and order triggers on top of Stream A protocols. Buys Sender, staked connections. Contact: operator founder. Highest intent, smallest entity.'],
        ['Stream C — Trading firm / MEV infra','Market makers, prop desks, arb firms. Buys Sender, dedicated nodes, Geyser. Contact: Head of Trading Infrastructure.'],
        ['Stream D — Indexer / data consumer','Analytics, portfolio, tax, dashboards. Buys indexing, webhooks, archival, gPA. Contact: Head of Data.'],
        ['Stream E — Wallet / consumer app','Wallets, launchpads, consumer trading apps. Buys RPC at volume, webhooks, priority sends. Contact: Head of Engineering.'],
        ['Stream F — Displacement','Any org on a named competitor or self-hosting at pain. Buys migration. Contact: whoever owns the migration.'],
        ['Stream X — Expansion','EXISTING Helius accounts with unsold surfaces. Expand, never cold-pitch.']].map(r => B(['', r[0], '', r[1]])),
    [''],
    B(['', 'SCORING RUBRIC (100 points — computed in code, see tracker/rubric.js)']),
    ...DIMENSIONS.flatMap(d => [
      B(['', d.name, `0-${d.max}`, d.bands.map(b => `${b[0]} = ${b[1]}`).join('  |  ')])]),
    B(['', 'Bands', '', BANDS.map(b => `${b.name} (${b.min}+) = ${b.action}`).join('  |  ')]),
    [''],
    B(['', 'TWO HARD RULES']),
    B(['', '1. Identifiability raises, never lowers', '', 'A generic entity (a chain, a sector, an ecosystem) scores 0 on Identifiability and is CAPPED AT MONITOR. The previous system did the opposite — it demoted rows it could identify and left unidentified rows alone, so less knowable scored higher. A row whose organisation was "Solana" reached Qualify on 61 points.']),
    B(['', '2. Expansion is not cold', '', 'An account with an existing Helius relationship is scored on the same rubric but flagged EXPANSION, and its Next Action must be an expansion or displacement motion.']),
    [''],
    B(['', 'DATA STATUS CODES']),
    B(['', '\u{1F7E2} RETAIN', '', 'Commercial hook active beyond the current window. Do not give this value away free.']),
    B(['', '\u{1F7E1} FREE NOW', '', 'Entry hook expires within 90 days. Offer proof of value while the window is open.']),
    B(['', '\u{1F534} EXPIRED', '', 'The specific hook has closed. Build the relationship for the next signal.']),
    [''],
    B(['', 'CONTACT VERIFICATION STANDARD']),
    B(['', 'VERIFIED', '', 'Name, title and employer confirmed from a primary source — the company’s own site, docs, repo, press release or filing. URL + date recorded.']),
    B(['', 'UNVERIFIED', '', 'Not confirmed from a primary source. Do NOT approach. Run HX-GA1 (organisation) or HX-GA2 (operator) first. See Tab 3.']),
    [''],
    B(['', 'DATA HYGIENE RULES']),
    ...['1. Check Tab 1 BEFORE adding any prospect. Velocity is already on a Helius free tier by its own documentation. Cold-pitching an existing account is the worst outcome in this system.',
        '2. Every signal needs a first-party source URL and a date. No undated, unsourced or secondary-coverage signal enters the tracker.',
        '3. Verify the surface resolves to the organisation named. If a URL redirects to another company, the row is a SURFACE MISMATCH and does not enter. docs.drift.trade serves Velocity’s documentation — the evidence was real, the company was wrong.',
        '4. Contacts must be VERIFIED before outreach. Named-but-unverified is a research state, not an approach state.',
        '5. Score before entry, with HX-CG1. Scores are computed from the rubric, never guessed.',
        '6. Standing conditions are capped at Monitor. Documentation describing how a system works is not an event.',
        '7. An incident on another chain is not a signal. Coinbase’s Sonic outage is not Solana evidence.',
        '8. The protocol is rarely the buyer. When a protocol documents bots or makers it does not operate, run HX-GA2 and enter the operators.',
        '9. Empty is a valid weekly result. A week with no new rows is a real outcome; a week with invented rows is a corrupted tracker.',
        '10. Any row routed away from Sender carries "(not Sender)" in its Stream cell, on every tab.'
       ].map(r => B(['', '', '', r]))
  ]};

  return buildWorkbook([cover, existing, pipeline, verq, live, prompts, universe, key]);
}
