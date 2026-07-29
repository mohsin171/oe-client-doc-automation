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
import { modelFor } from './models.js';
import { canonicalKey, isNotAValue } from './fields.js';

// Which model does which job, and why, is in lib/models.js.

// JSON that is nearly right.
//
// A model asked for JSON produces JSON, and then produces something that is not quite
// JSON: a bare NaN where it found no number, a trailing comma, a stray line of prose
// before the brace. JSON.parse rejects all of it, and the whole reading fails on a
// character. Worth being generous here, because the alternative is telling a fee earner
// to rephrase notes that were perfectly clear.
function parseJson(text) {
  if (!text) return null;

  const tidy = (raw) => raw
    // Bare NaN, Infinity and undefined are not JSON. A model writes NaN where it found
    // no number, which is exactly the case this has to survive.
    .replace(/:\s*NaN\b/g, ': null')
    .replace(/:\s*-?Infinity\b/g, ': null')
    .replace(/:\s*undefined\b/g, ': null')
    // A trailing comma before a closing brace or bracket.
    .replace(/,(\s*[}\]])/g, '$1');

  const attempts = [];
  const t = String(text).trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  attempts.push(t, tidy(t));

  // Whatever sits between the first brace and the last, in case there is preamble.
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a !== -1 && b > a) {
    const slice = t.slice(a, b + 1);
    attempts.push(slice, tidy(slice));
  }

  for (const attempt of attempts) {
    try { return JSON.parse(attempt); } catch (_) { /* try the next */ }
  }

  // Nothing worked. Say what came back, because "could not read those notes" sent
  // somebody rewriting notes that were fine.
  console.warn('extraction: could not parse the reply. First 300 characters:',
    String(text).slice(0, 300));
  return null;
}

async function call(params) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  // Twenty five seconds was tuned for Haiku. Sonnet writes the same answer more slowly,
  // and reading a set of notes against sixteen fields with a quotation for each is not a
  // small answer. The function itself is allowed sixty.
  const anthropic = new Anthropic({ apiKey: key, timeout: 50000, maxRetries: 0 });
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
    '6. matter_subject is the line that goes after Re: on the letter, so write it as a',
    '   heading a firm would type: a short noun phrase, with no verb and no third person.',
    '   Sale of 14 Sandhill Oval. Settlement agreement with Cawthorne Fabrications. Estate',
    '   of Dorothy Vasey deceased. Not review and advice on a settlement agreement offered',
    '   by the client\'s employer, which is how a file note reads rather than a letter.',
    '7. An instruction about how the firm should act is a fact worth reporting: asking to',
    '   be contacted only by email, not to be telephoned at work, not to have post sent',
    '   home. Report those under standing_instructions, in the client\'s own terms.',
    '8. A property, premises or address mentioned in the notes is the subject of the work,',
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
    model: modelFor('extract'),
    max_tokens: 3000,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const raw = (res.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  const parsed = parseJson(raw);
  if (!parsed) {
    // Nothing was wrong with the notes. Something was wrong with the reply, or the reply
    // never arrived, and telling a fee earner to rephrase perfectly clear notes is both
    // useless and insulting.
    return { ok: false, reason: 'unparseable', got: String(raw).slice(0, 200) };
  }

  const allowed = new Set(fields.map((f) => f.key));
  const numeric = new Set(fields.filter((f) => f.numeric).map((f) => f.key));

  // Ways a model says "I could not find this" while appearing to answer. Any of them
  // stored as a value turns a gap into a fact, which is the one thing this must never
  // do. A field recorded as "nan" is worse than an empty one: nothing blocks on it and
  // it prints.
  const hay = narrative.toLowerCase().replace(/\s+/g, ' ');
  const found = [];
  const rejected = [];

  for (const f of parsed.found || []) {
    if (!f || !allowed.has(f.key)) continue;
    const raw = String(f.value ?? '').trim();
    if (!raw) continue;

    // One list of non-answers, shared with the form, so a placeholder is rejected the
    // same way whether a model produced it or a person typed it to escape a question.
    if (isNotAValue(raw)) {
      rejected.push({ key: f.key, why: 'the model answered with a placeholder for absence' });
      continue;
    }

    // Only accept a value if the quotation it claims to rest on is really in the notes.
    // A fabricated quotation is the clearest possible signal to reject a value.
    const quote = String(f.quote || '').trim();
    const grounded = quote.length > 3
      && hay.includes(quote.toLowerCase().replace(/\s+/g, ' ').slice(0, 60));
    if (!grounded) {
      rejected.push({ key: f.key, why: 'the quotation it cited is not in the notes' });
      continue;
    }

    const value = numeric.has(f.key) ? raw.replace(/[^0-9.]/g, '') : raw;
    if (!value) {
      rejected.push({ key: f.key, why: 'nothing numeric in the value' });
      continue;
    }

    // And for a figure, the figure itself has to be in the notes.
    //
    // Verifying the quotation was not enough: it proved the model had read something
    // real, not that the number came from it. A letter came back with an hourly rate of
    // 200 on a matter where a fixed fee of 1,450 was agreed, supported by a quotation
    // that existed and did not contain 200. A number nobody wrote down is exactly the
    // thing this system exists to prevent.
    if (numeric.has(f.key)) {
      const digits = value.replace(/[^0-9]/g, '');
      const bare = hay.replace(/[,\s]/g, '');
      if (digits.length > 0 && !bare.includes(digits)) {
        rejected.push({ key: f.key, why: `the figure ${value} does not appear in the notes` });
        continue;
      }
    }

    found.push({
      key: f.key,
      value,
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
