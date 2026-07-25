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

const MODEL = 'claude-haiku-4-5-20251001';

function client() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey: key });
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

export function assembleFixed(definition, values) {
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
      const body = block.body.replace(PLACEHOLDER, (match, name) => {
        const v = values[name];
        if (v === undefined || v === null || String(v).trim() === '') {
          missing = true;
          unresolved.push({ block: block.key, field: name });
          return match;
        }
        return String(v);
      });
      out.push({ key: block.key, kind: 'field', body, missing });
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

  const anthropic = client();

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
    '2. Write in the voice and register of the supplied precedents.',
    '3. Do not add headings, salutations, sign-offs, or standard terms. Those are handled elsewhere.',
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

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: user }],
  });

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

export function runDeterministicRules(definition, blocks, values) {
  const flags = [];
  const fullText = blocks.map((b) => b.body || '').join('\n\n');

  for (const rule of definition.reviewRules || []) {
    switch (rule.check) {
      case 'fixed_block_present': {
        const present = blocks.some((b) => b.key === rule.target && b.kind === 'fixed' && b.body);
        if (!present) {
          flags.push({ code: rule.code, severity: rule.severity, message: rule.message, anchor: rule.target });
        }
        break;
      }
      case 'numeric_consistency': {
        for (const f of rule.fields || []) {
          const v = values[f];
          if (!v) continue;
          const digits = String(v).replace(/[^0-9.]/g, '');
          if (!digits) continue;
          const occurrences = (fullText.match(new RegExp(digits.replace('.', '\\.'), 'g')) || []).length;
          const otherNumbers = (fullText.match(/\d[\d,]*(?:\.\d+)?/g) || [])
            .filter((n) => n.replace(/[^0-9.]/g, '') !== digits);
          if (occurrences === 0 && otherNumbers.length > 0) {
            flags.push({
              code: rule.code, severity: rule.severity, message: rule.message, anchor: f,
            });
          }
        }
        break;
      }
      case 'name_consistency': {
        for (const f of rule.fields || []) {
          const v = values[f];
          if (!v) continue;
          const surname = String(v).trim().split(/\s+/).pop();
          const exact = (fullText.match(new RegExp(String(v).trim(), 'g')) || []).length;
          const loose = (fullText.match(new RegExp(surname, 'g')) || []).length;
          if (loose > exact + 1) {
            flags.push({ code: rule.code, severity: rule.severity, message: rule.message, anchor: f });
          }
        }
        break;
      }
      case 'date_not_past': {
        for (const f of rule.fields || []) {
          const v = values[f];
          if (!v) continue;
          const d = new Date(v);
          if (!isNaN(d.getTime()) && d < new Date(Date.now() - 86400000)) {
            flags.push({ code: rule.code, severity: rule.severity, message: rule.message, anchor: f });
          }
        }
        break;
      }
      case 'bespoke_mentions': {
        const block = blocks.find((b) => b.key === rule.target);
        const body = (block?.body || '').toLowerCase();
        const hit = (rule.keywords || []).some((k) => body.includes(k.toLowerCase()));
        if (!hit) {
          flags.push({ code: rule.code, severity: rule.severity, message: rule.message, anchor: rule.target });
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
  const anthropic = client();

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

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: user }],
  });

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

export async function generate({ definition, values, precedents, firmName, docType }) {
  const { blocks: assembled, unresolved } = assembleFixed(definition, values);

  // Rule one enforced here, before any model call. A gap stops the process.
  if (unresolved.length > 0) {
    return { ok: false, reason: 'incomplete', unresolved };
  }

  const withBespoke = await draftBespoke({ blocks: assembled, values, precedents, firmName });

  const deterministic = runDeterministicRules(definition, withBespoke, values);
  const aiFlags = await reviewDraft({ blocks: withBespoke, values, docType });

  // Deterministic rules first: they are the firm's own mandatory checks and
  // they are never subject to a model's opinion.
  const seen = new Set();
  const flags = [...deterministic, ...aiFlags].filter((f) => {
    const k = `${f.code}:${f.anchor || ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { ok: true, blocks: withBespoke, flags, mergedValues: values };
}
