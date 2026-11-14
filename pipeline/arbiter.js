// THE ARBITER. It fetches the page itself, runs the grounding check, and only
// then settles.
//
// The first testnet run did NOT do this. I typed the reason code on the command
// line - `settle json-args '{"reason_code":"QUOTE_NOT_IN_SOURCE"}'` - which
// proves the contract enforces who may settle, and proves nothing at all about
// the verdict. A human asserting a verdict to a contract is the thing this
// whole project exists to refuse.
//
// So: the arbiter takes a delivery, fetches the worker's cited URL through the
// same whitelist fetcher the pipeline uses, runs quoteIsGrounded against the
// page IT fetched (never page text supplied by the worker), derives the reason
// code from that result, archives the page, and hashes the evidence so anyone
// can replay the decision.
import { fetchSource } from './fetch.js';
import { quoteIsGrounded } from './verify.js';
import { outcomeFor } from './market.js';
import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';

export const sha256 = s => createHash('sha256').update(String(s)).digest('hex');

/* Decide a delivery. No model is involved: the verdict is a string search in a
   page we fetched ourselves. Returns the reason code and the evidence to
   reproduce it. */
export async function adjudicate({ bountyId, url, quote }, { archiveDir = 'data/market/evidence' } = {}) {
  const started = new Date().toISOString();
  let page;
  try { page = await fetchSource(url, { skipWhitelist: true }); }
  catch (e) { page = { ok: false, error: e.message }; }

  if (!page.ok) {
    return finish({ bountyId, url, quote, started, reason: 'SOURCE_UNREACHABLE',
                    detail: page.error || 'no page', pageText: null, archiveDir });
  }

  const grounded = quoteIsGrounded(quote, page.pageText);
  const reason = grounded ? 'GROUNDED' : 'QUOTE_NOT_IN_SOURCE';
  const detail = grounded
    ? `found in ${page.fullChars} chars fetched from ${page.url}`
    : 'the quote is not in the page the worker cited';
  return finish({ bountyId, url, quote, started, reason, detail, pageText: page.pageText, archiveDir, fetchedUrl: page.url });
}

async function finish({ bountyId, url, quote, started, reason, detail, pageText, archiveDir, fetchedUrl }) {
  const pageHash = pageText ? sha256(pageText) : null;
  // The hash anyone needs to replay this: which page, which claim, which verdict.
  const evidenceHash = sha256([pageHash || 'UNREACHABLE', quote, reason].join('|'));
  let archived = null;
  if (pageText) {
    await mkdir(archiveDir, { recursive: true });
    archived = `${archiveDir}/${bountyId}-${pageHash.slice(0, 12)}.txt`;
    await writeFile(archived, pageText);
  }
  return {
    bountyId, reason, outcome: outcomeFor(reason), detail,
    quote, url, fetchedUrl: fetchedUrl || null,
    pageHash, evidenceHash, archived,
    decidedBy: 'quoteIsGrounded() over a page the arbiter fetched itself',
    model: 'none', startedAt: started, decidedAt: new Date().toISOString()
  };
}

/* Replay a decision from the archived page. This is what makes the verdict
   checkable by someone who does not trust the arbiter. */
export async function replay(verdict, { readFile } = {}) {
  const fs = await import('node:fs/promises');
  const pageText = await (readFile || fs.readFile)(verdict.archived, 'utf8');
  const pageHash = sha256(pageText);
  const grounded = quoteIsGrounded(verdict.quote, pageText);
  const reason = grounded ? 'GROUNDED' : 'QUOTE_NOT_IN_SOURCE';
  const evidenceHash = sha256([pageHash, verdict.quote, reason].join('|'));
  return {
    pageHashMatches: pageHash === verdict.pageHash,
    reasonMatches: reason === verdict.reason,
    evidenceHashMatches: evidenceHash === verdict.evidenceHash,
    recomputed: { pageHash, reason, evidenceHash }
  };
}
