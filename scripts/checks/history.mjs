import { accountOf, historyForDrafting } from '../../lib/history.js';

const ev = (kind, day, payload = {}) => ({
  kind, created_at: `2026-0${day[0]}-${day.slice(1)}T10:00:00Z`, payload,
});

// Newest first, as the database returns it.
const timeline = [
  ev('document_sent',   '714', { doc_type: 'closing_letter' }),
  ev('signed_in',       '714'),
  ev('document_issued', '620', { doc_type: 'completion_statement' }),
  ev('grounded_on',     '620', { letters: ['a', 'b'] }),
  ev('matter_corrected','515', { changed: {
      hourly_rate: { from: '265', to: '285' },
      client_email: { from: 'a@x.com', to: 'b@x.com' } } }),
  ev('access_granted',  '510', { user: 'Sarah Fenn' }),
  ev('document_sent',   '412', { doc_type: 'engagement_letter' }),
  ev('document_approved','411', { doc_type: 'engagement_letter' }),
  ev('document_generated','410',{ doc_type: 'engagement_letter' }),
  ev('matter_created',  '308'),
];

console.log('=== the account a letter can be written from ===');
for (const line of accountOf(timeline)) console.log('  ' + line);

console.log();
console.log('=== what must never appear in it ===');
const text = accountOf(timeline).join(' ');
for (const [what, needle] of [
  ['who signed in', 'signed in'],
  ['who was granted cover', 'Sarah Fenn'],
  ['which precedents were used', 'grounded'],
  ['a corrected email address', 'x.com'],
]) console.log(`  ${what.padEnd(28)} ${text.includes(needle) ? 'LEAKED' : 'absent'}`);

console.log();
console.log('=== a change the client was told about ===');
console.log('  fee change present:', text.includes('265') && text.includes('285'));

console.log();
console.log('=== a brand new matter ===');
console.log('  ' + JSON.stringify(historyForDrafting([])) + '  (nothing to recount)');
