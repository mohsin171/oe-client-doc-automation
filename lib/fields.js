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
  client_legal_name: { label: 'Client legal name', group: 'client', hint: 'Exactly as it should appear on the document' },
  client_name:       { label: 'Client name', group: 'client' },
  client_address:    { label: 'Client address', group: 'client', type: 'textarea', rows: 2 },
  client_email:      { label: 'Client email', group: 'client', type: 'email',
                       hint: 'Where documents will be sent. Not printed on the letter itself' },
  client_phone:      { label: 'Client phone', group: 'client' },
  company_no:        { label: 'Company number', group: 'client' },
  company_number:    { label: 'Company number', group: 'client' },

  matter_type:       { label: 'Matter type', group: 'matter', hint: 'Conveyancing, probate, commercial, and so on' },
  matter_reference:  { label: 'Matter reference', group: 'matter' },
  fee_earner_name:   { label: 'Fee earner', group: 'matter', type: 'user', hint: 'The person who spoke to the client' },
  supervisor_name:   { label: 'Supervising partner', group: 'matter', type: 'user' },
  other_party:       { label: 'Other party', group: 'matter' },
  property_address:  { label: 'Property address', group: 'matter', type: 'textarea', rows: 2 },

  fee_basis:         { label: 'Fee basis', group: 'engagement', type: 'select',
                       options: ['hourly', 'fixed fee', 'capped fee', 'conditional fee'] },
  hourly_rate:       { label: 'Hourly rate', group: 'engagement', type: 'number', prefix: '£',
                       hint: 'Excluding VAT. Confirmed before any document is generated' },
  fixed_fee:         { label: 'Fixed fee', group: 'engagement', type: 'number', prefix: '£' },
  fee_estimate:      { label: 'Fee estimate', group: 'engagement', type: 'number', prefix: '£' },
  fee_cap:           { label: 'Fee cap', group: 'engagement', type: 'number', prefix: '£' },
  vat_rate:          { label: 'VAT rate', group: 'engagement', type: 'number', suffix: '%' },
  engagement_date:   { label: 'Engagement date', group: 'engagement', type: 'date' },
  completion_date:   { label: 'Target completion', group: 'engagement', type: 'date' },
  key_dates:         { label: 'Key dates', group: 'engagement', type: 'textarea', rows: 2 },

  scope_summary:     { label: 'Scope of work', group: 'scope', type: 'textarea', rows: 4,
                       hint: 'What is included, and what is not. This is what the drafted section is built from' },
  exclusions:        { label: 'Exclusions', group: 'scope', type: 'textarea', rows: 3 },
  client_concerns:   { label: 'Anything unusual', group: 'scope', type: 'textarea', rows: 3,
                       hint: 'Concerns raised, or anything atypical about this matter' },
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

  client_address_block: 'client_address',
  addressee_address: 'client_address',
  recipient_address: 'client_address',

  sender_name: 'fee_earner_name',
  author_name: 'fee_earner_name',
  solicitor_name: 'fee_earner_name',
  fee_earner: 'fee_earner_name',
  handler_name: 'fee_earner_name',
  signatory_name: 'fee_earner_name',

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
];

export function isSystemField(key) {
  return SYSTEM_FIELDS.includes(canonicalKey(key));
}

// Typed, never extracted. Exactness matters more than the seconds saved, and a
// misheard postcode is simply a wrong postcode.
export const HARD_FACTS = [
  'client_legal_name', 'client_email', 'client_phone', 'client_address',
  'company_no', 'company_number', 'matter_type', 'matter_reference',
  'fee_earner_name', 'property_address', 'other_party',
];

export function isHardFact(key) {
  return HARD_FACTS.includes(key);
}

export const GROUPS = [
  { key: 'client',     title: 'Client',     note: 'Identity and contact details. These must be exactly right, so they are typed rather than inferred.' },
  { key: 'matter',     title: 'Matter',     note: 'What the work is, and who is responsible for it.' },
  { key: 'engagement', title: 'Fees and dates', note: 'Every figure here is confirmed by a person before any document can be generated.' },
  { key: 'scope',      title: 'Scope and context', note: 'The parts that genuinely differ each time. This is what the drafted sections are grounded on.' },
];

function infer(key) {
  const k = key.toLowerCase();
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
    // Figures always need explicit confirmation, whatever their source.
    numeric: (known?.type || guessed.type) === 'number',
  };
}

// The union of everything the firm's active templates need, plus the few fields
// every matter has regardless. Ordered by group so the form reads sensibly.
export function buildFormSchema(templates, coreFields = []) {
  const keys = new Set(coreFields.map(canonicalKey));
  const usedBy = new Map();

  for (const t of templates) {
    for (const raw of (t.definition?.requiredFields || [])) {
      const f = canonicalKey(raw);
      // Never put a system field on the form. It is filled at generation.
      if (isSystemField(f)) continue;
      keys.add(f);
      if (!usedBy.has(f)) usedBy.set(f, []);
      usedBy.get(f).push(t.name);
    }
  }

  const fields = [...keys].map((k) => ({
    ...fieldMeta(k),
    usedBy: usedBy.get(k) || [],
    hard: isHardFact(k),
  }));

  const order = GROUPS.map((g) => g.key);
  fields.sort((a, b) => {
    const ga = order.indexOf(a.group);
    const gb = order.indexOf(b.group);
    if (ga !== gb) return ga - gb;
    return a.label.localeCompare(b.label);
  });
  return fields;
}

// Split into what a person types and what the system looks for in their notes.
export function splitSchema(schema) {
  return {
    typed: schema.filter((f) => f.hard),
    extracted: schema.filter((f) => !f.hard),
  };
}
