// HX-GA2, as an agent rather than a prompt somebody runs once.
//
// The finding this exists to act on: every perp DEX in the registry documents
// keeper bots or market makers that it DOES NOT OPERATE. Velocity names
// Liquidator, JIT Maker and Order Trigger; Flint says "makers run their own
// quoting logic". The protocol is rarely the buyer - the operator is, and the
// operator has no Helius relationship, its own budget, and an acute documented
// landing dependency.
//
// The same evidence rules apply as everywhere else: the operator name must
// appear in a page WE FETCHED, or it does not exist.
import { fetchSource } from './fetch.js';
import { ICP, lookupICP } from './icp.js';
import { quoteIsGrounded } from './verify.js';
import { REASON, NEAR } from './config.js';

// First run of this agent returned "Liquidation bot", "Keeper bots", "Makers",
// Helius itself, and seven Flint employees - all grounded, none of them an
// operator. A ROLE is not an organisation and a member of staff is not a third
// party, so both are rejected in code rather than asked for politely.
// Tokenise and test EVERY word. A first attempt used one big pattern and let
// "JIT maker bot" and "Makers" through, because the suffix only matched once.
// If every word in the name is a role word, the name is a role.
const ROLE_WORD = /^(the|a|an|keeper|keepers|liquidator|liquidators|liquidation|jit|order|trigger|triggers|matching|match|market|maker|makers|making|filler|fillers|crank|cranks|bot|bots|operator|operators|agent|agents|service|services|node|nodes|automation)$/i;
const isRoleNotOrg = name => {
  const words = String(name || '').trim().split(/[\s-]+/).filter(Boolean);
  return words.length > 0 && words.every(w => ROLE_WORD.test(w));
};

// A person listed under Team / Founder on the protocol's OWN page is staff.
// That is a contact discovery, which is valuable - it is just not this agent's
// job, so it is routed to the contact queue instead of being thrown away.
const STAFF_CONTEXT = /\b(founder|co-?founder|team|ceo|cto|coo|engineer|head of|director|advisor|chief)\b/i;
const looksLikePerson = name => {
  const w = String(name || '').trim().split(/\s+/);
  return w.length >= 2 && w.length <= 4 && w.every(x => /^[A-Z][a-z'’-]+$/.test(x));
};

export const OPERATOR_AGENT = {
  system: (today) => `You are an operator-discovery analyst for Helius BD. TODAY IS ${today}.

A protocol documents automation it does not run itself - keeper bots, liquidators,
JIT makers, order triggers, or market makers quoting on its venue. Your job is to
find the OPERATORS named in the page, because they are the parties who actually
submit the transactions and feel the landing pain.

HARD RULES
- Return ONLY operators NAMED IN THE PAGE TEXT below. A repository URL, a GitHub
  org, a Discord handle, a company name, a maker name - all count, if the page
  says it.
- The quote must be a VERBATIM span from the page, 20-200 characters, containing
  or directly introducing the operator name. Code will search the page for it.
- Do NOT list the protocol itself as its own operator.
- Do NOT infer operators from your own knowledge. If the page names none, return
  an empty list. An empty result is correct and expected on most pages.
- Do NOT invent a URL. Only return a URL that appears in the page text.

Return JSON exactly:
{"operators":[{
  "name":"operator, org, repo or maker name exactly as written in the page",
  "kind":"liquidator | jit_maker | order_trigger | matching | market_maker | bot_framework | unknown",
  "surface_url":"a URL for the operator that APPEARS IN THE PAGE, or null",
  "quote":"VERBATIM span from the page, 20-200 chars, naming them",
  "landing_dependency":"one sentence on what this operator must submit on-chain, from the page only"
}]}

If the page names no third-party operator, return {"operators":[]}.`,

  user: ({ protocol, url, pageText }) =>
    `PROTOCOL: ${protocol}\nSOURCE URL: ${url}\n\nPAGE TEXT:\n"""\n${pageText}\n"""`
};

// Pages worth asking. A protocol's automation docs are where operators get named.
function operatorSurfaces(account) {
  return (account.surfaces || [])
    .filter(s => s.status === 'verified')
    .filter(s => s.kind === 'docs' || s.kind === 'blog' || s.kind === 'company' || s.kind === 'site');
}

export async function discoverOperators({ ai, accounts = null, onEvent = () => {} }) {
  const today = new Date().toISOString().slice(0, 10);
  const say = (msg, extra = {}) => onEvent({ stage: 'operators', msg, ...extra });

  // Only protocols that document automation they do not run.
  const targets = (accounts || ICP).filter(a =>
    !a.blocked && operatorSurfaces(a).length &&
    /keeper|bot|liquidat|maker|automation|quoting/i.test(`${a.why || ''} ${a.note || ''}`));

  const operators = [], contacts = [], skipped = [], errors = [];
  say(`scanning ${targets.length} protocol(s) that document automation they do not operate`);

  for (const acct of targets) {
    for (const sf of operatorSurfaces(acct)) {
      const src = await fetchSource(sf.url);
      if (!src.ok) { skipped.push({ account: acct.name, url: sf.url, reason: 'SOURCE_UNREACHABLE', detail: src.error }); continue; }

      let out;
      try {
        out = await ai.json('operators', {
          system: OPERATOR_AGENT.system(today),
          user: OPERATOR_AGENT.user({ protocol: acct.name, url: src.url, pageText: src.modelText }),
          model: NEAR.models.light, maxTokens: 3000
        });
      } catch (e) {
        errors.push({ account: acct.name, url: sf.url, reason: e.code || 'INFERENCE_FAILED', detail: e.message });
        continue;
      }

      const list = Array.isArray(out.parsed?.operators) ? out.parsed.operators : [];
      for (const o of list) {
        if (!o?.name || String(o.name).trim().length < 2) {
          skipped.push({ account: acct.name, url: src.url, reason: 'NO_NAMED_ENTITY' }); continue;
        }
        // Same gate as everywhere else: the quote must be in the page we fetched.
        if (!quoteIsGrounded(o.quote, src.pageText)) {
          skipped.push({ account: acct.name, operator: o.name, url: src.url,
                         reason: 'QUOTE_NOT_IN_SOURCE', message: REASON.QUOTE_NOT_IN_SOURCE }); continue;
        }
        // The operator's own name must appear in the page, not only in the quote
        // the model chose to return.
        if (!src.pageText.toLowerCase().includes(String(o.name).toLowerCase().slice(0, 24))) {
          skipped.push({ account: acct.name, operator: o.name, url: src.url,
                         reason: 'NO_NAMED_ENTITY', message: 'operator name not found in the fetched page' }); continue;
        }
        const nm = String(o.name).trim();

        // A role is not a company. "Liquidation bot" is a job, not a buyer.
        if (isRoleNotOrg(nm)) {
          skipped.push({ account: acct.name, operator: nm, url: src.url, reason: 'NO_NAMED_ENTITY',
                         message: 'a bot role, not an organisation' }); continue;
        }
        // We are not our own prospect.
        if (/^helius/i.test(nm)) {
          skipped.push({ account: acct.name, operator: nm, url: src.url, reason: 'BLOCKED_ALIAS',
                         message: 'Helius is the seller' }); continue;
        }
        // Staff on the protocol's own page: a CONTACT, not an operator.
        if (looksLikePerson(nm) && STAFF_CONTEXT.test(o.quote || '')) {
          contacts.push({ person: nm, org: acct.name, quote: o.quote, source_url: src.url,
                          observed: today, basis: 'named on the organisation\'s own page',
                          status: 'VERIFIED - primary source',
                          note: 'Title and employer as written in the fetched page. Confirm the title is current before outreach.' });
          say(`contact: ${nm} at ${acct.name}`, { entity: nm });
          continue;
        }

        // A URL the model returns is only kept if the page actually contains it.
        const surface = o.surface_url && src.pageText.includes(String(o.surface_url).replace(/^https?:\/\//, '').split('/')[0])
          ? o.surface_url : null;
        // The protocol is not its own operator.
        if (lookupICP(o.name)?.name === acct.name) {
          skipped.push({ account: acct.name, operator: o.name, reason: 'DUPLICATE',
                         message: 'protocol returned as its own operator' }); continue;
        }

        operators.push({
          operator: String(o.name).trim(),
          kind: o.kind || 'unknown',
          protocol: acct.name,
          source_url: src.url,              // the page WE fetched, never the model's
          surface_url: surface,
          observed: today,
          quote: o.quote,
          landing_dependency: o.landing_dependency || '',
          stream: 'B',
          already_in_registry: !!lookupICP(o.name),
          contact: 'UNVERIFIED - run HX-GA1 against the operator'
        });
        say(`operator: ${o.name} (${o.kind}) via ${acct.name}`, { entity: o.name });
      }
      if (!list.length) say(`${acct.name}: no third-party operator named on ${src.url}`);
    }
  }

  const fresh = operators.filter(o => !o.already_in_registry);
  say(`${operators.length} grounded operator(s), ${fresh.length} new, ${contacts.length} named contact(s), ${skipped.length} rejected with a reason`);
  return {
    runId: 'operators-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19),
    generatedAt: new Date().toISOString(),
    operators, fresh, contacts, skipped, errors,
    scanned: targets.map(t => t.name),
  };
}
