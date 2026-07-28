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

// A date held as 2026-06-14 belongs in a database, not in a letter. Anything stored
// in that shape is written the way a letter writes a date.
function asLetterDate(value) {
  const v = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

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
        return asLetterDate(v);
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

export async function draftBespoke({ blocks, values, precedents, firmName, narrative }) {
  const bespoke = blocks.filter((b) => b.kind === 'bespoke');
  if (bespoke.length === 0) return blocks;

  const factLines = Object.entries(values)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  // What the fee earner actually wrote.
  //
  // The drafting only ever saw the extracted fields, which are a compression of the
  // notes: a scope summary, a rate, a date. Everything that did not fit a field was
  // discarded before the letter was written. Four beneficiaries, one of them abroad, a
  // client worried about a tax deadline, the particular way an exclusion was put on
  // the call: all of it gone, and the letter came out generic because the detail had
  // been removed before the model ever saw it.
  //
  // The notes are the account of the conversation the letter is about. They belong in
  // front of whatever writes it.
  const notes = String(narrative || '').trim();


  const precedentText = (precedents || [])
    .map((p, i) => `Precedent ${i + 1} (${p.section_key || 'general'}):\n${p.body}`)
    .join('\n\n');

  const system = [
    `You write sections of letters for ${firmName}, a firm of solicitors, to be read by`,
    'their client. A partner signs it, so it has to be right. The client is not a lawyer,',
    'so it has to be clear.',
    '',
    'What a good section does:',
    '- names the actual work. Not "your matter" but the purchase of the freehold at the',
    '  address given, the administration of the named estate, the lease of the named',
    '  premises. Specific to this client and no one else.',
    '- says what the firm will do, in the order it will happen, using the words this firm',
    '  uses for it. The examples below are how they write; follow their register, their',
    '  sentence length, their level of detail.',
    '- says what is not included, plainly, where the fee earner has said so. A client who',
    '  is surprised later is a complaint.',
    '- answers what the client actually raised. If the notes record a worry about a',
    '  deadline, a break clause, a beneficiary abroad, address it. That is the difference',
    '  between a letter to this client and a template with a name in it.',
    '- reads as continuous prose a person would write, not a list of assembled clauses.',
    '',
    'What makes a section bad:',
    '- generality. "We will advise you on the applicable law" says nothing. If the facts',
    '  do not let you be specific, write less rather than padding it.',
    '- hedging. Do not write around a fact you have been given. If the rate is supplied,',
    '  state it. If the estimate is supplied, state it.',
    '- repeating what another section covers. Fees belong in the fees section.',
    '',
    'Hard limits, which override everything above:',
    '1. Use only the facts supplied and the fee earner\'s notes. Never invent a figure, a',
    '   date, a name, a party or a term. This includes quantities written as words: do not',
    '   say "six to nine months" or "around three weeks" unless it was given. Write about',
    '   what the timing depends on instead. A sentence with no number beats a commitment',
    '   nobody made.',
    '2. The examples are other clients\' letters. Take wording from them, never content.',
    '   Every figure, date, name and address in one belongs to somebody else and is wrong',
    '   here. If an example says the fee is 1,750 and the facts say 2,400, it is 2,400. If',
    '   the facts give no figure, give none.',
    '3. Where the facts and the notes disagree, the facts are right: a person has confirmed',
    '   those. Where the notes carry a detail the facts do not, use it.',
    '4. No headings, salutations, sign-offs or standard terms. Those are handled elsewhere.',
    '5. If a fee estimate, cap or total is supplied, state it in the fees section. The',
    '   firm\'s own clauses refer back to it, so omitting it leaves them pointing at nothing.',
    '',
    'Length: match the examples. Two or three paragraphs for a scope section is usual; one',
    'is enough for a short one. Do not pad to fill space.',
    '',
    'Respond with JSON only, no preamble and no code fences, in this exact shape:',
    '{"sections":[{"key":"<section key>","body":"<the drafted text>"}]}',
  ].join('\n');

  const user = [
    // The matter first, so the model knows what kind of letter this is before it
    // reads anything else. It was previously buried among the field values.
    `This is a letter to ${values.client_legal_name || 'the client'} about `
      + `${values.matter_type || 'their matter'}.`,
    values.property_address ? `The property or premises: ${values.property_address}.` : '',
    values.other_party ? `The other party: ${values.other_party}.` : '',
    '',
    'Facts a person has confirmed for this matter:',
    factLines || '(none supplied)',
    '',
    notes
      ? [
        'What the fee earner wrote after the call. This is the account of the',
        'conversation the letter is about, and the letter should reflect it. Where it',
        'gives a detail the confirmed facts do not carry, use it. Where the two',
        'disagree, the confirmed facts are right.',
        '',
        '---',
        notes,
        '---',
      ].join('\n')
      : '',
    '',
    precedentText
      ? 'How this firm has written this kind of letter before. Match the register, the '
        + 'sentence length and the level of detail. These belong to other clients: the '
        + 'phrasing is useful, the contents are not.\n\n' + precedentText
      : '',
    '',
    'Write these sections:',
    ...bespoke.map((b) => `- key: ${b.key}\n  what it is for: ${b.prompt}`),
  ].filter((line) => line !== '').join('\n');

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

  // Citations are not figures. "the Landlord and Tenant Act 1954" and "section 25"
  // are the names of things, and flagging them as unexplained sums teaches a reader
  // that the checks cry wolf, which costs more than the check is worth.
  const stripCitations = (text) => String(text || '')
    .replace(/\b(?:Act|Acts|Regulations?|Rules?|Order|Directive|Convention)\s+(?:of\s+)?\d{4}\b/gi, ' ')
    .replace(/\b\d{4}\s+(?:Act|Regulations?|Rules?|Order)\b/gi, ' ')
    .replace(/\bsections?\s+\d+[A-Za-z]?(?:\(\d+\))*/gi, ' ')
    .replace(/\bs\.\s?\d+[A-Za-z]?(?:\(\d+\))*/gi, ' ')
    .replace(/\bparagraphs?\s+\d+/gi, ' ')
    .replace(/\b(?:CPR|SI)\s?\d[\d.]*/gi, ' ')
    .replace(/\bPart\s+\d+\b/gi, ' ');

  // Any figure in drafted or merged text that the matter record cannot account
  // for. This is the check that catches a wrong rate sitting beside a right one.
  const known = knownNumbers(values);
  const seen = new Set();
  for (const b of openBlocks) {
    for (const m of stripCitations(b.body).matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
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

export async function generate({
  definition, values, precedents, firmName, docType, optional, narrative,
}) {
  const { blocks: assembled, unresolved } = assembleFixed(definition, values, optional || new Set());

  // Rule one enforced here, before any model call. A gap stops the process.
  if (unresolved.length > 0) {
    return { ok: false, reason: 'incomplete', unresolved };
  }

  const withBespoke = await draftBespoke({
    blocks: assembled, values, precedents, firmName, narrative,
  });

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
