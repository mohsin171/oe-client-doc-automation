// Do the queries reference columns that exist?
//
// A wrong column name is valid JavaScript and a valid template string, so
// nothing catches it until the query runs. On a serverless platform that means a
// user sees it first, which is how "column m.matter_id does not exist" reached a
// deployment.
//
// This reads the real table shapes out of the schema and the migrations, finds
// every tagged sql template, works out which table each alias refers to, and
// checks every qualified column against it. Only inside sql templates, so an
// ordinary JavaScript property access is not mistaken for a column.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const tables = new Map();

function readColumns(body) {
  const cols = new Set();
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('--')) continue;
    if (/^(UNIQUE|PRIMARY|FOREIGN|CHECK)\b/i.test(line)) continue;
    const col = line.split(/\s+/)[0].replace(/,$/, '');
    if (/^[a-z_]+$/.test(col)) cols.add(col);
  }
  return cols;
}

function ingest(sqlText) {
  const create = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\);/g;
  let m;
  while ((m = create.exec(sqlText))) {
    const cols = tables.get(m[1]) || new Set();
    for (const c of readColumns(m[2])) cols.add(c);
    tables.set(m[1], cols);
  }
  const alter = /ALTER TABLE (\w+) ADD COLUMN (?:IF NOT EXISTS )?(\w+)/g;
  while ((m = alter.exec(sqlText))) {
    const cols = tables.get(m[1]) || new Set();
    cols.add(m[2]);
    tables.set(m[1], cols);
  }
}

for (const f of readdirSync('db').filter((f) => f.endsWith('.sql'))) {
  ingest(readFileSync(path.join('db', f), 'utf8'));
}

let problems = 0;
let queries = 0;

for (const dir of ['api', 'lib']) {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(path.join(dir, file), 'utf8');
    const templates = src.match(/sql`[\s\S]*?`/g) || [];
    for (const q of templates) {
      queries += 1;
      const aliases = new Map();
      const from = /\b(?:FROM|JOIN)\s+(\w+)\s+(\w+)\b/gi;
      let a;
      while ((a = from.exec(q))) {
        if (tables.has(a[1])) aliases.set(a[2], a[1]);
      }
      for (const [alias, table] of aliases) {
        const used = new Set();
        const re = new RegExp(`\\b${alias}\\.(\\w+)\\b`, 'g');
        let c;
        while ((c = re.exec(q))) used.add(c[1]);
        for (const col of used) {
          if (col === '*') continue;
          if (!tables.get(table).has(col)) {
            console.error(`  ${dir}/${file}: ${alias}.${col} — ${table} has no column of that name`);
            problems += 1;
          }
        }
      }
    }
  }
}

if (problems) {
  console.error(`\n${problems} bad column reference${problems > 1 ? 's' : ''}.`);
  process.exit(1);
}
console.log(`${queries} queries reference only columns that exist`);
