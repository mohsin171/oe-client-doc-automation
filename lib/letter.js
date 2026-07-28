// How a letter is laid out, decided once.
//
// The blocks come back in template order, which is not the same as the order a
// letter reads in. A salutation ends up above the confidentiality marking and
// the subject line, which no firm would send. Worse, the screen and the PDF
// were each deciding this separately, so they could drift apart, and an
// approval means less if the thing approved is laid out differently from the
// thing that arrives.

const IS_CONFIDENTIAL = /^(private and confidential|confidential|strictly private)/i;
const IS_SUBJECT = /^(re|subject)\s*:/i;
const IS_SALUTATION = /^dear\b/i;
const IS_SIGNOFF = /^(yours (sincerely|faithfully)|kind regards)/i;

export function layoutLetter(rawBlocks = []) {
  const blocks = rawBlocks.filter((b) => String(b.body || '').trim());

  const first = (test) => blocks.find((b) => test.test(String(b.body).trim()));

  const confidential = first(IS_CONFIDENTIAL);
  const subject = first(IS_SUBJECT);
  const salutation = first(IS_SALUTATION);
  const signoff = first(IS_SIGNOFF);

  const consumed = new Set([confidential, subject, salutation, signoff].filter(Boolean).map((b) => b.key));
  const body = blocks.filter((b) => !consumed.has(b.key));

  return { confidential, subject, salutation, signoff, body };
}

// Furniture is anything that is not a substantive term: a marking, a subject
// line, a greeting. It gets no heading and nothing to acknowledge.
export function isFurniture(block) {
  const text = String(block?.body || '').trim();
  if (!text) return true;
  if (text.length < 120) return true;
  return IS_CONFIDENTIAL.test(text) || IS_SUBJECT.test(text)
    || IS_SALUTATION.test(text) || IS_SIGNOFF.test(text);
}

export function headingFor(block) {
  return String(block?.key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
