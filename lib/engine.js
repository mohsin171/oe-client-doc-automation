// The engine. This file is where the two non-negotiable safety rules live.
//
// Rule one:  the AI never fills a gap. A field with no value blocks generation.
// Rule two:  the AI never touches fixed clauses. They are merged by code here,
//            and are never included in any prompt with permission to rewrite.
//
// Three separate mechanisms, kept separate on purpose:
//   assembleFixed()  code only, no model
//   draftBespoke()   model writes only declared bespoke sections
//   reviewDraft()    a different pass reads the result as a critic
//
// Collapsing any two of these into one clever prompt is the change that would
// make this tool unsellable to a regulated firm. Do not do it.

import Anthropic from '@anthropic-ai/sdk';
import { canonicalKey } from './fields.js';

const MODEL = 'claude-haiku-4-5-20251001';

function client() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey: key, timeout: 25000, maxRetries: 0 });
}

// One retry, on transient failures only. A bad request is not worth repeating,
// and a rate limit or a network blip should not surface to a fee earner as an
// unexplained error halfway through generating a letter.
async function callModel(params, label) {
  const anthropic = client();
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await anthropic.messages.create(params);
    } catch (err) {
      lastErr = err;
      const status = err?.status;
      const transient = !status || status === 429 || status >= 500;
      if (!transient || attempt === 1) break;
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  throw new Error(`${label} failed: ${lastErr?.message || 'unknown error'}`);
}

// Robust JSON parse. Structured output modes have caused silent failures in this
// stack before, so the pattern is: ask for JSON in the system prompt, then parse
// defensively. Strip fences, slice the outermost braces, salvage by regex.
function parseJson(text) {
  if (!text) return null;
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(t);
  } catch (_) { /* fall through */ }
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(t.slice(first, last + 1));
    } catch (_) { /* fall through */ }
  }
  const arrFirst = t.indexOf('[');
  const arrLast = t.lastIndexOf(']');
  if (arrFirst !== -1 && arrLast > arrFirst) {
    try {
      return JSON.parse(t.slice(arrFirst, arrLast + 1));
    } catch (_) { /* fall through */ }
  }
  return null;
}

// ---------------------------------------------------------------
// 1. Deterministic assembly. No model involved at any point.
// ---------------------------------------------------------------

const PLACEHOLDER = /\{([a-z0-9_]+)\}/gi;

export function assembleFixed(definition, values, optional = new Set()) {
  const blocks = definition.blocks || [];
  const out = [];
  const unresolved = [];

  for (const block of blocks) {
    if (block.kind === 'fixed') {
      // Merged verbatim. Never paraphrased, never reordered, never dropped.
      out.push({ key: block.key, kind: 'fixed', body: block.body });
      continue;
    }

    if (block.kind === 'field') {
      let missing = false;

      // A subject line is a heading, not a summary. Templates often place the
      // scope field there because that is what the example letter contained,
      // which prints the whole description including anything written for the
      // file rather than for the client.
      const isSubjectLine = /^\s*(re|subject)\s*:/i.test(block.body || '')
        && (block.body || '').length < 180;
      const body = block.body.replace(PLACEHOLDER, (match, rawName) => {
        // Translate at the point of use, not only when the template was stored.
        // A template saved before a synonym was known still asks for the old
        // name, and nothing else downstream would ever reconcile it.
        let name = canonicalKey(rawName);
        if (isSubjectLine && (name === 'scope_summary' || name === 'matter_subject')) {
          name = values.matter_subject ? 'matter_subject' : name;
        }
        const v = values[name] !== undefined ? values[name] : values[rawName];
        if (v === undefined || v === null || String(v).trim() === '') {
          // A few values are legitimately absent: a fee earner with no recorded
          // grade, for instance. Those drop out rather than blocking the letter.
          // Mark the gap rather than blanking it, so only punctuation that
          // belonged to the removed value is cleaned up afterwards. Blanket
          // tidying eats legitimate commas, such as the one after a salutation.
          if (optional.has(name) || optional.has(rawName)) return '\u0000';
          missing = true;
          unresolved.push({ block: block.key, field: name });
          return match;
        }
        return String(v);
      });
      // Clean up only around the markers left by dropped optional values.
      const tidied = body
        .replace(/\s*,\s*\u0000/g, '')
        .replace(/\u0000\s*,\s*/g, '')
        .replace(/\u0000/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+([,.;:])/g, '$1')
        .trim();
      out.push({ key: block.key, kind: 'field', body: tidied, missing });
      continue;
    }

    if (block.kind === 'bespoke') {
      // Placeholder only at this stage. Filled by draftBespoke().
      out.push({ key: block.key, kind: 'bespoke', body: null, prompt: block.prompt });
    }
  }

  return { blocks: out, unresolved };
}

// ---------------------------------------------------------------
// 2. AI drafting, confined to declared bespoke sections.
// ---------------------------------------------------------------

export async function draftBespoke({ blocks, values, precedents, firmName }) {
  const bespoke = blocks.filter((b) => b.kind === 'bespoke');
  if (bespoke.length === 0) return blocks;

  const factLines = Object.entries(values)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const precedentText = (precedents || [])
    .map((p, i) => `Precedent ${i + 1} (${p.section_key || 'general'}):\n${p.body}`)
    .join('\n\n');

  const system = [
    `You draft bespoke sections of documents for ${firmName}, a professional services firm.`,
    '',
    'Absolute constraints:',
    '1. Use ONLY the facts supplied below. If a fact you would need is absent, write nothing that asserts it. Never invent a figure, a date, a name, or a term that is not given.',
    '   This includes quantities written as words. Do not tell the client something will take',
    '   "six to nine months" or "around three weeks" unless that was supplied. Write about what',
    '   the timing depends on instead. A sentence with no number is always better than a',
    '   commitment nobody made.',
    '2. Write in the voice and register of the supplied precedents.',
    '3. Do not add headings, salutations, sign-offs, or standard terms. Those are handled elsewhere.',
    '   If a fee estimate, cap or total is supplied, state it plainly in the fees section.',
    '   The firm\'s standard clauses refer back to the estimate, so leaving it out makes those',
    '   clauses point at nothing.',
    '4. Two or three short paragraphs per section unless the instruction says otherwise.',
    '',
    'Respond with JSON only, no preamble and no code fences, in this exact shape:',
    '{"sections":[{"key":"<section key>","body":"<the drafted text>"}]}',
  ].join('\n');

  const user = [
    'Facts available for this matter:',
    factLines || '(none supplied)',
    '',
    precedentText ? `The firm's own past wording, to match in tone:\n\n${precedentText}` : '',
    '',
    'Sections to draft:',
    ...bespoke.map((b) => `- key: ${b.key}\n  instruction: ${b.prompt}`),
  ].join('\n');

  const res = await callModel({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: user }],
  }, 'Drafting');

  const raw = (res.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  const parsed = parseJson(raw);
  const byKey = new Map((parsed?.sections || []).map((s) => [s.key, s.body]));

  return blocks.map((b) =>
    b.kind === 'bespoke'
      ? { ...b, body: byKey.get(b.key) || null, drafted: byKey.has(b.key) }
      : b
  );
}

// ---------------------------------------------------------------
// 3. Deterministic review rules. Run before the model sees anything.
// ---------------------------------------------------------------

// Checks the system evaluates itself, and can therefore clear itself. A person
// cannot mark one of these resolved by asserting it: they fix the letter, or
// they dismiss it with a reason that goes on the record.
export const VERIFIABLE_CHECKS = new Set([
  'placeholder_leak', 'empty_section', 'unexplained_figure', 'unstated_timescale',
  'dangling_estimate', 'fixed_block_present', 'numeric_consistency',
  'name_consistency', 'date_not_past', 'standard_clause_amended',
]);

export function isVerifiable(code) {
  return VERIFIABLE_CHECKS.has(String(code));
}


// Normalise a number for comparison: strip currency, commas and trailing zeros.
function normNum(raw) {
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  if (!cleaned || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? String(n) : null;
}

// Every number the matter record can account for, including the forms a
// document might reasonably render them in.
function knownNumbers(values) {
  const known = new Set();
  for (const v of Object.values(values)) {
    if (v === null || v === undefined) continue;
    for (const m of String(v).matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
      const n = normNum(m[0]);
      if (n) known.add(n);
    }
    // A date supplies its own parts, so 1 August 2026 does not read as three
    // unexplained figures.
    const d = new Date(v);
    if (!isNaN(d.getTime()) && /\d{4}/.test(String(v))) {
      known.add(String(d.getFullYear()));
      known.add(String(d.getMonth() + 1));
      known.add(String(d.getDate()));
    }
  }
  return known;
}

export function runDeterministicRules(definition, blocks, values) {
  const flags = [];
  const push = (code, severity, message, anchor) =>
    flags.push({ code, severity, message, anchor: anchor || null });

  // Text the firm did not pre-approve. Fixed clauses are excluded throughout:
  // their wording and their numbers are the firm's own, deliberately chosen.
  const openBlocks = blocks.filter((b) => b.kind !== 'fixed');
  const openText = openBlocks.map((b) => b.body || '').join('\n\n');
  const fullText = blocks.map((b) => b.body || '').join('\n\n');

  // ---- Always on, regardless of what the template declares ----

  // A placeholder that survived assembly would reach the client as {like_this}.
  // Nothing else in the system catches this, and it can never be acceptable.
  for (const b of blocks) {
    const leaks = [...String(b.body || '').matchAll(/\{([a-z0-9_]+)\}/gi)].map((m) => m[1]);
    if (leaks.length) {
      push('placeholder_leak', 'blocking',
        `An unfilled placeholder is still in the text: ${[...new Set(leaks)].join(', ')}.`, b.key);
    }
  }

  // A declared section that came back empty.
  for (const b of openBlocks) {
    if (!String(b.body || '').trim()) {
      push('empty_section', 'blocking', 'This section is empty and needs content before sign-off.', b.key);
    }
  }

  // A standard clause that refers back to something the letter does not contain.
  // The fee cap saying "we will not exceed the estimate set out above" is
  // meaningless, and arguably worse than meaningless, when no estimate appears.
  // The clause is protected and correct in itself, so the flag belongs on the
  // document rather than on the clause.
  const REFERS_TO_ESTIMATE =
    /\b(the )?estimate\b[^.]{0,40}\b(set out|referred to)?\s*(above|below)\b|\bas (set out|estimated) above\b|\bwe have estimated\b/i;
  const PROVIDES_ESTIMATE =
    /\b(estimate[sd]?|total|in the region of|likely to be|no more than)\b[^.]{0,60}?[£$€]?\s?\d[\d,]*/i;

  const refersToEstimate = blocks.some((b) => b.kind === 'fixed' && REFERS_TO_ESTIMATE.test(b.body || ''));
  const providesEstimate = openBlocks.some((b) => PROVIDES_ESTIMATE.test(b.body || ''));

  if (refersToEstimate && !providesEstimate) {
    const clause = blocks.find((b) => b.kind === 'fixed' && REFERS_TO_ESTIMATE.test(b.body || ''));
    push('dangling_estimate', 'blocking',
      'A standard clause refers to an estimate set out above, but this letter does not give one. '
      + 'Add an estimate, or the clause promises something the client cannot see.',
      clause?.key || null);
  }

  // Quantities a model wrote out in words. Prose almost never says "6 months",
  // it says "six to nine months", so a digits-only check misses exactly the
  // figures the model invented rather than the ones a person supplied.
  const WORD_NUMBERS = [
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'fifteen', 'twenty', 'thirty', 'sixty', 'ninety',
  ];
  const QUANTITY_UNITS = 'days?|weeks?|months?|years?|hours?|working days?';
  const WORD_QUANTITY = new RegExp(
    `\\b(${WORD_NUMBERS.join('|')})\\b(\\s*(to|or|and)\\s*\\b(${WORD_NUMBERS.join('|')})\\b)?\\s+(${QUANTITY_UNITS})\\b`,
    'gi'
  );

  const recordText = Object.values(values).map((v) => String(v ?? '')).join(' ').toLowerCase();
  for (const b of openBlocks) {
    if (b.kind !== 'bespoke') continue;
    for (const m of String(b.body || '').matchAll(WORD_QUANTITY)) {
      const phrase = m[0].toLowerCase();
      // Fine if the person actually said it. Otherwise the model supplied a
      // commitment about timing that nobody agreed to.
      const words = phrase.split(/\s+/).filter((w) => WORD_NUMBERS.includes(w));
      const grounded = words.every((w) => recordText.includes(w))
        || recordText.includes(phrase);
      if (grounded) continue;
      push('unstated_timescale', 'blocking',
        `The draft tells the client "${m[0]}", which is not in the record. `
        + 'Either it was agreed and should be captured, or it should come out of the letter.',
        b.key);
      break;
    }
  }

  // Any figure in drafted or merged text that the matter record cannot account
  // for. This is the check that catches a wrong rate sitting beside a right one.
  const known = knownNumbers(values);
  const seen = new Set();
  for (const b of openBlocks) {
    for (const m of String(b.body || '').matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
      const n = normNum(m[0]);
      if (!n || seen.has(n)) continue;
      // Small integers are ordinary prose: clause numbers, "two parties", "14 days".
      if (Number(n) < 32 && !n.includes('.')) continue;
      if (known.has(n)) continue;
      seen.add(n);
      push('unexplained_figure', 'blocking',
        `The figure ${m[0]} appears in the text but is not in the matter record. Check it against what was agreed.`,
        b.key);
    }
  }

  // ---- Rules the template declares ----

  for (const rule of definition.reviewRules || []) {
    switch (rule.check) {
      case 'fixed_block_present': {
        const present = blocks.some((b) => b.key === rule.target && b.kind === 'fixed' && b.body);
        if (!present) push(rule.code, rule.severity, rule.message, rule.target);
        break;
      }

      case 'numeric_consistency': {
        // The declared version now checks the opposite direction to the always-on
        // rule above: that the recorded value actually made it into the document.
        for (const raw of rule.fields || []) {
          const f = canonicalKey(raw);
          const want = normNum(values[f] ?? values[raw]);
          if (!want) continue;
          const present = [...openText.matchAll(/\d[\d,]*(?:\.\d+)?/g)]
            .some((m) => normNum(m[0]) === want);
          if (!present) {
            push(rule.code, rule.severity,
              `${rule.message} The recorded value does not appear in the document.`, f);
          }
        }
        break;
      }

      case 'name_consistency': {
        for (const raw of rule.fields || []) {
          const f = canonicalKey(raw);
          const full = String(values[f] ?? values[raw] ?? '').trim();
          if (!full || !full.includes(' ')) continue;
          const surname = full.split(/\s+/).pop();
          if (surname.length < 3) continue;
          const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Count surnames that are not part of the full name as written.
          const surnameHits = (fullText.match(new RegExp(`\\b${esc(surname)}\\b`, 'g')) || []).length;
          const fullHits = (fullText.match(new RegExp(esc(full), 'g')) || []).length;
          if (surnameHits > fullHits) {
            push(rule.code, rule.severity,
              `${rule.message} The name appears both in full and in short form.`, f);
          }
        }
        break;
      }

      case 'date_not_past': {
        for (const raw of rule.fields || []) {
          const f = canonicalKey(raw);
          const v = values[f] ?? values[raw];
          if (!v) continue;
          const d = new Date(v);
          if (!isNaN(d.getTime()) && d < new Date(Date.now() - 86400000)) {
            push(rule.code, rule.severity, rule.message, f);
          }
        }
        break;
      }

      case 'bespoke_mentions': {
        const block = blocks.find((b) => b.key === rule.target);
        const body = (block?.body || '').toLowerCase();
        if (!(rule.keywords || []).some((k) => body.includes(String(k).toLowerCase()))) {
          push(rule.code, rule.severity, rule.message, rule.target);
        }
        break;
      }

      default:
        break;
    }
  }

  return flags;
}

// ---------------------------------------------------------------
// 4. AI review pass. A critic with no memory of having written anything,
//    which is precisely why it catches things the drafter would not.
// ---------------------------------------------------------------

export async function reviewDraft({ blocks, values, docType }) {

  const documentText = blocks
    .map((b) => `[${b.key}]\n${b.body || '(empty)'}`)
    .join('\n\n');

  const system = [
    'You are a careful reviewer checking a professional services document before a qualified person signs it off.',
    'You did not write this document. Read it as a critic.',
    '',
    'Look only for objective, checkable problems:',
    '- figures that disagree between one part of the document and another',
    '- a name, date, or amount that contradicts the supplied facts',
    '- a date in the past where a future date is required',
    '- a client or party name appearing in more than one form',
    '- an empty section that should contain text',
    '- an assertion the supplied facts do not support',
    '',
    'Do not comment on style, tone, or formatting. Do not suggest improvements.',
    'Do not invent problems. If the document is clean, return an empty list.',
    '',
    'Respond with JSON only, no preamble and no code fences:',
    '{"flags":[{"code":"short_snake_case","severity":"blocking|advisory","message":"one sentence","anchor":"the section key or the exact phrase"}]}',
    '',
    'severity blocking means a factual contradiction or a missing required element.',
    'severity advisory means worth a look but not wrong.',
  ].join('\n');

  const user = [
    `Document type: ${docType}`,
    '',
    'Facts that were supplied for this document:',
    Object.entries(values).map(([k, v]) => `${k}: ${v}`).join('\n') || '(none)',
    '',
    'The assembled document:',
    documentText,
  ].join('\n');

  const res = await callModel({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: user }],
  }, 'Review');

  const raw = (res.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  const parsed = parseJson(raw);
  const flags = Array.isArray(parsed?.flags) ? parsed.flags : [];

  return flags
    .filter((f) => f && f.message)
    .map((f) => ({
      code: f.code || 'ai_review',
      severity: f.severity === 'blocking' ? 'blocking' : 'advisory',
      message: String(f.message),
      anchor: f.anchor ? String(f.anchor) : null,
    }));
}

// ---------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------

export async function generate({ definition, values, precedents, firmName, docType, optional }) {
  const { blocks: assembled, unresolved } = assembleFixed(definition, values, optional || new Set());

  // Rule one enforced here, before any model call. A gap stops the process.
  if (unresolved.length > 0) {
    return { ok: false, reason: 'incomplete', unresolved };
  }

  const withBespoke = await draftBespoke({ blocks: assembled, values, precedents, firmName });

  const deterministic = runDeterministicRules(definition, withBespoke, values);

  // If the firm's own mandatory checks already found something blocking, the
  // draft is going back to a person regardless. Skip the review call: it costs
  // time and money to confirm what is already known.
  const hardStop = deterministic.some((f) => f.severity === 'blocking');
  const aiFlags = hardStop ? [] : await reviewDraft({ blocks: withBespoke, values, docType });

  const blockKeys = new Set(withBespoke.map((b) => b.key));

  // Deterministic rules win. They are the firm's own requirements and are never
  // subject to a model's opinion.
  const seen = new Set(deterministic.map((f) => `${f.code}:${f.anchor || ''}`));
  const anchoredMessages = new Set(deterministic.map((f) => f.message.toLowerCase()));

  const flags = [...deterministic];
  for (const f of aiFlags) {
    const key = `${f.code}:${f.anchor || ''}`;
    if (seen.has(key)) continue;
    if (anchoredMessages.has(f.message.toLowerCase())) continue;
    // An anchor that matches no block is worse than no anchor: it sends the
    // reviewer looking for something that is not there.
    const anchor = f.anchor && blockKeys.has(f.anchor) ? f.anchor : null;
    seen.add(key);
    flags.push({ ...f, anchor });
  }

  return { ok: true, blocks: withBespoke, flags, mergedValues: values };
}
