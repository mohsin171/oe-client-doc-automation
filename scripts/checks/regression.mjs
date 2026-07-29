// Every fault found today, as a test, against every letter type.
//
// The pattern all day was: a letter goes out, a fault is spotted in it, I fix that fault,
// and the next letter has a different one. That is what reactive fixing gets you. This is
// the same faults turned into checks, so the next change that reintroduces one says so
// here rather than in a letter somebody has read.
import { readFileSync, readdirSync } from 'node:fs';
import { assembleFixed, runDeterministicRules } from '../../lib/engine.js';
import { dropOrphanedHeadings, isHeadingBlock } from '../../lib/letter.js';
import { renderLetterPdf } from '../../lib/pdf.js';
import { prepareForDrafting } from '../../lib/redact.js';
import { findInvariants, normaliseDefinition } from '../../lib/ingest.js';
import { whatIsNeeded } from '../../lib/needs.js';
import {
  SYSTEM_FIELDS, canonicalKey, isSystemField, isNotAValue, isFurnitureField,
  belongsToALetter, fieldMeta, satisfiedByAlternative,
} from '../../lib/fields.js';

const TYPES = [
  ['engagement', 'corpus-batch2'],
  ['client care', 'corpus-client-care'],
  ['status update', 'corpus-status-update'],
  ['chasing', 'corpus-chasing-letter'],
  ['estimate revision', 'corpus-estimate-revision'],
  ['completion', 'corpus-completion'],
  ['closing', 'corpus-closing'],
];

const read = (d) => readdirSync(`scripts/${d}`).filter((f) => f.endsWith('.txt'))
  .map((f) => ({ name: f, body: readFileSync(`scripts/${d}/${f}`, 'utf8') }));

const FIRM = { name: 'Harrow & Fenn Solicitors', branding: {
  letterhead: 'Harrow & Fenn Solicitors',
  address: '18 Bishopsgate Row, Leeds LS1 4TQ',
  signatureBlock: 'Harrow & Fenn Solicitors, regulated by the SRA',
} };

// A fixed-fee matter, which is the case that broke the client care letter: the corpus
// charges hourly and there is no rate to merge.
const VALUES = {
  client_legal_name: 'Mr and Mrs D Okonkwo',
  client_address: '17 Grange Croft, Leeds LS17 7EW',
  matter_type: 'Residential conveyancing',
  property_address: '14 Sandhill Oval, Leeds LS17 8EG',
  fee_earner_name: 'Mohsin Ali', supervisor_name: 'Mohsin Ali',
  fee_basis: 'fixed', fixed_fee: '1450', vat_amount: '290', fee_total: '1740',
  disbursements: '550', completion_date: '2026-10-31',
  scope_summary: 'Reviewing the contract and title, searches, exchange, completion and registration.',
  exclusions: 'Not advising on condition or value. Not advising on the mortgage product.',
  standing_instructions: 'Email rather than post.',
  date_of_death: '2026-06-14',
};

const failures = [];
const fail = (type, what, detail) => failures.push(`${type}: ${what}${detail ? ' — ' + detail : ''}`);

for (const [type, dir] of TYPES) {
  const docs = read(dir);
  const { invariant } = findInvariants(docs.map((d) => d.body));

  // Build a template the way ingestion does, including the faults ingestion produces:
  // a heading declared as a required field, a duplicate clause reference, and a merge
  // field for a rate this matter does not have.
  const parsed = {
    docType: dir.replace('corpus-', ''), name: type,
    blocks: [
      ...invariant.slice(0, 6).map((_, n) => ({ key: `std_${n}`, kind: 'fixed', ref: n + 1 })),
      { key: 'std_dupe', kind: 'fixed', ref: 2 },
      { key: 'charges_heading', kind: 'fixed', body: 'Our charges' },
      { key: 'charges_detail', kind: 'field',
        body: 'Our charges are on an hourly basis at {hourly_rate} pounds per hour, exclusive of VAT. Disbursements of {disbursements} pounds are payable in addition.' },
      { key: 'conduct_heading', kind: 'fixed', body: 'Who is dealing with your matter' },
      { key: 'conduct_detail', kind: 'field',
        body: 'Handled by {fee_earner_name}, {fee_earner_title}, your day to day contact.' },
      { key: 'died', kind: 'field', body: 'The deceased died on {date_of_death}.' },
      { key: 'detail', kind: 'bespoke', prompt: 'What this letter is about.' },
    ],
    requiredFields: [
      'client_legal_name', 'matter_type', 'fee_earner_name',
      'firm_reference', 'matter_title', 'papers_heading', 'recipient_salutation',
      'costs_amount', 'hourly_rate',
    ],
    reviewRules: [],
  };

  const definition = normaliseDefinition(parsed, invariant);

  // 1. A standard clause appears once.
  const refs = definition.blocks.filter((b) => b.kind === 'fixed' && b.refIndex != null)
    .map((b) => b.refIndex);
  if (new Set(refs).size !== refs.length) fail(type, 'a standard clause appears twice');

  const optional = new Set([...SYSTEM_FIELDS, 'fee_earner_title', 'hourly_rate', 'costs_amount']);
  const assembled = assembleFixed(definition, VALUES, optional);

  // 2. No placeholder survives.
  for (const b of assembled.blocks) {
    if (/\{[a-z_]+\}/.test(String(b.body || ''))) fail(type, 'a placeholder survived', b.key);
  }

  // 3. No sentence left broken by a dropped value.
  for (const b of assembled.blocks) {
    const t = String(b.body || '');
    if (/\bat\s+pounds\b|\bof\s+pounds\b|\s,|\(\s*\)|\u0000/.test(t)) {
      fail(type, 'a sentence lost its value and was left broken', b.key);
    }
  }

  // 4. A date reads as a letter writes one.
  const dated = assembled.blocks.find((b) => b.key === 'died');
  if (dated && /\d{4}-\d{2}-\d{2}/.test(dated.body)) fail(type, 'a raw database date reached the letter');

  // 5. A heading with nothing under it does not print.
  const withBespoke = assembled.blocks.map((b) => (b.kind === 'bespoke' ? { ...b, body: '' } : b));
  const rendered = dropOrphanedHeadings(withBespoke);
  for (let i = 0; i < rendered.length; i += 1) {
    if (!isHeadingBlock(rendered[i])) continue;
    const next = rendered.slice(i + 1).find((b) => !isHeadingBlock(b));
    if (!next || !String(next.body || '').trim()) {
      fail(type, 'a heading printed with nothing under it', rendered[i].body);
    }
  }

  // 6. Nothing empty reaches the letter at all.
  if (rendered.some((b) => !String(b.body || '').trim())) fail(type, 'an empty block reached the letter');

  // 7. The checks catch a figure and a timescale the record cannot account for.
  const flags = runDeterministicRules(definition, [
    ...assembled.blocks.filter((b) => b.kind !== 'bespoke'),
    { key: 'detail', kind: 'bespoke',
      body: 'Our charges are 265 pounds per hour and this usually completes within six to eight weeks. We will advise under the Landlord and Tenant Act 1954.' },
  ], VALUES);
  if (!flags.some((f) => f.code === 'unexplained_figure')) fail(type, 'a copied figure was not caught');
  if (!flags.some((f) => f.code === 'unstated_timescale')) fail(type, 'an invented timescale was not caught');
  if (flags.some((f) => /1954/.test(f.message || ''))) fail(type, 'a statute year was flagged as a sum of money');

  // 8. Nothing identifying survives into what the model is shown.
  const shown = prepareForDrafting(docs.slice(0, 3), ['Mr and Mrs D Okonkwo']);
  for (const p of shown) {
    if (/[£$]\s?\d|\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b|Okonkwo/.test(p.body)) {
      fail(type, 'a precedent leaked something identifying');
    }
  }

  // 9. The form asks for nothing already known, derived, or unanswerable.
  const needs = whatIsNeeded({
    template: { definition },
    fields: Object.entries(VALUES).map(([key, value]) => ({ key, value, is_numeric: /fee|rate|total|amount/.test(key) })),
    history: [],
  });
  for (const n of needs.need) {
    if (isSystemField(n.key)) fail(type, 'asked for a system field', n.key);
    if (isFurnitureField(n.key)) fail(type, 'asked for a heading as a fact', n.key);
    if (satisfiedByAlternative(n.key, VALUES)) fail(type, 'asked for a field answered another way', n.key);
  }

  // 10. The letter renders, once, with nothing doubled.
  const pdf = await renderLetterPdf({
    document: { reference: '2026/93095', client_name: VALUES.client_legal_name,
      client_address: VALUES.client_address, doc_type: type },
    version: { version: 1, blocks: rendered },
    firm: FIRM, salutation: 'Mr and Mrs Okonkwo', dateText: '29 July 2026',
    sender: { name: 'Mohsin Ali' },
  });
  if (!pdf || pdf.length < 2000) fail(type, 'the letter did not render');
}

// 11. A placeholder never becomes a fact, whoever typed it.
for (const v of ['nan', 'NaN', 'n/a', 'unknown', '-', 'TBC', 'not mentioned', '']) {
  if (!isNotAValue(v)) fail('all', 'a placeholder would be stored as a fact', JSON.stringify(v));
}
for (const v of ['no', 'pending', '0', '1450']) {
  if (isNotAValue(v)) fail('all', 'a real answer would be discarded', JSON.stringify(v));
}

// 12. A status is never money, and a reference is never a question.
if (fieldMeta('costs_status').prefix) fail('all', 'a status was rendered as currency');
if (!isSystemField(canonicalKey('firm_reference'))) fail('all', 'a reference is asked for rather than generated');
if (!isSystemField(canonicalKey('recipient_salutation'))) fail('all', 'a salutation is asked for rather than derived');
if (!belongsToALetter('final_bill')) fail('all', 'a final bill is asked for at opening');

console.log(`${TYPES.length} letter types, ${12} classes of fault found today\n`);
if (failures.length === 0) {
  console.log('no fault reproduces on any type');
} else {
  for (const f of failures) console.log('  FAIL  ' + f);
  console.log(`\n${failures.length} failure(s)`);
  process.exit(1);
}
