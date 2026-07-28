// What a matter is about, in the few words worth searching on.
//
// The whole record is the wrong query. A client's address, a fee basis and an
// hourly rate appear in every letter a firm sends, so including them ranks every
// letter equally and the search does nothing. What distinguishes this matter from
// the last one is the area of work and the scope: a divorce, a freehold purchase,
// an estate.
//
// Kept out of the store so it can be read and tested on its own, which matters
// because a bad query is invisible: retrieval still returns five letters and they
// are quietly the wrong five.

// Fields that describe the work. Anything not here is either administrative or
// true of every matter.
const DESCRIBES_THE_WORK = [
  'matter_type',
  'scope_summary',
  'matter_subject',
  'exclusions',
  'property_address',
  'other_party',
  'client_concerns',
];

// Words that appear in every letter a solicitor writes, so they carry no signal
// and crowd out the terms that do. Postgres removes ordinary English stopwords
// itself; these are the trade's own.
const TRADE_NOISE = new Set([
  'client', 'clients', 'matter', 'matters', 'letter', 'letters', 'firm', 'solicitor',
  'solicitors', 'act', 'acting', 'instructed', 'instructions', 'work', 'advise',
  'advice', 'advising', 'terms', 'charge', 'charges', 'charged', 'fee', 'fees',
  'hourly', 'rate', 'vat', 'estimate', 'costs', 'basis', 'per', 'hour', 'hours',
  'please', 'will', 'shall', 'may', 'we', 'you', 'your', 'our', 'us',
]);

export function queryForMatter(values = {}, matter = {}) {
  const parts = [];

  // The area of work first and twice, because it is the strongest single signal
  // and repetition is how weight is expressed in a text query.
  const area = String(values.matter_type || matter.matter_type || '').trim();
  if (area) parts.push(area, area);

  for (const key of DESCRIBES_THE_WORK) {
    if (key === 'matter_type') continue;
    const v = values[key];
    if (v) parts.push(String(v));
  }

  const words = parts
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !TRADE_NOISE.has(w));

  // First mentions win. A scope paragraph names the work at the start and then
  // qualifies it, so the opening terms are the ones that distinguish it.
  const seen = new Set();
  const distinct = [];
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    distinct.push(w);
    if (distinct.length >= 24) break;
  }

  return distinct.join(' ');
}

// What the letter was grounded on, in a form a reviewer can read. A drafted
// paragraph is worth more when a person can see it was built on three real
// letters the firm sent than on a model's sense of how solicitors write.
export function describeGrounding(precedents = []) {
  return precedents.map((p) => ({
    name: String(p.section_key || '').replace(/^corpus:/, ''),
    matched: p.score != null,
  }));
}
