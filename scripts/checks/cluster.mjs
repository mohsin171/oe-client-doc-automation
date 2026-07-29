// Can the engine sort an unsorted pile of letters into kinds?
//
// This is the exact situation a firm creates: 140 letters of seven kinds, in one upload,
// in no order. Before this existed the counting found four standard clauses across the
// lot and produced one useless template.
import { readFileSync, readdirSync } from 'node:fs';
import { groupByKind, describeGrouping } from '../../lib/cluster.js';
import { findInvariants } from '../../lib/ingest.js';

const DIRS = {
  'engagement': 'corpus-batch2',
  'client care': 'corpus-client-care',
  'status update': 'corpus-status-update',
  'chasing': 'corpus-chasing-letter',
  'estimate revision': 'corpus-estimate-revision',
  'completion': 'corpus-completion',
  'closing': 'corpus-closing',
};

// Shuffled, because a firm's folder is not in order and the grouping must not depend on
// arriving sorted.
const all = [];
for (const [kind, dir] of Object.entries(DIRS)) {
  for (const f of readdirSync(`scripts/${dir}`)) {
    if (f.endsWith('.txt')) {
      all.push({ name: f, text: readFileSync(`scripts/${dir}/${f}`, 'utf8'), truth: kind });
    }
  }
}
let seed = 7;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
all.sort(() => rand() - 0.5);

console.log(`${all.length} letters of ${Object.keys(DIRS).length} kinds, shuffled\n`);

const result = groupByKind(all);
const desc = describeGrouping(result);
console.log(desc.summary);
console.log(`house style: ${desc.houseClauses} paragraphs in more than half the pile\n`);

let correct = 0;
let total = 0;
for (const g of result.groups) {
  const kinds = {};
  for (const name of g.names) {
    const truth = all.find((d) => d.name === name).truth;
    kinds[truth] = (kinds[truth] || 0) + 1;
  }
  const [dominant, n] = Object.entries(kinds).sort((a, b) => b[1] - a[1])[0];
  correct += n;
  total += g.size;

  const { invariant } = findInvariants(g.documents.map((d) => d.text));
  const mixed = Object.keys(kinds).length > 1
    ? '  MIXED: ' + Object.entries(kinds).map(([k, c]) => `${c} ${k}`).join(', ')
    : '';
  console.log(`  ${String(g.size).padStart(3)} letters  ${dominant.padEnd(18)} ${String(invariant.length).padStart(2)} standard clauses${mixed}`);
}

if (result.ungrouped.length) console.log(`\n  ${result.ungrouped.length} ungrouped`);

console.log(`\nsorted correctly: ${correct} of ${total} (${Math.round(100 * correct / total)}%)`);

const clean = result.groups.every((g) => findInvariants(g.documents.map((d) => d.text)).invariant.length >= 6);
console.log(`every group yields at least six standard clauses: ${clean}`);

if (!clean || correct / total < 0.95 || result.groups.length < 6) {
  console.error('\ngrouping is not good enough to rely on');
  process.exit(1);
}
