// The only inference path in this project. Every agent call goes through here,
// every call is metered, and the ledger is written from the API's own usage
// numbers - never estimated.
import { NEAR } from './config.js';

// Prices come from NEAR AI's own /models catalogue, fetched once per run.
// Never hardcoded, never estimated - a stale constant would make the ledger a
// lie, and the ledger is the one number this project asks to be believed.
let PRICES = null;   // { 'model-id': {input, output} } per 1M tokens

export async function loadPrices() {
  if (PRICES) return PRICES;
  try {
    const r = await fetch(`${NEAR.baseUrl}/models`, { headers: { Authorization: `Bearer ${NEAR.apiKey}` } });
    if (!r.ok) return (PRICES = {});
    const j = await r.json();
    PRICES = {};
    for (const m of j.data || []) {
      if (m.pricing) PRICES[m.id] = { input: Number(m.pricing.input), output: Number(m.pricing.output) };
    }
    return PRICES;
  } catch { return (PRICES = {}); }
}
const priceFor = model => (PRICES && PRICES[model]) || null;

export class Ledger {
  constructor(runId, budgetUsd) {
    this.runId = runId;
    this.budgetUsd = budgetUsd;
    this.lines = [];
  }
  record(agent, model, usage, ms) {
    const inTok  = usage?.prompt_tokens ?? 0;
    const outTok = usage?.completion_tokens ?? 0;
    const p = priceFor(model);
    const usd = p ? (inTok / 1e6) * p.input + (outTok / 1e6) * p.output : null;
    this.lines.push({ agent, model, inTok, outTok, usd, ms, priceIn: p?.input ?? null, priceOut: p?.output ?? null });
    return usd;
  }
  get totals() {
    const t = this.lines.reduce((a, l) => ({
      inTok: a.inTok + l.inTok,
      outTok: a.outTok + l.outTok,
      usd: l.usd == null ? a.usd : (a.usd ?? 0) + l.usd,
      ms: a.ms + l.ms
    }), { inTok: 0, outTok: 0, usd: null, ms: 0 });
    return { ...t, calls: this.lines.length, priced: this.lines.some(l => l.usd != null) };
  }
  // Hard stop. A runaway loop must not quietly eat a $10 hackathon grant.
  overBudget() {
    const { usd } = this.totals;
    return this.budgetUsd != null && usd != null && usd >= this.budgetUsd;
  }
}

export class NearAI {
  constructor(ledger) {
    if (!NEAR.apiKey) {
      throw new Error(
        'NEAR_AI_API_KEY is not set. This pipeline runs inference only on NEAR AI Cloud ' +
        'and has no fallback. Claim a key at https://cloud.near.ai (free $10 via ' +
        'https://nearbuilders.org/join) and export NEAR_AI_API_KEY before running.'
      );
    }
    this.ledger = ledger;
  }

  // One call. Returns parsed JSON or throws - never a half-understood string.
  async json(agent, { system, user, model = NEAR.models.light, maxTokens = 6000 }) {
    if (this.ledger.overBudget()) {
      throw new Error(`Budget stop: ledger has reached $${this.ledger.budgetUsd}. Run aborted before calling ${agent}.`);
    }
    const started = Date.now();
    const res = await fetch(`${NEAR.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NEAR.apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' }
      })
    });

    const ms = Date.now() - started;
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const err = new Error(`NEAR AI ${res.status} on ${agent}: ${body.slice(0, 400)}`);
      err.code = 'INFERENCE_FAILED';
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    this.ledger.record(agent, model, data.usage, ms);

    const finish = data.choices?.[0]?.finish_reason;
    const text = data.choices?.[0]?.message?.content ?? '';

    if (finish === 'length' && !text.trim()) {
      const e = new Error(`OUTPUT_TRUNCATED on ${agent}: used all ${maxTokens} output tokens without emitting content` +
        (data.usage?.completion_tokens_details?.reasoning_tokens ? ' (all spent on reasoning)' : ''));
      e.code = 'OUTPUT_TRUNCATED';
      throw e;
    }

    try {
      return { parsed: JSON.parse(text), raw: text, usage: data.usage };
    } catch {
      // Models routinely append a stray brace or a trailing note after valid
      // JSON. A greedy /\{[\s\S]*\}/ inherits that garbage, so walk the string
      // and stop at the brace that balances the first one.
      const obj = firstBalancedObject(text);
      if (obj) { try { return { parsed: JSON.parse(obj), raw: text, usage: data.usage }; } catch {} }
      const e = new Error(`MALFORMED_JSON from ${agent} (finish=${finish}, out=${data.usage?.completion_tokens})`);
      e.code = 'MALFORMED_JSON';
      e.raw = text;
      throw e;
    }
  }
}

/* Returns the first complete {...} in a string, ignoring braces inside string
   literals and anything that follows the balancing brace. */
export function firstBalancedObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}
