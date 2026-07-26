// Does every server module actually load?
//
// ESLint's no-undef catches an undefined variable. It does not catch importing
// a name the source module never exported: that is valid syntax everywhere and
// only fails when the module is instantiated, which on a serverless platform
// means at the first request, as a 500 with no useful message.
//
// This is the check that finds it, and it belongs in the build.

import { readdirSync } from 'node:fs';

process.env.DATABASE_URL ||= 'postgres://placeholder/db';
process.env.SESSION_SECRET ||= 'x'.repeat(40);

const files = [
  ...readdirSync('lib').filter((f) => f.endsWith('.js')).map((f) => `lib/${f}`),
  ...readdirSync('api').filter((f) => f.endsWith('.js')).map((f) => `api/${f}`),
];

let failed = 0;
for (const f of files) {
  try {
    await import(`../${f}`);
  } catch (err) {
    failed += 1;
    console.error(`  ${f}\n    ${String(err.message).split('\n')[0]}`);
  }
}

if (failed) {
  console.error(`\n${failed} module${failed > 1 ? 's' : ''} failed to load.`);
  process.exit(1);
}
console.log(`${files.length} modules load cleanly`);
