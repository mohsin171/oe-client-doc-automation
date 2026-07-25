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

const MODEL = 'claude-haiku-4-5-20251001';

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

function paragraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map(normalise)
    .filter((p) => p.length > 55);
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
    if (c >= threshold) invariant.push({ text: p, seenIn: c });
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
    model: MODEL,
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

  return { ok: true, definition: normalise_(parsed) };
}

// Defend against a malformed response before it reaches the database.
function normalise_(parsed) {
  const seen = new Set();
  const blocks = parsed.blocks
    .filter((b) => b && b.kind && ['fixed', 'field', 'bespoke'].includes(b.kind))
    .map((b, i) => {
      let key = (b.key || `block_${i + 1}`).toString().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      while (seen.has(key)) key = `${key}_${i}`;
      seen.add(key);
      return b.kind === 'bespoke'
        ? { key, kind: 'bespoke', prompt: b.prompt || 'Draft this section from the supplied facts.' }
        : { key, kind: b.kind, body: (b.body || '').toString() };
    })
    .filter((b) => b.kind === 'bespoke' || b.body.trim().length > 0);

  // Derive required fields from the placeholders actually present, so the
  // completeness gate can never be out of step with the template.
  const used = new Set();
  for (const b of blocks) {
    if (b.kind !== 'field') continue;
    for (const m of b.body.matchAll(/\{([a-z0-9_]+)\}/gi)) used.add(m[1].toLowerCase());
  }
  for (const f of parsed.requiredFields || []) {
    if (typeof f === 'string') used.add(f.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
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

  return {
    docType: (parsed.docType || 'document').toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    name: parsed.name || 'Untitled Template',
    blocks,
    requiredFields: [...used],
    reviewRules,
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

  const sample = texts[0].slice(0, 14000);

  const system = [
    `You lay out a reusable structure for documents produced by ${firmName}.`,
    '',
    'You are given two things: a list of clauses that appear in EVERY document the firm has',
    'issued of this type, and one complete example document.',
    '',
    'The fixed clauses have already been identified by counting. Do not second guess them,',
    'do not reword them, do not merge or split them. Reproduce each one VERBATIM as a block',
    'of kind "fixed", in the order they appear in the example.',
    '',
    'For everything else in the example, decide between:',
    '  field    a short line with the same shape every time but different values.',
    '           Replace each value with {snake_case_placeholder}.',
    '  bespoke  a section genuinely written fresh for each client. Do not copy the example',
    '           text; write a short instruction describing what should be drafted each time.',
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
    'Keep blocking rules few and real. A review pane that cries wolf gets clicked through,',
    'and then it protects nobody.',
    '',
    'Respond with JSON only, no preamble and no code fences.',
    '{"docType":"snake_case","name":"Human Readable Name","blocks":[{"key":"...","kind":"fixed|field|bespoke","body":"...","prompt":"..."}],"requiredFields":["..."],"reviewRules":[{"code":"...","severity":"blocking|advisory","check":"...","target":"...","fields":["..."],"keywords":["..."],"message":"..."}]}',
  ].join('\n');

  const user = [
    hint ? `The firm says these are: ${hint}` : '',
    `Documents analysed: ${n}. A clause had to appear in at least ${threshold} of them to count as fixed.`,
    '',
    `Clauses present in every document (${invariant.length}):`,
    invariantList || '(none found, which is unusual)',
    '',
    'One complete example:',
    sample,
  ].join('\n');

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 8000,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const raw = (res.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  const parsed = parseJson(raw);
  if (!parsed || !Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
    return { ok: false, reason: 'unparseable' };
  }

  const definition = normalise_(parsed);

  // The model was told not to alter the fixed clauses. Verify rather than trust:
  // any fixed block whose text is not one of the counted invariants is dropped,
  // because a paraphrased standard clause is the exact failure this design exists
  // to prevent.
  const allowed = new Set(invariant.map((p) => normalise(p.text)));
  let rejected = 0;
  definition.blocks = definition.blocks.filter((b) => {
    if (b.kind !== 'fixed') return true;
    const ok = allowed.has(normalise(b.body));
    if (!ok) rejected += 1;
    return ok;
  });

  return {
    ok: true,
    definition,
    corpus: {
      n,
      invariant: invariant.length,
      varying: varying.length,
      threshold,
      rejected,
    },
  };
}

// Summary for the ingestion screen, so the prospect sees the split immediately.
export function summarise(definition) {
  const blocks = definition.blocks || [];
  return {
    fixed: blocks.filter((b) => b.kind === 'fixed').length,
    field: blocks.filter((b) => b.kind === 'field').length,
    bespoke: blocks.filter((b) => b.kind === 'bespoke').length,
    requiredFields: (definition.requiredFields || []).length,
    reviewRules: (definition.reviewRules || []).length,
    blocking: (definition.reviewRules || []).filter((r) => r.severity === 'blocking').length,
  };
}
