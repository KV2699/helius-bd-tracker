// HX-GA2 v2 - operator discovery through the FORK GRAPH, not protocol docs.
//
// v1 read a protocol's documentation and asked a model who ran the bots. That
// was always going to fail: the docs describe what the bots DO, never who runs
// them. Operators do not publish. They fork a repo, run a binary, stay quiet.
//
// So v2 reads the code. Every fact below comes from the GitHub REST API as a
// structured field - fork parentage, push dates, commit authors, profile
// company and blog. No model invents any of it; the model is used only to
// classify an operator once the facts are already in hand.
import { ICP, lookupICP } from './icp.js';
import { fetchSource } from './fetch.js';

const GH = 'https://api.github.com';
const HEAD = {
  'user-agent': 'helius-bd-tracker',
  'accept': 'application/vnd.github+json',
  // A token raises the limit from 60/hr to 5,000/hr. Optional - the crawler
  // degrades to a smaller sample rather than failing.
  ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
};

let remaining = null;
async function gh(path) {
  const r = await fetch(GH + path, { headers: HEAD });
  remaining = r.headers.get('x-ratelimit-remaining');
  if (r.status === 403 && remaining === '0') {
    const e = new Error('GitHub rate limit exhausted. Set GITHUB_TOKEN for 5,000/hr.');
    e.code = 'RATE_LIMITED'; throw e;
  }
  if (!r.ok) { const e = new Error(`${r.status} on ${path}`); e.code = 'GITHUB_' + r.status; throw e; }
  return r.json();
}

// Repos whose forks are worth reading: the automation a protocol publishes for
// other people to run. Discovered from the org, never hardcoded by name.
const AUTOMATION_RE = /keeper|liquidat|jit|trigger|filler|crank|bot/i;

export async function findAutomationRepos(org) {
  const repos = await gh(`/orgs/${org}/repos?per_page=100&sort=updated`);
  // Archived repos are KEPT. The first version skipped them and found nothing,
  // because Velocity archived every Drift-era keeper repo - which is exactly
  // where the forks live. An archived upstream says nothing about whether the
  // forks are still running; dpi-keepers was pushed months after archival.
  // It is worth recording though: an archived reference implementation is a
  // real signal about a protocol mid-migration.
  return repos
    .filter(r => AUTOMATION_RE.test(r.name + ' ' + (r.description || '')))
    .filter(r => r.forks_count > 0)
    .sort((a, b) => b.forks_count - a.forks_count)
    .map(r => ({ full_name: r.full_name, forks: r.forks_count, stars: r.stargazers_count,
                 archived: r.archived, description: r.description, pushed_at: r.pushed_at }));
}

// Classification, in code, against the operator's OWN fetched page. No model.
// The rules are crisp and the evidence is a page we read, so a model would only
// add a way to be wrong.
//
// The case that forced this: a fork owner whose company field said "Astralane".
// Astralane's own site is titled "Fast Solana Transaction Submission API" - it
// sells what Sender sells. The crawler surfacing a competitor's engineer is
// correct behaviour; calling them a lead would not be.
const SELLS_SUBMISSION = /transaction submission|submit transactions|rpc (provider|endpoint|node|service)|staked connection|shredstream|landing rate|tx landing|block engine/i;

// WHICH CHAIN? The classifier asked "do they sell what we sell?" and never
// "are they even on Solana?". fireflyprotocol forks Velocity's keeper bots and
// its GitHub org declares bluefin.io - a Sui venue that does not mention Solana
// once. It passed as a CANDIDATE. Forking a Solana repo is not the same as
// building on Solana.
const SOLANA_MENTION = /\bsolana\b|\bSPL\b|\bSVM\b|mainnet-?beta/i;
const OTHER_CHAIN = /\b(sui|aptos|ethereum|arbitrum|base|monad|sei|berachain|hyperliquid)\b/i;
const NOT_A_BUYER_BIO  = /\b(student|fellow|intern|learning|university|institute of technology|college|bootcamp|vibe coder)\b/i;
const INSTITUTION      = /\b(university|institute|college|school|academy|foundation)\b/i;

export async function classifyOperator(op, { fetchSource }) {
  const out = { ...op, classification: null, why: null, surface: null, surface_chars: 0 };

  // An institution is not a trading firm.
  if (INSTITUTION.test(op.org || '')) {
    out.classification = 'NOT_A_BUYER';
    out.why = `"${op.org}" is an institution, not a firm running a book.`;
    return out;
  }
  // A bio that says student / fellow / learning is somebody studying the repo.
  if (NOT_A_BUYER_BIO.test(op.bio || '')) {
    out.classification = 'NOT_A_BUYER';
    out.why = 'Profile reads as an individual learning the codebase, not an operator.';
    return out;
  }
  // Resolving the COMPANY, not the person. A profile's blog is often a personal
  // site, which tells us nothing about the firm named in the company field.
  // So: look the company up as a GitHub org through the API and take the site
  // IT declares. That is a lookup, never a guessed domain - the rule against
  // constructing URLs applies here exactly as it does to evidence.
  let site = op.site, siteBasis = 'profile blog';
  if (op.org) {
    try {
      const o = await gh(`/orgs/${encodeURIComponent(op.org)}`);
      if (o?.blog) { site = o.blog; siteBasis = `github.com/${o.login} declared site`; }
    } catch (e) {
      // A 404 means no such org - the personal blog is then the best we have.
      // RATE_LIMITED means we DID NOT LOOK. Falling back silently would classify
      // a company from its employee's personal blog and call that an answer.
      if (e.code === 'RATE_LIMITED') {
        out.classification = 'UNVERIFIABLE';
        out.why = `Could not resolve "${op.org}" - GitHub rate limit reached, so the company was never looked up. Not a finding; a missing lookup. Set GITHUB_TOKEN and re-run.`;
        out.rate_limited = true;
        return out;
      }
    }
  }
  out.site_used = site; out.site_basis = siteBasis;

  if (!site) {
    out.classification = 'UNVERIFIABLE';
    out.why = 'No first-party site on the profile or the GitHub org. A handle is not a company.';
    return out;
  }

  const url = /^https?:/.test(site) ? site : 'https://' + site;
  const src = await fetchSource(url, { skipWhitelist: true });
  if (!src.ok) {
    out.classification = 'UNVERIFIABLE';
    out.why = `Their own site did not fetch (${src.error}). Cannot verify what they do.`;
    return out;
  }
  out.surface = src.url; out.surface_chars = src.pageText.length;

  if (SELLS_SUBMISSION.test(src.pageText)) {
    out.classification = 'COMPETITOR';
    out.why = 'Their own site sells transaction submission or RPC - this is a competitor, not a prospect.';
    return out;
  }
  // Chain check before anything else about fit.
  const saysSolana = SOLANA_MENTION.test(src.pageText);
  const saysOther  = OTHER_CHAIN.test(src.pageText);
  out.chain = saysSolana ? 'solana' : saysOther ? (src.pageText.match(OTHER_CHAIN) || [])[0].toLowerCase() : 'unstated';
  if (!saysSolana && saysOther) {
    out.classification = 'WRONG_CHAIN';
    out.why = `Their own site is about ${out.chain}, not Solana. Forking a Solana repo is not building on Solana.`;
    return out;
  }

  if (src.pageText.length < 400) {
    out.classification = 'THIN_SURFACE';
    out.why = `Site fetches but carries only ${src.pageText.length} characters. Named, not yet evidenced.`;
    return out;
  }
  out.classification = 'CANDIDATE';
  out.why = 'Named org, own site fetches, does not sell submission. Research before approach.';
  return out;
}

export async function classifyRun(run, { onEvent = () => {} } = {}) {
  const say = (msg) => onEvent({ stage: 'forks', msg });
  const classified = [];
  for (const op of (run.operators || [])) {
    const c = await classifyOperator(op, { fetchSource });
    classified.push(c);
    say(`${c.org || c.person || c.handle}: ${c.classification} - ${c.why}`);
  }
  return {
    ...run,
    runId: run.runId.replace(/^forks-/, 'forks-classified-'),
    operators: classified,
    fresh: classified.filter(o => o.classification === 'CANDIDATE' && !o.already_in_registry),
    competitors: classified.filter(o => o.classification === 'COMPETITOR'),
    classifiedAt: new Date().toISOString()
  };
}

export async function discoverViaForks({ orgs = null, since = null, onEvent = () => {} } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  // Default: forks pushed in the last 18 months. A fork nobody has touched in
  // two years is not an operator, it is a bookmark.
  const cutoff = since || new Date(Date.now() - 548 * 86400000).toISOString().slice(0, 10);
  const say = (msg, extra = {}) => onEvent({ stage: 'forks', msg, ...extra });

  // Which GitHub orgs to read. Taken from the registry, so this follows the
  // accounts we actually track.
  const targets = orgs || ICP.filter(a => a.github).map(a => ({ org: a.github, account: a.name }));
  if (!targets.length) { say('no registry account carries a github org'); return empty(today, cutoff); }

  const operators = [], skipped = [], errors = [];
  const seen = new Set();

  for (const t of targets) {
    let repos;
    try { repos = await findAutomationRepos(t.org); }
    catch (e) { errors.push({ org: t.org, reason: e.code || 'GITHUB_ERROR', detail: e.message });
                say(`${t.org}: ${e.message}`); continue; }

    say(`${t.org}: ${repos.length} automation repo(s) with forks`);

    for (const repo of repos) {
      let forks;
      try { forks = await gh(`/repos/${repo.full_name}/forks?sort=newest&per_page=100`); }
      catch (e) { errors.push({ repo: repo.full_name, reason: e.code, detail: e.message }); continue; }

      const live = forks.filter(f => f.pushed_at > cutoff);
      say(`${repo.full_name}${repo.archived ? ' (upstream archived)' : ''}: ${forks.length} fork(s), ${live.length} pushed since ${cutoff}`);

      for (const f of live) {
        if (seen.has(f.owner.login)) continue;
        seen.add(f.owner.login);

        let who;
        try { who = await gh(`/users/${f.owner.login}`); }
        catch (e) { errors.push({ user: f.owner.login, reason: e.code, detail: e.message }); continue; }

        // A fork owner with no organisation, no site and no handle is a person
        // we cannot reach. Recorded, not promoted.
        const org = (who.company || '').replace(/^@/, '').trim() || null;
        const site = who.blog || null;
        const identifiable = !!(org || site || who.twitter_username);

        // Commit authors on the fork - who is actually doing the work.
        let authors = [];
        try {
          const commits = await gh(`/repos/${f.full_name}/commits?per_page=30`);
          const counts = new Map();
          for (const c of (Array.isArray(commits) ? commits : [])) {
            const nm = c.commit?.author?.name;
            if (nm) counts.set(nm, (counts.get(nm) || 0) + 1);
          }
          authors = [...counts.entries()].sort((a, b) => b[1] - a[1])
            .slice(0, 5).map(([name, commits]) => ({ name, commits }));
        } catch { /* commits are a bonus, not a gate */ }

        const rec = {
          handle: f.owner.login,
          person: who.name || null,
          org, site, x: who.twitter_username || null,
          bio: who.bio || null,
          fork: f.full_name,
          fork_description: f.description || null,
          forked_from: repo.full_name,
          upstream_archived: !!repo.archived,
          protocol: t.account,
          last_push: f.pushed_at.slice(0, 10),
          authors,
          identifiable,
          // Every one of these is a URL the API returned, not one we built.
          evidence_url: f.html_url,
          profile_url: who.html_url,
          observed: today,
          stream: 'B',
          already_in_registry: !!lookupICP(org || f.owner.login),
          contact: 'UNVERIFIED - a GitHub profile is a handle, not a buying contact'
        };

        if (!identifiable) {
          skipped.push({ ...rec, reason: 'NO_NAMED_ENTITY',
                         message: 'fork owner has no org, site or handle - not reachable' });
          continue;
        }
        operators.push(rec);
        say(`operator: ${org || who.name || f.owner.login} via ${repo.full_name}`, { entity: org || f.owner.login });
      }
    }
  }

  // Classify every identifiable owner against their OWN site before any of them
  // is called a candidate.
  say(`classifying ${operators.length} identifiable owner(s) against their own sites`);
  const classified = [];
  for (const op of operators) {
    const c = await classifyOperator(op, { fetchSource });
    classified.push(c);
    say(`${c.org || c.person || c.handle}: ${c.classification} - ${c.why}`);
  }

  const rateLimited = errors.some(e => e.reason === 'RATE_LIMITED');
  if (rateLimited) say('GITHUB RATE LIMIT HIT - this run is INCOMPLETE, not empty. Set GITHUB_TOKEN and re-run.');

  const fresh = classified.filter(o => o.classification === 'CANDIDATE' && !o.already_in_registry);
  const competitors = classified.filter(o => o.classification === 'COMPETITOR');
  say(`${classified.length} identifiable, ${fresh.length} candidate(s), ${competitors.length} competitor(s), ${skipped.length} unreachable`);
  return { runId: 'forks-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19),
           generatedAt: new Date().toISOString(), cutoff, today,
           operators: classified, fresh, competitors, skipped, errors,
           incomplete: rateLimited,
           scanned: targets.map(t => `${t.account} (${t.org})`),
           rateRemaining: remaining };
}

function empty(today, cutoff) {
  return { runId: 'forks-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19),
           generatedAt: new Date().toISOString(), cutoff, today,
           operators: [], fresh: [], skipped: [], errors: [], scanned: [], rateRemaining: remaining };
}

// OWNER DISCOVERY. A different question from fork discovery.
//
// forks.js asks "who runs the bots this protocol published?" - third parties.
// This asks "who at the protocol owns execution?" - the named infrastructure
// person that a row needs before it can ever be Actionable.
//
// The bar is deliberately high, and it is the same bar the gate uses: a real
// person or function in an INFRASTRUCTURE role. Not a founder, not a CEO, and
// not "exchange", "platform", "team" or the company's own name.
import { INFRA_ROLE } from './score.js';

const GENERIC_OWNER = /^(the )?(exchange|platform|protocol|team|company|project|dao|labs|foundation|core|engineering)$/i;

export async function findOwners(org, { account = null, onEvent = () => {} } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const say = (msg, extra = {}) => onEvent({ stage: 'owners', msg, ...extra });

  // A GitHub account can be an ORG or a USER, and /orgs/<user> is a 404.
  // dpiprotocol is a user account, so the owner search failed with GITHUB_404
  // and reported "no owners found" - a lookup that never ran, reported as a
  // result. Try both.
  let repos;
  try { repos = await gh(`/orgs/${org}/repos?per_page=100&sort=updated`); }
  catch (e) {
    try { repos = await gh(`/users/${org}/repos?per_page=100&sort=updated`); }
    catch (e2) {
      return { runId: 'owners-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19),
               org, account, error: e2.code || 'GITHUB_ERROR', detail: e2.message,
               owners: [], considered: [], today };
    }
  }
  // Rank by RELEVANCE, not recency. Sorting by push date read
  // zetamarkets/bullet-bs58 and a forked Slack GitHub Action - both zero stars,
  // both irrelevant - while zetamarkets/zeta-market-maker ("Market maker for
  // DEX") sat untouched. The comparator was broken too: it returned 1/-1 with
  // no 0 case, which is not a valid sort.
  const RELEVANT = /market[- ]?maker|keeper|liquidat|bot|sdk|client|crank|trade|exchange|indexer|program|abi/i;
  // For an OPERATOR, the fork is the thing they run - excluding forks skipped
  // dpi-keepers, which is the entire reason DPI is in the registry.
  const keepForks = !!(account && lookupICP(account)?.forkedAutomation);
  const live = repos
    .filter(r => keepForks || !r.fork)
    .map(r => ({ r, score: (RELEVANT.test(`${r.name} ${r.description || ''}`) ? 1000 : 0) + (r.stargazers_count || 0) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.r);
  say(`${org}: ${repos.length} repo(s); reading ${Math.min(4, live.length)} execution-relevant: ` +
      live.slice(0, 4).map(r => r.name).join(', '));

  const owners = [], considered = [], seen = new Set();

  for (const repo of live.slice(0, 4)) {
    let contributors = [];
    try { contributors = await gh(`/repos/${repo.full_name}/contributors?per_page=20`); }
    catch (e) { say(`${repo.full_name}: contributors unavailable (${e.code})`); continue; }
    if (!Array.isArray(contributors)) continue;
    say(`${repo.full_name}: ${contributors.length} contributor(s), pushed ${String(repo.pushed_at).slice(0, 10)}`);

    for (const c of contributors.slice(0, 10)) {
      if (seen.has(c.login) || /\[bot\]$/i.test(c.login)) continue;
      seen.add(c.login);

      let who;
      try { who = await gh(`/users/${c.login}`); }
      catch (e) { if (e.code === 'RATE_LIMITED') { say('rate limit reached - stopping, this run is INCOMPLETE'); return done(true); } continue; }

      const role = [who.bio, who.name, who.company].filter(Boolean).join(' | ');
      const rec = {
        handle: who.login, person: who.name || null, company: who.company || null,
        bio: who.bio || null, blog: who.blog || null, x: who.twitter_username || null,
        repo: repo.full_name, contributions: c.contributions,
        profile_url: who.html_url, repo_url: repo.html_url,
        role_text: role || null, observed: today, account, org
      };
      considered.push(rec);

      // The INFRA_ROLE test, in code, on text GitHub returned - not on a
      // model's opinion of it.
      if (!role || !INFRA_ROLE.test(role)) continue;
      if (GENERIC_OWNER.test(String(who.name || '').trim())) continue;

      // A company is not its own infrastructure owner. The GitHub account
      // "DPI Protocol" passed the role test because its NAME contains
      // "Protocol", which INFRA_ROLE matches. The org returned itself as the
      // person to contact.
      const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const self = [account, org].filter(Boolean).map(norm);
      const whoNorm = norm(who.name || who.login);
      if (self.some(x => x && whoNorm && (x === whoNorm || x.includes(whoNorm) || whoNorm.includes(x)))) {
        rec.rejected = 'this is the company account, not a person at the company';
        continue;
      }

      // EMPLOYMENT. An infrastructure role is not enough - it has to be an
      // infrastructure role AT THIS ACCOUNT. The first run returned a
      // freelancer and an engineer whose company is "Ferocia Services", both
      // from two commits to a forked Slack GitHub Action. Neither owns
      // anything at Zeta.
      const company = String(who.company || '').replace(/^@/, '').trim();
      const wantCo = String(account || org).toLowerCase().replace(/[^a-z0-9]/g, '');
      const gotCo  = company.toLowerCase().replace(/[^a-z0-9]/g, '');
      const selfEmployed = /\b(freelance|independent|self[- ]employed|consultant|contractor)\b/i.test(role);
      const employedHere = gotCo && (gotCo.includes(wantCo) || wantCo.includes(gotCo) ||
                                     gotCo.includes(String(org).toLowerCase()));
      if (selfEmployed || (company && !employedHere)) {
        rec.rejected = selfEmployed
          ? 'profile says freelance or independent - not an owner at this account'
          : `profile company is "${company}", not ${account || org}`;
        continue;
      }
      // No company at all is not proof of employment either - record it as a
      // weaker claim rather than a verified owner.
      rec.employment = employedHere ? 'stated on their profile' : 'not stated - contributor only';

      owners.push({ ...rec,
        confidence: rec.employment === 'stated on their profile' ? 'verified' : 'contributor-only',
        evidence: role,
        why: `GitHub profile for a contributor to ${repo.full_name} names an infrastructure role`,
        verified: 'name and role as written on the GitHub profile on ' + today });
      say(`OWNER: ${who.name || who.login} - ${role}`, { entity: who.login });
    }
  }
  return done(false);

  function done(incomplete) {
    say(`${owners.length} infrastructure owner(s) from ${considered.length} contributor(s) considered`);
    return { org, account, owners, considered, incomplete, today,
             runId: 'owners-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) };
  }
}
