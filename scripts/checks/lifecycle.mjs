// The whole point, tested end to end without a database: one client, three letters
// over the life of a matter, and what the system asks for at each stage.
import { readFileSync, readdirSync } from 'node:fs';
import { whatIsNeeded, captureIntro } from '../../lib/needs.js';
import { findInvariants } from '../../lib/ingest.js';
import { historyForDrafting } from '../../lib/history.js';

const dir = (d) => readdirSync(d).filter((f) => f.endsWith('.txt')).map((f) => readFileSync(`${d}/${f}`, 'utf8'));

// Two real corpora, counted the way the product counts them.
for (const [name, path] of [['engagement', 'scripts/corpus-batch2'], ['closing', 'scripts/corpus-closing']]) {
  const { invariant, varying } = findInvariants(dir(path));
  console.log(`${name.padEnd(12)} ${invariant.length} standard, ${varying.length} varying`);
}

const engagement = { name: 'Engagement Letter', definition: { requiredFields: [
  'client_legal_name','client_email','client_address','matter_type','fee_earner_name',
  'scope_summary','exclusions','hourly_rate','fee_estimate'],
  blocks: [{kind:'bespoke'},{kind:'bespoke'},{kind:'fixed'}] } };
const closing = { name: 'Closing Letter', definition: { requiredFields: [
  'client_legal_name','matter_type','fee_earner_name','final_bill','papers_returned'],
  blocks: [{kind:'bespoke'},{kind:'fixed'},{kind:'fixed'}] } };

const f = (k, v, num = false) => ({ key: k, value: v, is_numeric: num, source: 'typed' });
const ev = (kind, iso, payload = {}) => ({ kind, created_at: iso, payload });

const stages = [
  ['day one, nothing on file', [], []],
  ['after the engagement letter', [
      f('client_legal_name','Mr Nathaniel Boakye'), f('client_email','n@x.com'),
      f('client_address','5 Beckett Grove, Leeds'), f('matter_type','Employment'),
      f('fee_earner_name','Sarah Fenn'), f('scope_summary','Reviewing the settlement agreement.'),
      f('exclusions','Not advising on tax.'), f('hourly_rate','215', true), f('fee_estimate','750', true),
    ], [
      ev('document_sent','2026-04-12T10:00:00Z',{doc_type:'engagement_letter'}),
      ev('document_approved','2026-04-11T10:00:00Z',{doc_type:'engagement_letter'}),
      ev('matter_created','2026-04-08T10:00:00Z'),
    ]],
  ['at the end of the matter', [
      f('client_legal_name','Mr Nathaniel Boakye'), f('client_email','n@x.com'),
      f('client_address','5 Beckett Grove, Leeds'), f('matter_type','Employment'),
      f('fee_earner_name','Sarah Fenn'), f('scope_summary','Reviewing the settlement agreement.'),
      f('exclusions','Not advising on tax.'), f('hourly_rate','215', true), f('fee_estimate','750', true),
      f('final_bill','690', true), f('papers_returned','Signed agreement enclosed'),
    ], [
      ev('document_sent','2026-06-20T10:00:00Z',{doc_type:'settlement_advice'}),
      ev('matter_corrected','2026-05-15T10:00:00Z',{changed:{hourly_rate:{from:'215',to:'240'}}}),
      ev('document_sent','2026-04-12T10:00:00Z',{doc_type:'engagement_letter'}),
      ev('matter_created','2026-04-08T10:00:00Z'),
    ]],
];

for (const [stage, fields, history] of stages) {
  console.log(`\n--- ${stage} ---`);
  for (const t of [engagement, closing]) {
    const n = whatIsNeeded({ template: t, fields, history });
    const intro = captureIntro(n);
    const state = n.need.length === 0 ? 'ready' : `needs ${n.need.map((x) => x.key).join(', ')}`;
    console.log(`  ${t.name.padEnd(18)} ${state}`);
    console.log(`  ${''.padEnd(18)} note ${n.note}, history ${n.canDrawOnHistory ? 'available' : 'none'}${n.recheck.length ? ', recheck ' + n.recheck.map((r) => r.key).join('/') : ''}`);
    console.log(`  ${''.padEnd(18)} "${intro.title}"`);
  }
  const acct = historyForDrafting(history);
  console.log(`  the account passed to drafting: ${acct ? acct.split('\n').filter((l) => l.startsWith('- ')).length + ' events' : 'none'}`);
}
