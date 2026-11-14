// Web-sourced discovery signals.
//
// The pipeline could never DISCOVER. fetch.js fetches a URL you already have;
// sourcePlan() derives from the registry; the registry only grew from itself.
// It answered "what changed at accounts I know?" and never "who should I know
// about?" - which is why 317 assertions of integrity produced zero leads while
// Solayer Labs advertised the exact role that proves Sender need, publicly, for
// months.
//
// This is the missing input. A signal here is held to a LOWER bar than a
// pipeline row and says so: search-sourced evidence can start research, it can
// never authorise outreach. The funnel enforces that.
import { readdir, readFile } from 'node:fs/promises';

export const SIGNAL_TYPES = ['hiring','funding','launch','partnership','incident','regulatory','github','ecosystem'];
export const SEGMENTS = ['trader','exchange','wallet','fintech','defi','infrastructure','institutional'];

// Every field is required. A signal without a date, a source or a quote is an
// opinion, and opinions do not enter the system.
export function validateSignal(s) {
  const problems = [];
  if (!s.org)                                 problems.push('no organisation named');
  if (!s.type || !SIGNAL_TYPES.includes(s.type)) problems.push(`type must be one of ${SIGNAL_TYPES.join('|')}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date || '')) problems.push('date must be YYYY-MM-DD');
  if (!s.source || !/^https?:\/\//.test(s.source)) problems.push('source must be a URL');
  if (!s.quote || String(s.quote).length < 15) problems.push('quote must be a real span, 15+ chars');
  if (!s.segment || !SEGMENTS.includes(s.segment)) problems.push(`segment must be one of ${SEGMENTS.join('|')}`);
  if (!s.verified)                            problems.push('verified must say how far this was checked');
  if (!s.counter)                             problems.push('counter-rationale is mandatory, as everywhere else');
  return { ok: problems.length === 0, problems };
}

export async function loadSignals(dir = 'data/signals') {
  const out = [], rejected = [];
  let files = [];
  try { files = (await readdir(dir)).filter(f => f.endsWith('.json')); } catch { return { signals: [], rejected: [] }; }
  for (const f of files) {
    let batch;
    try { batch = JSON.parse(await readFile(`${dir}/${f}`, 'utf8')); } catch (e) {
      rejected.push({ file: f, problems: ['unreadable: ' + e.message] }); continue;
    }
    for (const s of (batch.signals || [])) {
      const v = validateSignal(s);
      if (v.ok) out.push({ ...s, batch: batch.batchId || f, window: batch.window || null });
      else rejected.push({ file: f, org: s.org, problems: v.problems });
    }
  }
  return { signals: out, rejected };
}

// Group by organisation so the funnel sees one account with many signals.
export function byOrg(signals) {
  const m = new Map();
  for (const s of signals) {
    const k = String(s.org).toLowerCase();
    if (!m.has(k)) m.set(k, { org: s.org, segment: s.segment, signals: [] });
    m.get(k).signals.push(s);
  }
  return [...m.values()];
}

// A search-sourced signal is capped. It can open research; it cannot close it.
export const SEARCH_CAP = 'research';
