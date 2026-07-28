// Precedents are shown to the model for register and phrasing. They are other
// clients' letters.
//
// A fee figure crossing from one client's letter into another's is a mistake. A
// name, an address or a reference crossing over is a breach of confidence, and the
// same mechanism produces both: the model is shown a real letter and asked not to
// use what it can see. It took three fee figures out of the examples on the first
// real test, which is the instruction failing rather than the model misbehaving.
//
// So the details are removed before the model sees them. What survives is how the
// firm writes: sentence shapes, register, the order things are explained in, the
// phrases they reach for. What goes is everything that belongs to a particular
// client. A figure that was never shown cannot be copied, and that is a guarantee
// where an instruction is a hope.
//
// Deliberately blunt. Over-redacting costs a little phrasing quality; under-
// redacting puts one client's affairs in another client's letter.

const REPLACEMENTS = [
  // Money, with or without a symbol or the word pounds.
  [/[£$€]\s?\d[\d,]*(?:\.\d+)?/g, '[amount]'],
  [/\b\d[\d,]*(?:\.\d+)?\s*(?:pounds|GBP|p\.a\.|per annum)\b/gi, '[amount]'],

  // Anything that looks like a file reference: AV/2026/3100, HF-2026-105, 2026/05429.
  [/\b[A-Z]{1,4}[\/-]\d{2,4}[\/-]\d{2,6}\b/g, '[reference]'],
  [/\b\d{4}\/\d{4,6}\b/g, '[reference]'],

  // Contact details.
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[email]'],
  [/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g, '[postcode]'],
  [/\b(?:\+44\s?|0)\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g, '[phone]'],

  // Dates in any of the forms a letter uses.
  [/\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi, '[date]'],
  [/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi, '[date]'],
  [/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/g, '[date]'],

  // A statute year is part of a name, not a detail, so it is put back afterwards.
  // Handled by ordering: this runs before the bare-number rule and restores itself.

  // Addresses. A precedent naming another client's premises is the clearest way
  // for one file to leak into another, and it cannot be caught by digits: it is
  // Workshop 3, Feeder Road, Bristol. Matched on the street word and what leads
  // into it. This over-reaches on occasion, and over-reaching costs a little
  // phrasing while under-reaching puts one client's property in another's letter.
  [new RegExp(
    String.raw`(?:(?:Unit|Suite|Flat|Apartment|Floor|Workshop|Bay|Room|No\.?)\s+\d+[A-Za-z]?,?\s+)?`
    + String.raw`(?:\d+[A-Za-z]?\s+)?`
    + String.raw`(?:[A-Z][\w']+\s+){0,3}`
    + String.raw`(?:Road|Street|Way|Lane|Court|Crescent|Yard|Park|Avenue|Close|Drive|Place|Row|Terrace|Hill|Grove|Gardens|Square|Walk|Rise|Mews|Parade|Wharf)`
    + String.raw`(?:,\s*[A-Z][\w']+)*`,
    'g',
  ), '[address]'],

  // Any remaining figure of two digits or more. Small integers are left alone as
  // ordinary prose: two parties, 14 days.
  [/\b\d{2,}(?:[\d,]*)(?:\.\d+)?\b/g, '[figure]'],
];

// Two things are structure rather than content, and both contain digits that must
// survive: a statute year, which is part of the name of a thing, and a numbered
// heading, which is the shape of the letter and precisely what a precedent is for.
//
// They are lifted out before the redactions run and put back afterwards. An earlier
// attempt marked them in place with a control character, which failed silently: a
// word boundary still matches beside a control character, so the digits were
// redacted anyway and headings 10 to 13 disappeared while 1 to 9 survived.
const PROTECTED = [
  /\b(?:Act|Acts|Regulations?|Rules?|Order|Directive|Convention)\s+(?:of\s+)?\d{4}\b/gi,
  /\b\d{4}\s+(?:Act|Regulations?|Rules?|Order)\b/gi,
  /(?:^|\n)\d{1,2}\.(?=\s)/g,
];

export function redactPrecedent(text) {
  let out = String(text || '');

  // The placeholder is encoded in letters, not digits. An earlier version numbered
  // them, and once a letter had ten or more protected spans the figure rule redacted
  // the digits of the index inside the placeholder itself, so restoration failed and
  // headings 10 upward vanished while 1 to 9 came back.
  const parked = [];
  const encode = (n) => String(n).split('').map((d) => 'abcdefghij'[Number(d)]).join('');
  const decode = (t) => Number(t.split('').map((c) => 'abcdefghij'.indexOf(c)).join(''));

  const park = (match) => {
    parked.push(match);
    return `\u0000${encode(parked.length - 1)}\u0000`;
  };
  for (const pattern of PROTECTED) out = out.replace(pattern, park);

  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }

  return out.replace(/\u0000([a-j]+)\u0000/g, (_m, t) => parked[decode(t)]);
}

// Names cannot be found by shape: a client is called Bramwell Foods Limited and so
// might a party in this matter. But the firm's own client list is known, so the
// names in its own letters are known too. Anything on that list is removed by name.
export function redactNames(text, names = []) {
  let out = String(text || '');
  for (const name of names) {
    const clean = String(name || '').trim();
    if (clean.length < 4) continue;
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'gi'), '[client]');

    // And the surname on its own, which is how a letter refers to someone after
    // the first mention.
    const parts = clean.split(/\s+/).filter((w) => w.length > 3);
    const surname = parts[parts.length - 1];
    if (surname && !/limited|ltd|llp|plc/i.test(surname)) {
      out = out.replace(new RegExp(`\\b${surname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), '[client]');
    }
  }
  return out;
}

export function prepareForDrafting(precedents = [], clientNames = []) {
  return precedents.map((p) => ({
    ...p,
    body: redactNames(redactPrecedent(p.body), clientNames),
  }));
}
