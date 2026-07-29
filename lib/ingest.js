// Template ingestion.
//
// This is the highest leverage capability in the product. A prospect sends one
// engagement letter they have actually issued, and this turns it into a working
// template in front of them. It is also what keeps onboarding to an afternoon
// rather than two weeks, which is what protects the delivery margin.
//
// The output is a template definition: data the engine reads. No code is ever
// written to add a document type. That distinction is what makes this a product
// rather than a consultancy engagement.

import Anthropic from '@anthropic-ai/sdk';
import { canonicalKey } from './fields.js';
import { modelFor } from './models.js';

// Which model does which job, and why, is in lib/models.js.

function client() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey: key });
}

function parseJson(text) {
  if (!text) return null;
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch (_) { /* continue */ }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a !== -1 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch (_) { /* continue */ }
  }
  return null;
}

const SYSTEM = [
  'You analyse a professional services document and turn it into a reusable template definition.',
  '',
  'Split the document into ordered blocks. Every block is exactly one of three kinds:',
  '',
  'fixed    Standard wording that is identical for every client. Regulatory clauses,',
  '         complaints wording, standard terms, boilerplate. Copy the text VERBATIM.',
  '         Never paraphrase, shorten, or improve a fixed block. It is reproduced',
  '         exactly as written on every future document.',
  '',
  'field    A short sentence or line that is the same structure every time but',
  '         contains specific values. Replace each value with {snake_case_placeholder}.',
  '         Example: "Dear Mr Ahmed," becomes "Dear {client_legal_name},".',
  '',
  'bespoke  A section genuinely written fresh for each matter, such as a description',
  '         of the scope of work. Do not copy the example text into the body. Instead',
  '         write a short instruction describing what should be drafted each time.',
  '',
  'Then list:',
  '- requiredFields: every placeholder used anywhere, as an array of snake_case names.',
  '- reviewRules: checks worth running on every future document of this type.',
  '',
  'Available review rule checks, use only these:',
  '  fixed_block_present   needs target = a fixed block key',
  '  numeric_consistency   needs fields = array of numeric field names',
  '  name_consistency      needs fields = array of name field names',
  '  date_not_past         needs fields = array of date field names',
  '  bespoke_mentions      needs target = a bespoke block key, and keywords array',
  '',
  'Mark a rule blocking if its failure is a factual or compliance problem.',
  'Mark it advisory if it is only worth a look. Keep blocking rules few and real:',
  'a review pane that cries wolf gets clicked through, and then it protects nobody.',
  '',
  'Respond with JSON only. No preamble, no code fences.',
  '{"docType":"snake_case_type","name":"Human Readable Name","blocks":[{"key":"...","kind":"fixed|field|bespoke","body":"...","prompt":"..."}],"requiredFields":["..."],"reviewRules":[{"code":"...","severity":"blocking|advisory","check":"...","target":"...","fields":["..."],"keywords":["..."],"message":"..."}]}',
].join('\n');

function normalise(p) {
  return p.replace(/\s+/g, ' ').trim();
}

// A minimum length keeps single words and stray line breaks out of the counting.
// It also threw away short lines that are boilerplate by any measure: "Private and
// confidential" is 24 characters and appears on every letter a firm sends, and
// dropping it meant the fee earner was asked to type it themselves.
//
// Twelve characters keeps out the noise while keeping the markings. Anything this
// short is only ever counted as standard when it appears in every document, which
// is a stricter test than a paragraph has to pass.
function paragraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map(normalise)
    .filter((p) => p.length >= 12);
}

// Split a pile of the firm's own documents into what never changes and what
// always does. This is observation, not judgement: a clause present in every
// letter the firm has issued is a standard clause, whatever anyone calls it.
export function findInvariants(documents) {
  const docs = documents.map(paragraphs);
  const n = docs.length;
  if (n === 0) return { invariant: [], varying: [], n: 0 };

  const counts = new Map();
  for (const d of docs) {
    for (const p of new Set(d)) counts.set(p, (counts.get(p) || 0) + 1);
  }

  // With a handful of documents, demand unanimity. With more, allow for the
  // occasional letter where someone edited the boilerplate by hand.
  const threshold = n >= 8 ? Math.ceil(n * 0.85) : n;

  const invariant = [];
  const varying = [];
  for (const [p, c] of counts) {
    // A short line has to appear in every document, not merely most of them. A
    // long clause surviving 85 percent of letters is boilerplate somebody once
    // edited; a short line missing from three of twenty is more likely to be a
    // heading that varies.
    const needed = p.length < 40 ? n : threshold;
    if (c >= needed) invariant.push({ text: p, seenIn: c });
    else varying.push({ text: p, seenIn: c });
  }

  // Keep the order they appear in, taking the longest document as the model,
  // since a document is a sequence and the blocks have to come back in order.
  const longest = docs.reduce((a, b) => (b.length > a.length ? b : a), docs[0]);
  const rank = new Map(longest.map((p, i) => [p, i]));
  invariant.sort((a, b) => (rank.get(a.text) ?? 999) - (rank.get(b.text) ?? 999));

  return { invariant, varying, n, threshold };
}

export async function ingestTemplate({ documentText, firmName, hint }) {
  if (!documentText || documentText.trim().length < 120) {
    return { ok: false, reason: 'too_short' };
  }

  const anthropic = client();

  const user = [
    `Firm: ${firmName}`,
    hint ? `The firm says this document is: ${hint}` : '',
    '',
    'The document to analyse:',
    '',
    documentText.slice(0, 40000),
  ].join('\n');

  const res = await anthropic.messages.create({
    model: modelFor('ingest'),
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
  });

  const raw = (res.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  const parsed = parseJson(raw);
  if (!parsed || !Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
    return { ok: false, reason: 'unparseable' };
  }

  return { ok: true, definition: normaliseDefinition(parsed) };
}

// A long merge line stuffed with placeholders is form filling wearing a
// document's clothes. Convert it back into prose the model writes.
const FIELD_MAX_CHARS = 220;
const FIELD_MAX_PLACEHOLDERS = 3;

// The per-block rule misses a second shape of the same failure: not one bloated
// merge line, but nine short ones adding up to seventeen values a person has to
// supply. Cap the total, and demote the worst offenders until it holds.
const MAX_REQUIRED_FIELDS = 10;

function countRequired(blocks) {
  const keys = new Set();
  for (const b of blocks) {
    if (b.kind !== 'field') continue;
    for (const m of String(b.body || '').matchAll(/\{([a-z0-9_]+)\}/gi)) keys.add(m[1].toLowerCase());
  }
  return keys;
}

function toBespoke(b) {
  return {
    key: b.key,
    kind: 'bespoke',
    prompt: `Write this section in the firm's voice, using only the supplied facts. `
      + `For reference, the firm has previously written it along these lines: `
      + `"${String(b.body).replace(/\{([a-z0-9_]+)\}/g, 'the $1').slice(0, 400)}"`,
    demoted: true,
  };
}

export function capRequiredFields(blocks) {
  let out = [...blocks];
  // Never demote these: a salutation and a signature really are merge lines,
  // and turning them into prose would be worse than the problem.
  const protectedKeys = /salut|dear|sign|closing|yours|header|reference|address_block/i;

  let guard = 0;
  while (countRequired(out).size > MAX_REQUIRED_FIELDS && guard < 20) {
    guard += 1;
    const candidates = out
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.kind === 'field' && !protectedKeys.test(b.key))
      .map(({ b, i }) => ({
        i,
        holders: [...String(b.body || '').matchAll(/\{[a-z0-9_]+\}/gi)].length,
        len: (b.body || '').length,
      }))
      .filter((c) => c.holders > 0)
      .sort((a, b) => (b.holders - a.holders) || (b.len - a.len));

    if (candidates.length === 0) break;
    const worst = candidates[0].i;
    out[worst] = toBespoke(out[worst]);
  }
  return out;
}

export function demoteOverTemplated(blocks) {
  return blocks.map((b) => {
    if (b.kind !== 'field') return b;
    const holders = [...String(b.body || '').matchAll(/\{([a-z0-9_]+)\}/gi)].map((m) => m[1]);
    const tooLong = (b.body || '').length > FIELD_MAX_CHARS;
    const tooMany = holders.length > FIELD_MAX_PLACEHOLDERS;
    if (!tooLong && !tooMany) return b;

    // Keep the original as the instruction, so the model drafting later knows
    // what this section is for and roughly how the firm words it.
    return {
      key: b.key,
      kind: 'bespoke',
      prompt: `Write this section in the firm's voice, using only the supplied facts. `
        + `For reference, the firm has previously written it along these lines: `
        + `"${String(b.body).replace(/\{([a-z0-9_]+)\}/g, 'the $1').slice(0, 400)}"`,
      demoted: true,
    };
  });
}

// Ten blocking flags on every document is not safety, it is noise, and noise
// gets clicked through. Keep the four most serious and demote the rest.
const MAX_BLOCKING = 4;
const SERIOUSNESS = ['fixed_block_present', 'numeric_consistency', 'date_not_past', 'name_consistency'];

export function capBlocking(rules) {
  const blocking = rules.filter((r) => r.severity === 'blocking');
  if (blocking.length <= MAX_BLOCKING) return rules;

  const ranked = [...blocking].sort(
    (a, b) => SERIOUSNESS.indexOf(a.check) - SERIOUSNESS.indexOf(b.check)
  );
  const keep = new Set(ranked.slice(0, MAX_BLOCKING).map((r) => r.code));
  return rules.map((r) =>
    r.severity === 'blocking' && !keep.has(r.code) ? { ...r, severity: 'advisory' } : r
  );
}

// Defend against a malformed response before it reaches the database.
export function normaliseDefinition(parsed, invariant = null) {
  const seen = new Set();
  const blocks = parsed.blocks
    .filter((b) => b && b.kind && ['fixed', 'field', 'bespoke'].includes(b.kind))
    .map((b, i) => {
      let key = (b.key || `block_${i + 1}`).toString().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      while (seen.has(key)) key = `${key}_${i}`;
      seen.add(key);

      if (b.kind === 'bespoke') {
        return { key, kind: 'bespoke', prompt: b.prompt || 'Draft this section from the supplied facts.' };
      }

      // A fixed block carries a reference, never text. The body comes from the
      // counted invariants, so the model has no opportunity to reword it.
      if (b.kind === 'fixed' && invariant) {
        const idx = Number(b.ref) - 1;
        const source = invariant[idx];
        if (!source) return null;
        return { key, kind: 'fixed', body: source.text, refIndex: idx };
      }

      // Rewrite placeholders into the shared vocabulary as they are stored,
      // so nothing downstream has to guess what a name means.
      const body = (b.body || '').toString()
        .replace(/\{([a-z0-9_]+)\}/gi, (_m, name) => `{${canonicalKey(name)}}`);
      return { key, kind: b.kind, body };
    })
    .filter((b) => b && (b.kind === 'bespoke' || (b.body || '').trim().length > 0));

  // One clause, one appearance. The model places fixed blocks by reference number and
  // nothing stopped it naming the same one twice, so the fee cap arrived twice,
  // identical and back to back, while the recovery pass appended whatever had been
  // omitted in exchange. The first placement is kept, because that is where the model
  // read it in the firm's own letter.
  const seenRefs = new Set();
  const deduped = blocks.filter((b) => {
    if (b.kind !== 'fixed' || b.refIndex == null) return true;
    if (seenRefs.has(b.refIndex)) return false;
    seenRefs.add(b.refIndex);
    return true;
  });

  // Derive required fields from the placeholders actually present, so the
  // completeness gate can never be out of step with the template.
  const used = new Set();
  for (const b of blocks) {
    if (b.kind !== 'field') continue;
    for (const m of b.body.matchAll(/\{([a-z0-9_]+)\}/gi)) used.add(canonicalKey(m[1]));
  }
  for (const f of parsed.requiredFields || []) {
    if (typeof f === 'string') used.add(canonicalKey(f));
  }

  const validChecks = new Set([
    'fixed_block_present', 'numeric_consistency', 'name_consistency',
    'date_not_past', 'bespoke_mentions',
  ]);
  const blockKeys = new Set(blocks.map((b) => b.key));

  const reviewRules = (parsed.reviewRules || [])
    .filter((r) => r && validChecks.has(r.check) && r.message)
    .filter((r) => !r.target || blockKeys.has(r.target))
    .map((r) => ({
      code: (r.code || r.check).toString().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      severity: r.severity === 'blocking' ? 'blocking' : 'advisory',
      check: r.check,
      target: r.target || undefined,
      fields: Array.isArray(r.fields) ? r.fields : undefined,
      keywords: Array.isArray(r.keywords) ? r.keywords : undefined,
      message: r.message.toString(),
    }));

  const finalBlocks = capRequiredFields(demoteOverTemplated(deduped));

  // Placeholders inside demoted blocks are no longer values anyone must supply,
  // so the required list has to be recomputed rather than carried over.
  const stillNeeded = new Set();
  for (const b of finalBlocks) {
    if (b.kind !== 'field') continue;
    for (const m of String(b.body).matchAll(/\{([a-z0-9_]+)\}/gi)) {
      stillNeeded.add(canonicalKey(m[1]));
    }
  }
  // A handful of facts are needed to draft at all, even where no merge line
  // mentions them by name.
  for (const f of used) {
    if (/client_legal_name|matter_type|fee_earner|fee_basis|rate|date/.test(f)) {
      stillNeeded.add(f);
    }
  }

  return {
    docType: (parsed.docType || 'document').toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    name: parsed.name || 'Untitled Template',
    blocks: finalBlocks,
    requiredFields: [...stillNeeded],
    reviewRules: capBlocking(reviewRules),
  };
}

// Analyse a whole pile at once. The invariant clauses are established by
// counting, and the model is used only to lay out the structure and name the
// fields, which is what it is actually good at.
export async function ingestCorpus({ documents, firmName, hint }) {
  const texts = documents.map((d) => d.text).filter((t) => t && t.trim().length > 120);
  if (texts.length === 0) return { ok: false, reason: 'too_short' };

  const { invariant, varying, n, threshold } = findInvariants(texts);

  // One document is not a corpus. Fall back to reading it on its own, which is
  // weaker but honest: with a single letter there is no way to know which parts
  // are standard and which happened to suit that client.
  if (n < 2) {
    const single = await ingestTemplate({ documentText: texts[0], firmName, hint });
    if (!single.ok) return single;
    return { ...single, corpus: { n: 1, invariant: 0, varying: 0, weak: true } };
  }

  const invariantList = invariant
    .map((p, i) => `[FIXED ${i + 1}] ${p.text}`)
    .join('\n\n');

  // Evidence for the field against bespoke decision. A paragraph that is long
  // and unique to one document is prose someone wrote for that client. A short
  // one repeating with different values is a merge line.
  const uniqueLong = varying.filter((p) => p.seenIn === 1 && p.text.length > 220);
  const shortVarying = varying.filter((p) => p.text.length <= 220);

  const sample = texts[0].slice(0, 14000);

  const system = [
    `You lay out a reusable structure for documents produced by ${firmName}.`,
    '',
    'You are given two things: a list of clauses that appear in EVERY document the firm has',
    'issued of this type, and one complete example document.',
    '',
    'The fixed clauses have already been identified by counting. You must NOT reproduce their',
    'text. Place each one using its number, as {"kind":"fixed","ref":N,"key":"short_name"}.',
    'Every fixed clause listed must appear exactly once, in the order it occurs in the example.',
    'Do not merge them, split them, or leave any out.',
    '',
    'For everything else in the example, decide between:',
    '  field    a SHORT line, under about 200 characters, with the same shape every time',
    '           and only the values differing. Salutations, reference lines, a rate line,',
    '           a signature block. Replace each value with {snake_case_placeholder}.',
    '  bespoke  a paragraph or section that is genuinely written afresh for each client.',
    '           Do not copy the example text; write a short instruction describing what',
    '           should be drafted each time.',
    '',
    'Default to bespoke for anything that reads as prose. A long paragraph riddled with',
    'placeholders is the wrong answer: it turns writing into form filling, forces the fee',
    'earner to supply a dozen values, and produces a document that reads like a mail merge.',
    'If a paragraph differs in substance between documents rather than merely in its',
    'numbers and names, it is bespoke.',
    '',
    'Aim for at most eight or nine required fields in total. If you find yourself needing',
    'more, you have templated something that should have been drafted.',
    '',
    'Then list requiredFields (every placeholder used) and reviewRules.',
    '',
    'Available checks, use only these:',
    '  fixed_block_present   target = a fixed block key',
    '  numeric_consistency   fields = numeric field names',
    '  name_consistency      fields = name field names',
    '  date_not_past         fields = date field names',
    '  bespoke_mentions      target = a bespoke block key, plus keywords',
    '',
    'Propose at most FOUR blocking rules, and only for things that are factually wrong or',
    'genuinely missing: a required clause absent, a figure contradicting the record, a date',
    'in the past. Everything else is advisory. A review pane showing ten red flags on every',
    'document gets clicked through within a week, and then it protects nobody at all.',
    '',
    'Respond with JSON only, no preamble and no code fences.',
    '{"docType":"snake_case","name":"Human Readable Name","blocks":[{"key":"...","kind":"fixed","ref":1},{"key":"...","kind":"field","body":"..."},{"key":"...","kind":"bespoke","prompt":"..."}],"requiredFields":["..."],"reviewRules":[{"code":"...","severity":"blocking|advisory","check":"...","target":"...","fields":["..."],"keywords":["..."],"message":"..."}]}',
  ].join('\n');

  const user = [
    hint ? `The firm says these are: ${hint}` : '',
    `Documents analysed: ${n}. A clause had to appear in at least ${threshold} of them to count as fixed.`,
    '',
    `Clauses present in every document (${invariant.length}):`,
    invariantList || '(none found, which is unusual)',
    '',
    `For reference, the corpus contains ${uniqueLong.length} long paragraphs unique to a single`,
    `document, which are almost certainly bespoke, and ${shortVarying.length} short varying lines,`,
    'which are almost certainly merge fields.',
    '',
    'One complete example:',
    sample,
  ].join('\n');

  const res = await client().messages.create({
    model: modelFor('ingest'),
    max_tokens: 8000,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const raw = (res.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  const parsed = parseJson(raw);
  if (!parsed || !Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
    return { ok: false, reason: 'unparseable' };
  }

  const definition = normaliseDefinition(parsed, invariant);

  // Guarantee: every clause the corpus proves is standard ends up in the
  // structure, with its exact counted text. If the model failed to place one,
  // it is appended rather than lost. A protected clause silently going missing
  // is worse than one sitting in the wrong position.
  const placed = new Set(
    definition.blocks.filter((b) => b.kind === 'fixed' && b.refIndex != null).map((b) => b.refIndex)
  );
  let recovered = 0;
  invariant.forEach((inv, i) => {
    if (placed.has(i)) return;
    recovered += 1;
    definition.blocks.push({
      key: `standard_${i + 1}`,
      kind: 'fixed',
      body: inv.text,
      refIndex: i,
      recovered: true,
    });
  });

  return {
    ok: true,
    definition,
    corpus: {
      n,
      invariant: invariant.length,
      varying: varying.length,
      threshold,
      recovered,
      placedByModel: placed.size,
    },
  };
}

// Summary for the ingestion screen, so the prospect sees the split immediately.
// A heading and a marking are as invariant as a clause, and are protected the same
// way, but they are not terms. Counting "Private and confidential" and "3. What is
// not included" among a firm's standard clauses turns eight into fifteen and tells
// the reader nothing. Kept fixed, counted separately.
function isStructure(block) {
  if (block.kind !== 'fixed') return false;
  const text = String(block.body || '').trim();
  if (text.length < 40) return true;
  return /^\s*\d+\.\s/.test(text) && text.length < 60;
}

export function summarise(definition) {
  const blocks = definition.blocks || [];
  const fixed = blocks.filter((b) => b.kind === 'fixed');
  return {
    fixed: fixed.filter((b) => !isStructure(b)).length,
    structure: fixed.filter(isStructure).length,
    field: blocks.filter((b) => b.kind === 'field').length,
    bespoke: blocks.filter((b) => b.kind === 'bespoke').length,
    requiredFields: (definition.requiredFields || []).length,
    reviewRules: (definition.reviewRules || []).length,
    blocking: (definition.reviewRules || []).filter((r) => r.severity === 'blocking').length,
  };
}
