// Widened owner discovery. GitHub profiles are necessary but not sufficient:
// filipzeta contributes to zeta-market-maker and zeta-abi and is plainly a Zeta
// employee, but the profile carries no bio, name or company, so it cannot clear
// the bar. The role is usually written somewhere else.
//
// Every source below must be DECLARED BY A PAGE THE ACCOUNT OWNS. No guessed
// careers URLs, no inferred LinkedIn, no scraped X.
import { fetchSource } from './fetch.js';
import { INFRA_ROLE } from './score.js';
import { ICP, lookupICP } from './icp.js';

const GENERIC_OWNER = /^(the )?(exchange|platform|protocol|team|company|project|dao|labs|foundation|core|engineering|contributors?|maintainers?)$/i;

// A person is Firstname Lastname, or a handle credited with a role.
const PERSON = /\b([A-Z][a-z'’-]{1,20}(?:\s+[A-Z][a-z'’-]{1,20}){1,2})\b/g;

// Roles a careers page advertises when it is hiring the person we want.
export const INFRA_ROLE_POSTING =
  /\b(infrastructure|platform|protocol|trading systems?|execution|reliability|sre|devops|backend|systems?) (engineer|developer|lead|manager|architect)\b|\bhead of (infrastructure|platform|engineering|protocol|trading)\b|\b(staff|senior|principal) (solana|blockchain|protocol|infrastructure|platform) engineer\b/i;

// README URLs come from the GitHub org + repo name, which we already hold as
// facts. raw.githubusercontent.com is not on the API rate limit, so READMEs
// stay readable when the API budget is gone.
async function readme(org, repo) {
  for (const branch of ['main', 'master']) {
    try {
      const r = await fetch(`https://raw.githubusercontent.com/${org}/${repo}/${branch}/README.md`,
                            { headers: { 'User-Agent': 'helius-bd-tracker' } });
      if (r.ok) return { text: await r.text(), url: `https://github.com/${org}/${repo}#readme`, branch };
    } catch { /* try the other branch */ }
  }
  return null;
}

// A team listing is STRUCTURAL, not textual: one short line that is ONLY a
// person's name, sitting next to a short line that is ONLY a role.
//
// Matching "a block containing a role and two capitalised words" read
// "Trading Specifications" and "Our Mission" as people. Navigation is full of
// capitalised word pairs; a name line is not.
const NAME_LINE = /^[A-Z][a-z'’-]{1,18}(?:\s+[A-Z][a-z'’.-]{1,18}){1,2}$/;
const ROLE_LINE = /^[^.]{3,60}$/;

function isName(line) {
  if (!NAME_LINE.test(line)) return false;
  if (GENERIC_OWNER.test(line)) return false;
  // A role phrase can look exactly like a name: "Software Engineer",
  // "Trading Specifications", "Chief Technology".
  if (INFRA_ROLE.test(line)) return false;
  if (/^(Co|Founder|Chief|Head|Senior|Staff|Principal|Software|Team|Prev|Our|Start|Official|Trading|Exchange|Bridging|Rewards|Learn|Mobile|Welcome|New|Keeper|Bot|Ecosystem|Velocity|Zeta|Discord|Search|Contributing|Developers?|Automation|Specifications?|Guide|Programs?|Links?|Mission|Vision|Here|Capital|Transaction|Concepts)\b/i.test(line)) return false;
  return true;
}

function creditsIn(text) {
  const out = [], seen = new Set();
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    if (!isName(lines[i])) continue;
    // The role sits within two lines either side - above it as a section label
    // ("Founder"), or below it as the title ("Co-Founder, CTO").
    const near = [lines[i - 2], lines[i - 1], lines[i + 1], lines[i + 2]].filter(Boolean);
    const roleLine = near.find(l => ROLE_LINE.test(l) && INFRA_ROLE.test(l));
    if (!roleLine) continue;

    const key = lines[i].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ names: [lines[i]], handles: [],
               role: roleLine.trim().slice(0, 60),
               roleTerm: (String(roleLine).match(INFRA_ROLE) || [null])[0],
               line: [lines[i - 1], lines[i], lines[i + 1], lines[i + 2]].filter(Boolean).join(' · ').slice(0, 220) });
  }
  return out;
}

export async function findPeople(accountName, { onEvent = () => {} } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const say = (msg, extra = {}) => onEvent({ stage: 'people', msg, ...extra });
  const acct = lookupICP(accountName) || ICP.find(a => a.name.toLowerCase() === String(accountName).toLowerCase());
  if (!acct) return { account: accountName, error: 'NOT_IN_REGISTRY' };

  const found = [], checked = [], hiring = [];

  // 1. Account-owned pages: careers, team, about, status, blog.
  for (const sf of (acct.surfaces || []).filter(s => s.status === 'verified')) {
    const src = await fetchSource(sf.url, { skipWhitelist: true });
    if (!src.ok) { checked.push({ url: sf.url, result: 'unreachable: ' + src.error }); continue; }

    const credits = creditsIn(src.pageText);
    checked.push({ url: src.url, kind: sf.kind, chars: src.pageText.length, credits: credits.length });

    for (const c of credits)
      found.push({ account: acct.name, source: src.url, basis: 'named with a role on a page the account owns',
                   line: c.line, names: c.names, handles: c.handles,
                   role: c.role, roleTerm: c.roleTerm, observed: today });

    // A careers page advertising the role tells you the function exists even
    // when no individual is named - that is a real research route, not an owner.
    if (INFRA_ROLE_POSTING.test(src.pageText)) {
      const m = src.pageText.match(INFRA_ROLE_POSTING);
      hiring.push({ account: acct.name, source: src.url, role: m[0], observed: today,
                    why: 'the account is hiring for this function - apply through the posting owner, not a guessed name' });
      say(`${acct.name}: hiring for "${m[0]}" - ${src.url}`, { entity: acct.name });
    }
  }

  // 2. READMEs of the account's own execution repos.
  if (acct.github) {
    for (const repo of (acct.repos || [])) {
      const rd = await readme(acct.github, repo);
      if (!rd) { checked.push({ url: `${acct.github}/${repo}`, result: 'no README' }); continue; }
      const credits = creditsIn(rd.text);
      checked.push({ url: rd.url, kind: 'readme', chars: rd.text.length, credits: credits.length });
      for (const c of credits)
        found.push({ account: acct.name, source: rd.url, basis: 'credited in the repository README',
                     line: c.line, names: c.names, handles: c.handles,
                   role: c.role, roleTerm: c.roleTerm, observed: today });
      // Does the README say the account OPERATES this, or publishes it?
      const operates = /\bwe (run|operate|deploy|maintain)\b|\bour (bot|keeper|maker|infrastructure)\b/i.test(rd.text);
      const publishes = /\breference implementation\b|\bability to\b|\byou can\b|\bexample\b|\bgetting started\b/i.test(rd.text);
      if (operates || publishes)
        checked[checked.length - 1].stance = operates ? 'reads as operated by the account'
                                                      : 'reads as published for others to run';
    }
  }

  say(`${acct.name}: ${found.length} credited person/team, ${hiring.length} relevant posting(s), ${checked.length} surface(s) read`);
  return { account: acct.name, found, hiring, checked, today,
           runId: 'people-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) };
}
