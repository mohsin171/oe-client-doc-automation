// Field metadata.
//
// Templates declare which fields they need, as plain snake_case keys. This file
// turns those keys into something a person can fill in: a label, an input type,
// a group, and a hint where one helps.
//
// It is deliberately inference based rather than a fixed list, because a firm
// can add a template tomorrow that needs a field nobody anticipated. An unknown
// key still renders as a sensible text input rather than disappearing.

const KNOWN = {
  client_legal_name: { label: 'Client legal name', group: 'client', placeholder: 'As it appears on the document' },
  client_name:       { label: 'Client name', group: 'client' },
  client_address:    { label: 'Client address', group: 'client', type: 'textarea', rows: 2 },
  client_email:      { label: 'Client email', group: 'client', type: 'email' },
  client_phone:      { label: 'Client phone', group: 'client' },
  company_no:        { label: 'Company number', group: 'client' },
  company_number:    { label: 'Company number', group: 'client' },

  matter_subject:    { label: 'What the letter is about', group: 'matter',
                       placeholder: 'Divorce and financial settlement' },
  matter_type:       { label: 'Matter type', group: 'matter', placeholder: 'Conveyancing, probate, commercial' },
  matter_reference:  { label: 'Matter reference', group: 'matter' },
  fee_earner_name:   { label: 'Fee earner', group: 'matter', type: 'user', hidden: true },
  supervisor_name:   { label: 'Supervising partner', group: 'matter', type: 'user', auto: 'signed_in' },
  other_party:       { label: 'Other party', group: 'matter' },
  property_address:  { label: 'Property address', group: 'matter', type: 'textarea', rows: 2 },

  fee_basis:         { label: 'Fee basis', group: 'engagement', type: 'select',
                       options: ['hourly', 'fixed fee', 'capped fee', 'conditional fee'] },
  hourly_rate:       { label: 'Hourly rate', group: 'engagement', type: 'number', prefix: '£',
                       hint: 'Excluding VAT' },
  fixed_fee:         { label: 'Fixed fee', group: 'engagement', type: 'number', prefix: '£' },
  fee_estimate:      { label: 'Fee estimate', group: 'engagement', type: 'number', prefix: '£' },
  fee_cap:           { label: 'Fee cap', group: 'engagement', type: 'number', prefix: '£' },
  vat_rate:          { label: 'VAT rate', group: 'engagement', type: 'number', suffix: '%' },
  engagement_date:   { label: 'Engagement date', group: 'engagement', type: 'date' },
  completion_date:   { label: 'Target completion', group: 'engagement', type: 'date' },
  key_dates:         { label: 'Key dates', group: 'engagement', type: 'textarea', rows: 2 },

  scope_summary:     { label: 'Scope of work', group: 'scope', type: 'textarea', rows: 4 },
  exclusions:        { label: 'Exclusions', group: 'scope', type: 'textarea', rows: 3 },
  client_concerns:   { label: 'Anything unusual', group: 'scope', type: 'textarea', rows: 3 },
  // A client who asks not to be written to at home has given an instruction, not
  // expressed a concern, and a letter that ignores it is a letter that failed.
  standing_instructions: { label: 'Standing instructions', group: 'scope', type: 'textarea', rows: 2,
                       hint: 'How the client asks to be contacted, and anything else to observe' },
};

// Templates are written by a model reading a firm's documents, so it names
// fields however the letter happens to read: client_name in one, addressee in
// another. Without a shared vocabulary the form captures one set of names and
// the template demands a different set, and nothing ever lines up.
const ALIASES = {
  client_name: 'client_legal_name',
  client_full_name: 'client_legal_name',
  customer_name: 'client_legal_name',
  addressee: 'client_legal_name',
  addressee_name: 'client_legal_name',
  recipient_name: 'client_legal_name',

  // A reference, a title, a salutation. Every template names these differently and each
  // new name arrived as a fresh question. They are the same handful of things, and all of
  // them are already known or derived at generation.
  firm_reference: 'matter_reference',
  file_reference: 'matter_reference',
  our_reference: 'matter_reference',
  reference_number: 'matter_reference',

  matter_title: 'matter_subject',
  subject_line: 'matter_subject',
  re_line: 'matter_subject',
  matter_description: 'matter_subject',

  recipient_title: 'client_salutation',
  recipient_salutation: 'client_salutation',
  addressee_salutation: 'client_salutation',
  salutation: 'client_salutation',

  partner_title: 'supervisor_name',
  supervising_partner: 'supervisor_name',
  partner_name: 'supervisor_name',

  target_completion: 'completion_date',
  target_date: 'completion_date',

  client_address_block: 'client_address',
  addressee_address: 'client_address',
  recipient_address: 'client_address',

  // A template that prints the address as separate lines asked for each of them,
  // so a fee earner was typing an address they had already entered. Derived from
  // the one they gave instead.
  client_address_line_1: 'client_address_line_1',
  address_line_1: 'client_address_line_1',
  client_address_line_2: 'client_address_line_2',
  address_line_2: 'client_address_line_2',
  client_address_line_3: 'client_address_line_3',
  address_line_3: 'client_address_line_3',
  client_postcode: 'client_postcode',
  postcode: 'client_postcode',

  sender_name: 'fee_earner_name',
  author_name: 'fee_earner_name',
  solicitor_name: 'fee_earner_name',
  fee_earner: 'fee_earner_name',
  handler_name: 'fee_earner_name',
  signatory_name: 'fee_earner_name',

  supervising_partner: 'supervisor_name',
  supervising_solicitor: 'supervisor_name',
  supervisor: 'supervisor_name',
  supervising_partner_name: 'supervisor_name',
  partner_name: 'supervisor_name',
  responsible_partner: 'supervisor_name',

  sender_title: 'fee_earner_title',
  author_title: 'fee_earner_title',
  signatory_title: 'fee_earner_title',
  grade: 'fee_earner_title',

  reference_code: 'matter_reference',
  our_reference: 'matter_reference',
  file_reference: 'matter_reference',
  matter_ref: 'matter_reference',
  reference_number: 'matter_reference',

  date_of_letter: 'letter_date',
  document_date: 'letter_date',
  todays_date: 'letter_date',
  current_date: 'letter_date',

  salutation: 'client_salutation',
  greeting: 'client_salutation',

  work_type: 'matter_type',
  matter_description: 'scope_summary',
  subject: 'matter_subject',
  rate: 'hourly_rate',
  charge_rate: 'hourly_rate',
  hourly_charge: 'hourly_rate',
  firm: 'firm_name',
};

export function canonicalKey(key) {
  const k = String(key || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return ALIASES[k] || k;
}

// Things the system already knows. Asking a person for today's date or the
// reference it generated itself is not capture, it is busywork, and it blocks
// generation on information nobody needs to supply.
export const SYSTEM_FIELDS = [
  'letter_date', 'matter_reference', 'client_salutation',
  'firm_name', 'firm_address', 'fee_earner_title', 'matter_subject',
  // Cut from the address already given, never asked for again.
  'client_address_line_1', 'client_address_line_2', 'client_address_line_3',
  'client_postcode',
];

export function isSystemField(key) {
  return SYSTEM_FIELDS.includes(canonicalKey(key));
}

// Facts a letter of this kind needs, whether or not a template declares them.
//
// The extraction list was built only from what the templates required, and that is
// the wrong source. A firm whose charges paragraph names a different rate in every
// letter has a paragraph that varies, so it is written fresh rather than merged, so
// no placeholder declares the rate, so nothing looked for it in the notes, so the
// drafted paragraph had no figure to use and wrote around it. The fee earner had
// said "265 plus VAT" out loud and the letter went out saying "on an hourly basis".
//
// These are the facts an engagement letter turns on. They are asked for because a
// letter needs them, not because a placeholder happens to mention them.
// What is true at the moment a client is taken on.
//
// These belong on the opening form because a fee earner has just put the phone down and
// knows them. Everything else a later letter needs is not knowable yet: a final bill, a
// destruction date, what was completed, why an estimate was exceeded. Asking for those on
// day one produced a form of thirty eight fields, and a fee earner filling one in typed
// "nan" into the ones that made no sense, which is exactly what a form deserves when it
// asks a question nobody can answer.
const ALWAYS_EXTRACTABLE = [
  'matter_subject', 'standing_instructions',
  'fee_basis', 'hourly_rate', 'fixed_fee', 'fee_estimate', 'hours_estimate',
  'disbursements', 'vat_rate',
  'scope_summary', 'exclusions',
  'engagement_date', 'key_dates', 'completion_date', 'timescale',
  'other_party', 'property_address', 'client_concerns',
];

// Fields belonging to a particular letter rather than to the matter. Each is asked for
// when that letter is written, by which time it is knowable, and never before.
const PER_LETTER = new Set([
  'final_bill', 'papers_returned', 'destruction_date',
  'original_estimate', 'revised_estimate', 'reason',
  'what_completed', 'next_step', 'stage_reached',
  'outstanding_items', 'asked_on', 'costs_amount', 'costs_status',
  'complaints_route',
]);

export function belongsToALetter(key) {
  return PER_LETTER.has(canonicalKey(key));
}

// A value that means "there is no value".
//
// A form of thirty eight fields was answered with "nan", which is what a form deserves
// for asking a question nobody can answer. It then reached the record as a fact, and a
// letter would have printed it. Rule one is that a gap must never exist as a guess, and
// this is a gap wearing a value's clothes: whether a model wrote it or a person did, it
// is not a fact and it is not stored.
const NOT_A_VALUE = new Set([
  'nan', 'n/a', 'na', 'none', 'null', 'nil', 'undefined', 'unknown', 'tbc', 'tbd',
  '-', '--', '.', '?', 'x', 'xx', 'not mentioned', 'not applicable', 'not known',
  'not stated', 'not given', 'see notes', 'as above',
  // "no" and "pending" are left out on purpose. Whether papers were returned can
  // legitimately be answered no, and a costs position can legitimately be pending. A
  // list of non-answers that swallows real answers is worse than no list.
]);

// A heading is not a fact.
//
// Ingestion sometimes declares a heading as a required field, so a fee earner was asked
// to supply "papers heading" for a letter whose own headings are already among its
// standard clauses. Nothing can answer that question, and a form that asks it is asking
// somebody to invent a document's furniture.
export function isFurnitureField(key) {
  return /(_heading|_title_line|_header|_footer|_salutation_line)$/.test(canonicalKey(key));
}

// Some fields answer the same question two ways, and requiring both asks a firm to
// charge hourly and by fixed fee at once. A conveyancing matter agreed at a fixed fee of
// 1,450 was still being asked for an hourly rate, because a template that charges hourly
// declared one and nothing knew the two were alternatives.
const EITHER_OR = [
  ['hourly_rate', 'fixed_fee'],
  ['fee_estimate', 'fixed_fee'],
  ['hours_estimate', 'fixed_fee'],
];

export function satisfiedByAlternative(key, values = {}) {
  const k = canonicalKey(key);
  for (const pair of EITHER_OR) {
    if (!pair.includes(k)) continue;
    const other = pair.find((x) => x !== k);
    if (String(values[other] ?? '').trim()) return true;
  }
  return false;
}

export function isNotAValue(raw) {
  const v = String(raw ?? '').trim().toLowerCase().replace(/[.,;:]+$/, '');
  if (v === '') return true;
  return NOT_A_VALUE.has(v);
}

// Typed, never extracted. Exactness matters more than the seconds saved, and a
// misheard postcode is simply a wrong postcode.
export const HARD_FACTS = [
  'client_legal_name', 'client_email', 'client_phone', 'client_address',
  'company_no', 'company_number', 'matter_type', 'matter_reference',
  'fee_earner_name', 'supervisor_name', 'property_address', 'other_party',
];

// Facts that are never read out of notes, whatever the notes appear to say.
//
// A fee earner's notes about a lease name the premises, and a model asked for a
// client address will offer them, because they are an address and they are right
// there. It filed the property being leased as where the client lives. The
// instruction not to is worth giving, and is not worth relying on.
const NEVER_EXTRACTED = [
  'client_address', 'client_address_line_1', 'client_address_line_2',
  'client_address_line_3', 'client_postcode',
  'client_email', 'client_phone', 'client_legal_name',
  'matter_reference', 'firm_name', 'firm_address',
  // Boilerplate rather than a fact about the matter. A structure analysed before
  // short markings were counted still lists it, and a model asked for it will
  // happily invent one.
  'confidentiality_marking', 'confidentiality', 'marking',
];

export function neverExtracted(key) {
  return NEVER_EXTRACTED.includes(canonicalKey(key));
}

export function isHardFact(key) {
  return HARD_FACTS.includes(key);
}

// The order a person actually works through: who they are, how to reach them,
// where they are, then what the work is. Anything unlisted follows in the order
// its template declared it, which is closer to intent than the alphabet.
const FIELD_ORDER = [
  'client_legal_name', 'client_email', 'client_phone', 'client_address',
  'company_no', 'company_number',
  'matter_type', 'matter_reference', 'fee_earner_name', 'supervisor_name',
  'property_address', 'other_party',
  'fee_basis', 'hourly_rate', 'fixed_fee', 'fee_estimate', 'hours_estimate',
  'fee_cap', 'disbursements', 'vat_rate',
  'engagement_date', 'completion_date', 'key_dates',
  'scope_summary', 'exclusions', 'client_concerns',
];

export const GROUPS = [
  { key: 'client',     title: 'Client' },
  { key: 'matter',     title: 'The work' },
  { key: 'engagement', title: 'Fees and dates' },
  { key: 'scope',      title: 'Scope' },
];

function infer(key) {
  const k = key.toLowerCase();

  // Some suffixes settle it whatever the rest of the name says. "costs status" matched on
  // the word cost and was rendered as currency with a zero in it, so the form asked for a
  // position on costs in pounds. A status, a basis, a name or a heading is never money and
  // never a date.
  if (/_(status|basis|type|method|terms|reason|heading)$/.test(k)) {
    return { type: 'text', group: 'matter' };
  }

  if (/date|deadline|deadline_on/.test(k)) return { type: 'date', group: 'engagement' };
  if (/rate|fee|amount|cost|price|estimate|cap|total|deposit|balance/.test(k)) {
    return { type: 'number', group: 'engagement', prefix: '£' };
  }
  if (/percent|vat/.test(k)) return { type: 'number', group: 'engagement', suffix: '%' };
  if (/email/.test(k)) return { type: 'email', group: 'client' };
  if (/scope|summary|context|background|notes|description|concern|exclusion|instruction/.test(k)) {
    return { type: 'textarea', rows: 3, group: 'scope' };
  }
  if (/address/.test(k)) return { type: 'textarea', rows: 2, group: 'client' };
  if (/client|customer/.test(k)) return { type: 'text', group: 'client' };
  if (/earner|solicitor|partner|adviser|advisor|handler/.test(k)) return { type: 'user', group: 'matter' };
  return { type: 'text', group: 'matter' };
}

function titleise(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fieldMeta(rawKey) {
  const key = canonicalKey(rawKey);
  const known = KNOWN[key];
  const guessed = infer(key);
  return {
    key,
    label: known?.label || titleise(key),
    type: known?.type || guessed.type,
    group: known?.group || guessed.group,
    rows: known?.rows || guessed.rows,
    prefix: known?.prefix || guessed.prefix,
    suffix: known?.suffix || guessed.suffix,
    options: known?.options,
    hint: known?.hint,
    placeholder: known?.placeholder,
    auto: known?.auto,
    hidden: known?.hidden,
    // Figures always need explicit confirmation, whatever their source.
    numeric: (known?.type || guessed.type) === 'number',
  };
}

// The union of everything the firm's active templates need, plus the few fields
// every matter has regardless. Ordered by group so the form reads sensibly.
// The form for opening a client.
//
// `opening: true` keeps out anything belonging to a particular letter. A firm with seven
// kinds of letter has seven sets of requirements, and pooling them asked a fee earner on
// day one about the final bill and the destruction date. Each letter asks for its own
// when it is written.
export function buildFormSchema(templates, coreFields = [], { opening = false } = {}) {
  const keys = new Set(coreFields.map(canonicalKey));
  const usedBy = new Map();

  // Asked for because a letter needs them, not because a template mentions them.
  for (const k of ALWAYS_EXTRACTABLE) keys.add(canonicalKey(k));

  for (const t of templates) {
    for (const raw of (t.definition?.requiredFields || [])) {
      const f = canonicalKey(raw);
      // Never put a system field on the form. It is filled at generation.
      if (isSystemField(f)) continue;
      // On the opening form, skip anything belonging to a letter that will be written
      // later. On day one nobody knows the final bill.
      if (opening && belongsToALetter(f)) continue;
      keys.add(f);
      if (!usedBy.has(f)) usedBy.set(f, []);
      usedBy.get(f).push(t.name);
    }
  }

  const fields = [...keys]
    .map((k) => ({ ...fieldMeta(k), usedBy: usedBy.get(k) || [], hard: isHardFact(k) }))
    .filter((f) => !f.hidden);

  const groupOrder = GROUPS.map((g) => g.key);
  const rank = (k) => {
    const i = FIELD_ORDER.indexOf(k);
    return i === -1 ? FIELD_ORDER.length : i;
  };

  fields.sort((a, b) => {
    const ga = groupOrder.indexOf(a.group);
    const gb = groupOrder.indexOf(b.group);
    if (ga !== gb) return ga - gb;
    const ra = rank(a.key);
    const rb = rank(b.key);
    if (ra !== rb) return ra - rb;
    return a.label.localeCompare(b.label);
  });
  return fields;
}

// Split into what a person types and what the system looks for in their notes.
export function splitSchema(schema) {
  return {
    typed: schema.filter((f) => f.hard),
    // Anything on the never-extracted list stays off the list the model is shown,
    // so it cannot offer a value for it however plausible one looks in the notes.
    extracted: schema.filter((f) => !f.hard && !neverExtracted(f.key)),
  };
}
