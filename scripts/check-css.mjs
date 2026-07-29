// The stylesheet must parse. A build guard, because it failed silently once.
//
// An optimisation pass removed a rule and ate its closing comment marker, leaving
// `}/* A section carrying an open flag says so where the passage is {`. That comment
// then ran on for twenty three lines and commented out six rules, including the one
// laying out the review buttons. Nothing failed. The build succeeded, the page
// rendered, and the buttons quietly sat six pixels apart for a day.
//
// Two things are checked: comment markers balance, and braces balance. Either one
// being wrong silently deletes rules.
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

const opens = (css.match(/\/\*/g) || []).length;
const closes = (css.match(/\*\//g) || []).length;
if (opens !== closes) {
  console.error(`styles.css: ${opens} comment openings and ${closes} closings.`);
  console.error('An unclosed comment silently deletes every rule until the next one closes.');
  process.exit(1);
}

// Blank the comments, keeping line numbers, then walk the braces.
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) || []).length));
let depth = 0;
const lines = stripped.split('\n');
for (let i = 0; i < lines.length; i += 1) {
  depth += (lines[i].match(/\{/g) || []).length;
  depth -= (lines[i].match(/\}/g) || []).length;
  if (depth < 0) {
    console.error(`styles.css line ${i + 1}: a closing brace with nothing open.`);
    console.error(`  ${lines[i].trim()}`);
    process.exit(1);
  }
}
if (depth !== 0) {
  console.error(`styles.css: ${depth} rule(s) left unclosed at the end of the file.`);
  process.exit(1);
}

const rules = (stripped.match(/\{/g) || []).length;
console.log(`${rules} rules, comments and braces balanced`);
