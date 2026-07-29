// Extraction.
//
// The fee earner writes or dictates what happened on the call, in their own
// words. This reads that account and pulls out the facts a document will need.
//
// The rule that governs everything here: it reports what was said, and nothing
// else. A fee basis nobody mentioned comes back as unstated, not as a sensible
// guess. Every value carries the phrase it came from, so a person confirming it
// can see exactly why the system thinks that.
//
// Hard facts are not extracted. Legal names, addresses and reference numbers are
// typed, because a misheard postcode is a wrong postcode and the time saved is
// seconds.

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';

function parseJson(text) {
  if (!text) return null;
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch (_) { /* continue */ }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a !== -1 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch (_) { /* continue */ }
  }
  return null;
}

async function call(params) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  const anthropic = new Anthropic({ apiKey: key, timeout: 25000, maxRetries: 0 });
  let last;
  for (let i = 0; i < 2; i += 1) {
    try { return await anthropic.messages.create(params); } catch (err) {
      last = err;
      const s = err?.status;
      if (!(!s || s === 429 || s >= 500) || i === 1) break;
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  throw new Error(`Reading the notes failed: ${last?.message || 'unknown error'}`);
}

export async function extractFromNarrative({ narrative, fields, knownValues = {}, firmName }) {
  if (!narrative || narrative.trim().length < 30) {
    return { ok: false, reason: 'too_short' };
  }
  if (!fields || fields.length === 0) {
    return { ok: true, found: [], unstated: [], summary: '' };
  }

  const wanted = fields
    .map((f) => `- ${f.key}: ${f.label}${f.hint ? ` (${f.hint})` : ''}`)
    .join('\n');

  const already = Object.entries(knownValues)
    .filter(([, v]) => String(v ?? '').trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const system = [
    `You read a fee earner's own notes from a client call at ${firmName} and pull out specific facts.`,
    '',
    'Absolute rules:',
    '1. Report only what the notes actually state. If a fact is not there, list it as unstated.',
    '2. Never infer, never assume a typical value, never round, never complete a partial figure.',
    '3. For every fact you report, quote the exact words from the notes that support it.',
    '4. If the notes are ambiguous about something, treat it as unstated and say why.',
    '5. Do not correct or improve what was written. Report it.',
    '6. An instruction about how the firm should act is a fact worth reporting: asking to',
    '   be contacted only by email, not to be telephoned at work, not to have post sent',
    "   home. Report those under standing_instructions, in the client's own terms.",
    '6. A property, premises or address mentioned in the notes is the subject of the work,',
    '   not where the client lives. Notes about a lease of Workshop 3 tell you the property,',
    "   they tell you nothing about the client's own address. Never report a client address,",
    '   or any part of one, from the notes: it is asked for directly and typed by hand.',
    '',
    'For dates, return ISO format (YYYY-MM-DD) only when the notes make the date unambiguous.',
    'For money, return digits only, without currency symbols or commas.',
    '',
    'Respond with JSON only, no preamble and no code fences:',
    '{"found":[{"key":"...","value":"...","quote":"the exact supporting words","confidence":0.0}],',
    ' "unstated":[{"key":"...","why":"short reason"}],',
    ' "summary":"one sentence describing the work, in the firm\'s register"}',
  ].join('\n');

  const user = [
    already ? `Already known, do not re-extract these:\n${already}\n` : '',
    'Facts to look for:',
    wanted,
    '',
    'The notes:',
    '"""',
    narrative.slice(0, 20000),
    '"""',
  ].join('\n');

  const res = await call({
    model: MODEL,
    max_tokens: 3000,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const raw = (res.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  const parsed = parseJson(raw);
  if (!parsed) return { ok: false, reason: 'unparseable' };

  const allowed = new Set(fields.map((f) => f.key));
  const numeric = new Set(fields.filter((f) => f.numeric).map((f) => f.key));

  // Only accept a value if the quote it claims to rest on is actually in the
  // notes. A fabricated quote is the clearest possible signal to reject a value.
  const hay = narrative.toLowerCase().replace(/\s+/g, ' ');
  const found = [];
  for (const f of parsed.found || []) {
    if (!f || !allowed.has(f.key)) continue;
    const value = String(f.value ?? '').trim();
    if (!value) continue;

    const quote = String(f.quote || '').trim();
    const grounded = quote.length > 3
      && hay.includes(quote.toLowerCase().replace(/\s+/g, ' ').slice(0, 60));

    if (!grounded) continue;

    found.push({
      key: f.key,
      value: numeric.has(f.key) ? value.replace(/[^0-9.]/g, '') : value,
      quote,
      confidence: typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.7,
      numeric: numeric.has(f.key),
    });
  }

  const foundKeys = new Set(found.map((f) => f.key));
  const unstated = fields
    .filter((f) => !foundKeys.has(f.key) && !String(knownValues[f.key] ?? '').trim())
    .map((f) => {
      const declared = (parsed.unstated || []).find((u) => u?.key === f.key);
      return { key: f.key, label: f.label, why: declared?.why || 'Not mentioned in the notes' };
    });

  return {
    ok: true,
    found,
    unstated,
    summary: String(parsed.summary || '').slice(0, 400),
  };
}
