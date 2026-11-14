# Seller profile — Helius, Sender

The ICP this build actually sells. One seller, one product, one buyer. Everything else in
the tracker is schema demonstration.

---

## The declared motion

| | |
|---|---|
| **Seller** | Helius — Solana infrastructure |
| **Product** | **Sender** — transaction landing |
| **Buyer** | Infrastructure lead at an exchange or trading firm |
| **Lens in the UI** | `trading` — *Trading & market making* (marked **primary motion**) |
| **Trigger class** | Settlement expansion · high-volume launch · new market-making activity |

### The one-line pitch

> For firms where landing the transaction *is* the product rather than a cost line.

---

## Why this motion and not one of the other five

The trigger-to-product link is the easiest to defend under questioning.

- A tokenised-equity catalogue tripling in size **is** more onchain transactions. That is
  arithmetic, not inference.
- Latency and landing rate are **measurable** — we can bring numbers to the first call
  instead of a deck.
- The buyer is **identifiable**: infrastructure leads at trading firms are findable and
  they answer technical outreach.

The weaker motions, and why they are roadmap only:

| Lens | Why it is not the demo motion |
|---|---|
| RWA & tokenised assets | Strong triggers, but the buyer is an operations committee, not one lead. Longer cycle. |
| Exchanges & custodians | Good fit, but most triggers are incidents, and pitching off an incident is distasteful and fails on the first call. |
| Stablecoin issuers | Validator/enterprise conversation, consortium-shaped, very long cycle. |
| Institutions & fintech | Declared-only lens. The evidence is thinner and we say so in the UI. |
| Protocol & infra teams | Alpenglow is real, but a network upgrade is not a procurement event. |

---

## Qualification

### What makes a row actionable for this motion

All four must hold:

1. A **named legal entity** with a Solana footprint.
2. A **dated event** with a verbatim quote and a primary URL.
3. The event plausibly **increases transaction volume or settlement surface**.
4. No **blocked alias** match (see the name-collision guard).

### What disqualifies it

- The event is an incident, an opinion, or a prediction.
- The entity is unconfirmed → **verification queue**, not the roster.
- The only source is a social post or a secondary aggregator.
- A raise below roughly $5M — the BD time costs more than the account can return.

### Hard rules we will not break

- **Never infer intent.** A press release cannot tell you what a company wants to buy.
- **Never read absence as a negative fact.** "No provider named in this source" is recorded
  as exactly that, not as "they have no provider."
- **Never pitch replacement off an incident.** If a company has just been hacked, we are
  not the people emailing them about RPC reliability.

---

## The counter-rationale rule

`counter` is **not optional** in the schema. A row cannot enter the store without a stated
reason it might not matter.

This is the single rule that stops the system turning

> *"Securitize expanded its onchain equity catalogue"*

into

> *"Securitize needs Helius infrastructure."*

The first is a fact with a URL. The second is a fabrication, and it is the fabrication
every ungoverned BD tool makes.

---

## The worked example, end to end

| Stage | Output |
|---|---|
| **Trigger** | Securitize expanded tokenised US equities on Solana to 25, USDC-settled, Jump supporting liquidity |
| **Source** | Securitize investor relations, 2 Nov 2026 — company IR, primary |
| **Verbatim** | *"…expanded its onchain U.S. stock offering to 25 equities, settled in USDC, with Jump Trading supporting liquidity."* |
| **Score** | 88 · Critical · `ACTIONABLE` |
| **Opens** | Sender, Webhooks, Data API, Enterprise |
| **Why it may matter** | More settlement surface puts weight on landing transactions reliably under load |
| **Why it may not** | They may already have infrastructure. No source names their current provider |
| **Before you call** | Find the engineering and institutional-operations owners; check for any public statement naming a provider |
| **Deliverables** | Pre-call brief → proposal → outreach email, all three drafted by the Writer agent |
| **Gate** | A human reads each one, may edit the wording, then approves or rejects |
| **Settlement** | $0.19 of agent work recorded on NEAR; the rail is priced, not wired |

---

## Fixture vs live — the boundary

```
Fixture mode proves the schema.
Live mode proves the collectors.
The views do not change between modes.
```

| Layer | Status |
|---|---|
| Schema | **Production-ready.** One shape, `counter` mandatory. |
| Six views | **Real.** Pure projections of one array. |
| Verifier + rejection log | **Real.** Six claims refused, with reasons. |
| Name-collision guard | **Real.** Helius Medical / HSDT / Solana Company blocked. |
| Approval gate | **Real.** Blocking, editable, and nothing can transmit. |
| Deliverable documents | **Real.** Printable report, proposal, email, settlement record. |
| The ten findings | **Fixture.** Real events and real URLs, but hand-entered. |
| Collector layer | **Not built.** |
| NEAR settlement | **Fixture.** Plausible numbers, not a live call. |

### Track selection

- **AI Swarms** — defensible. Eight agents coordinate, verify each other, produce one artefact.
- **Agent Economy** — defensible *with the caveat stated out loud*: the agents earn and
  spend, but they do not negotiate, hire one another, or hold a treasury.
- **Unstoppable DeFi** — **do not select** until the 1Click `dry:true` quote is wired to the
  live endpoint and demonstrably working. It is priced, not wired today.
