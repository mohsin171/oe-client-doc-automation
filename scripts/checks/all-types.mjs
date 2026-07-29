// Every letter type through the whole engine, as far as it goes without a model.
//
// Ingestion, invariant counting, assembly, the checks and the needs engine are all
// deterministic, so all of that can be exercised here. Only the drafting and the review
// need the API, and those are the two steps the checks exist to police.
import { readFileSync, readdirSync } from 'node:fs';
import { findInvariants } from '../../lib/ingest.js';
import { assembleFixed, runDeterministicRules } from '../../lib/engine.js';
import { whatIsNeeded, captureIntro } from '../../lib/needs.js';
import { prepareForDrafting } from '../../lib/redact.js';
import { queryForMatter } from '../../lib/relevance.js';
import { historyForDrafting } from '../../lib/history.js';
import { SYSTEM_FIELDS, canonicalKey } from '../../lib/fields.js';

const TYPES = [
  ['engagement letter', 'corpus-batch2'],
  ['client care', 'corpus-client-care'],
  ['status update', 'corpus-status-update'],
  ['chasing letter', 'corpus-chasing-letter'],
  ['estimate revision', 'corpus-estimate-revision'],
  ['completion', 'corpus-completion'],
  ['closing letter', 'corpus-closing'],
];

const read = (d) => readdirSync(`scripts/${d}`).filter((f) => f.endsWith('.txt'))
  .map((f) => ({ name: f, body: readFileSync(`scripts/${d}/${f}`, 'utf8') }));

// A file part-way through a matter, as it would be by the time most of these are sent.
const FIELDS = [
  ['client_legal_name', 'Mr Nathaniel Boakye'], ['client_email', 'n.boakye@example.com'],
  ['client_address', '5 Beckett Grove, Leeds LS9 6DL'], ['matter_type', 'Employment'],
  ['fee_earner_name', 'Sarah Fenn'], ['supervisor_name', 'James Harrow'],
  ['scope_summary', 'Reviewing the settlement agreement and advising on its terms.'],
  ['exclusions', 'Not advising on tax. Not bringing a tribunal claim.'],
  ['hourly_rate', '215'], ['fee_estimate', '750'], ['final_bill', '690'],
].map(([key, value]) => ({ key, value, is_numeric: /rate|fee|bill/.test(key), source: 'typed' }));

const HISTORY = [
  { kind: 'document_sent', created_at: '2026-06-20T10:00:00Z', payload: { doc_type: 'status_update' } },
  { kind: 'matter_corrected', created_at: '2026-05-15T10:00:00Z', payload: { changed: { hourly_rate: { from: '215', to: '240' } } } },
  { kind: 'document_sent', created_at: '2026-04-12T10:00:00Z', payload: { doc_type: 'engagement_letter' } },
  { kind: 'matter_created', created_at: '2026-04-08T10:00:00Z' },
];

const values = Object.fromEntries(FIELDS.map((f) => [f.key, f.value]));
let failures = 0;

for (const [label, dir] of TYPES) {
  const docs = read(dir);
  const { invariant, varying } = findInvariants(docs.map((d) => d.body));

  // What the model would be shown, redacted. This is the confidentiality guarantee and
  // it has to hold for every type, not only the one it was built against.
  const shown = prepareForDrafting(docs.slice(0, 3), ['Mr Nathaniel Boakye', 'Cawthorne Fabrications Limited']);
  const leaked = shown.some((p) => /[£$]\s?\d|\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b|Boakye|Cawthorne/.test(p.body));

  // A template as ingestion would build it: the counted clauses fixed, one merged line,
  // one section written fresh.
  const template = {
    name: label,
    definition: {
      blocks: [
        ...invariant.slice(0, 8).map((inv, n) => ({ key: `std_${n}`, kind: 'fixed', body: inv.text })),
        { key: 'charges', kind: 'field', body: 'Our charges are {hourly_rate} pounds per hour, exclusive of VAT.' },
        { key: 'detail', kind: 'bespoke', prompt: 'What this letter is about.' },
      ],
      requiredFields: ['client_legal_name', 'matter_type', 'fee_earner_name', 'hourly_rate'],
    },
  };

  const assembled = assembleFixed(template.definition, values, new Set(SYSTEM_FIELDS));
  const needs = whatIsNeeded({ template, fields: FIELDS, history: HISTORY });
  const intro = captureIntro(needs);

  // The checks, on a letter where the drafted section has copied a rate from elsewhere.
  const bad = [...assembled.blocks, { key: 'detail', kind: 'bespoke', body: 'Our charges are 195 pounds per hour and we estimate six to eight weeks.' }];
  const flags = runDeterministicRules(template.definition, bad, values);

  const query = queryForMatter(values);
  const account = historyForDrafting(HISTORY);

  const ok = {
    counted: invariant.length >= 6,
    assembled: assembled.unresolved.length === 0,
    redacted: !leaked,
    ready: needs.need.length === 0,
    catches: flags.some((f) => f.code === 'unexplained_figure')
      && flags.some((f) => f.code === 'unstated_timescale'),
    retrieves: query.length > 10,
    recounts: account.includes('engagement letter'),
  };

  const bad_ = Object.entries(ok).filter(([, v]) => !v).map(([k]) => k);
  if (bad_.length) failures += 1;

  console.log(`${label.padEnd(19)} ${invariant.length.toString().padStart(2)} standard  ${varying.length.toString().padStart(3)} varying  `
    + `${bad_.length === 0 ? 'all steps pass' : 'FAILS: ' + bad_.join(', ')}`);
  console.log(`${''.padEnd(19)} asks for: ${needs.need.length === 0 ? 'nothing, everything is on file' : needs.need.map((n) => n.key).join(', ')}`);
  console.log(`${''.padEnd(19)} note ${needs.note}, ${needs.recheck.length} figure(s) to recheck, "${intro.title}"`);
  console.log(`${''.padEnd(19)} checks caught: ${flags.map((f) => f.code).join(', ') || 'nothing'}`);
  console.log();
}

console.log(failures === 0
  ? 'every letter type passes every deterministic step'
  : `${failures} letter type(s) failed`);
if (failures > 0) process.exit(1);
