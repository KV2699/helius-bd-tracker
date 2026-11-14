// THE HUMAN HANDOFF.
//
// This is the last step and the most constrained one. The system never sends
// anything, and nothing here changes that: it prepares a packet a human reads,
// approves or rejects, and - if they approve - sends from their own mail client.
// There is no mail server in this project by design.
//
// What it refuses to do matters more than what it produces:
//   - it never invents a recipient. No guessed name@company.com, ever. If no
//     verified contact exists, the packet says so and the next action is to
//     find one.
//   - it never claims the company wants to buy. The counter-rationale travels
//     with the draft and is shown above it, not buried.
//   - it never drafts from a third-party listing alone. An opportunity whose
//     surface is not yet verified is a real opportunity (that is the two-flag
//     rule) but it is not ready for an approach: you cannot write to a company
//     about its infrastructure having read only somebody else's directory
//     entry. Those packets carry blockers and no draft.
//   - every claim in the draft quotes the company's own page, with the url.
import { PRODUCTS } from './products.js';

export const BLOCKER = {
  NO_CONTACT:        'No verified contact. Find the infrastructure owner first - never guess an address.',
  SURFACE_UNVERIFIED:'Surface not yet verified. Read a page this company publishes before writing to them.',
  NO_QUOTE:          'No grounded quote. An approach with no evidence from their own words is a cold pitch.',
  CEASED:            'Company status is not active. Do not approach.'
};

/* One packet per opportunity. Returns the draft only when it is defensible. */
export function outreachPacket(row, { account = null } = {}) {
  const name = row.account;
  const product = PRODUCTS[row.primary_product]?.name || row.primary_product || 'Helius';
  const blockers = [];

  if (!row.surface_verified) blockers.push(BLOCKER.SURFACE_UNVERIFIED);
  if (!row.quote) blockers.push(BLOCKER.NO_QUOTE);
  if (account?.status && account.status !== 'active') blockers.push(BLOCKER.CEASED);

  // A contact is only ever one the registry recorded and verified. There is no
  // fallback and no pattern-built address.
  const owners = (account?.owners || []).filter(o => o.name && o.verified);
  const to = owners.length ? owners[0] : null;
  if (!to) blockers.push(BLOCKER.NO_CONTACT);

  const packet = {
    id: `outreach-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    account: name,
    kind: 'Outreach email',
    product: row.primary_product,
    product_name: product,
    segment: row.segment_label || row.segment || null,
    confidence: row.confidence || null,
    surface_verified: !!row.surface_verified,
    identity_confirmed: row.identity_confirmed !== false,
    // What a human must read BEFORE the draft.
    evidence: { quote: row.quote || null, source: row.source || null,
                date: row.date || null, date_basis: row.date_basis || null },
    counter_rationale: row.counter_rationale,
    recipient: to ? { name: to.name, title: to.title || null, basis: to.basis || null } : null,
    recipient_address: null,          // the human supplies this, always
    blockers,
    ready: blockers.length === 0,
    next_action: row.next_action,
    approval: null,                   // null = needs a human; true/false = settled
    draft: null
  };

  if (packet.ready) packet.draft = draftFor(packet, row);
  return packet;
}

/* The draft. Short, quotes their own page, names the product, asks a question.
   It does not assert need and it does not ask for a purchase. */
export function draftFor(packet, row) {
  const name = packet.account;
  const q = String(row.quote || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  return {
    subject: `${packet.product_name} on Solana - a question about ${name}'s setup`,
    body: [
      `Hi ${packet.recipient?.name?.split(' ')[0] || 'there'},`,
      ``,
      `I work on infrastructure at Helius. I was reading ${name}'s own documentation and`,
      `this line stood out:`,
      ``,
      `  "${q}"`,
      `  - ${packet.evidence.source}`,
      ``,
      `That is the kind of path ${packet.product_name} is built for. I am not assuming you`,
      `need it - I would just like to understand how you handle it today, and whether`,
      `it is currently costing you anything.`,
      ``,
      `Happy to share what we see across other ${packet.segment || 'Solana'} teams either way.`,
      ``,
      `- sent by a human at Helius`
    ].join('\n'),
    // Shown under the draft in the interface, so the reader cannot miss it.
    caveat: packet.counter_rationale
  };
}

export function buildOutreach(funnelRows, { accounts = [] } = {}) {
  const byName = new Map(accounts.map(a => [String(a.name).toLowerCase(), a]));
  const opportunities = funnelRows.filter(r => r.state === 'opportunity');
  const packets = opportunities.map(r =>
    outreachPacket(r, { account: byName.get(String(r.account).toLowerCase()) || null }));
  return {
    kind: 'outreach',
    generatedAt: new Date().toISOString(),
    counts: {
      opportunities: opportunities.length,
      ready_for_a_human_to_approve: packets.filter(p => p.ready).length,
      blocked: packets.filter(p => !p.ready).length,
      blocked_no_contact: packets.filter(p => p.blockers.includes(BLOCKER.NO_CONTACT)).length,
      blocked_surface: packets.filter(p => p.blockers.includes(BLOCKER.SURFACE_UNVERIFIED)).length
    },
    packets,
    rules: [
      'The system never sends anything. A human approves, then sends from their own mail client.',
      'No recipient is ever invented. A packet with no verified contact carries a blocker instead.',
      'Every draft quotes the company\'s own page and cites the url.',
      'The counter-rationale is shown above the draft, never hidden.',
      'No draft claims the company intends to buy anything.'
    ]
  };
}
