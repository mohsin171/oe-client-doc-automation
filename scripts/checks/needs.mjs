import { whatIsNeeded, captureIntro } from '../../lib/needs.js';

const engagement = { definition: { requiredFields: [
  'client_legal_name','client_email','client_address','matter_type','fee_earner_name',
  'supervisor_name','scope_summary','exclusions','hourly_rate','fee_estimate'],
  blocks: [{kind:'bespoke',key:'scope'},{kind:'bespoke',key:'charges'},{kind:'fixed',key:'a'}] } };

const closing = { definition: { requiredFields: [
  'client_legal_name','matter_type','fee_earner_name','final_bill','papers_returned',
  'destruction_date','scope_summary'],
  blocks: [{kind:'bespoke',key:'what_we_did'},{kind:'fixed',key:'a'},{kind:'fixed',key:'b'}] } };

const chase = { definition: { requiredFields: ['client_legal_name','matter_type','fee_earner_name'],
  blocks: [{kind:'fixed',key:'a'},{kind:'field',key:'b'}] } };

const f = (k, v, numeric=false) => ({ key:k, value:v, source:'typed', is_numeric:numeric });

const NEW_MATTER = [];
const MID_MATTER = [
  f('client_legal_name','Mr Nathaniel Boakye'), f('client_email','n@x.com'),
  f('client_address','5 Beckett Grove, Leeds'), f('matter_type','Employment'),
  f('fee_earner_name','Mohsin Ali'), f('supervisor_name','Mohsin Ali'),
  f('scope_summary','Reviewing the settlement agreement and advising.'),
  f('exclusions','Not advising on tax. Not bringing a tribunal claim.'),
  f('hourly_rate','215', true), f('fee_estimate','750', true),
];
const HISTORY = [
  {kind:'matter_opened'},{kind:'document_generated'},{kind:'document_approved'},{kind:'document_sent'},
];

const cases = [
  ['engagement, new matter',      engagement, NEW_MATTER, []],
  ['engagement, matter underway', engagement, MID_MATTER, HISTORY],
  ['closing, matter underway',    closing,    MID_MATTER, HISTORY],
  ['chase, matter underway',      chase,      MID_MATTER, HISTORY],
];

for (const [label, template, fields, history] of cases) {
  const r = whatIsNeeded({ template, fields, history });
  const intro = captureIntro(r, label.split(',')[0]);
  console.log('\n' + label);
  console.log('  already on file :', r.have.length, r.have.length ? '(' + r.have.map(h=>h.key).join(', ') + ')' : '');
  console.log('  must be asked   :', r.need.length, r.need.length ? '(' + r.need.map(n=>n.key).join(', ') + ')' : '');
  console.log('  needs a note    :', r.note);
  console.log('  can use history :', r.canDrawOnHistory);
  console.log('  worth a recheck :', r.recheck.length, r.recheck.length ? '(' + r.recheck.map(h=>h.key+' = '+h.value).join(', ') + ')' : '');
  console.log('  form opens with :', JSON.stringify(intro.title));
  console.log('                   ', intro.hint);
}
