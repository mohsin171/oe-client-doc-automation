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

// Where a problem shows and where its correction belongs are not always the
// same passage. A standard clause promising not to exceed an estimate is the
// clause that raises the alarm, and it is exactly the passage nobody may
// rewrite: the estimate goes in the charges paragraph.
//
// Keyword matching alone fails on precisely the case that matters most. The
// word "estimate" does not appear in the charges paragraph, because the missing
// estimate is the problem. So each known check names the kind of passage its fix
// belongs in, and keyword scoring is only the fallback.
const FIX_TARGETS = {
  dangling_estimate: /charge|fee|cost|rate|hour|estimate|disburse/i,
  numeric_consistency: /charge|fee|cost|rate|hour|estimate/i,
  unstated_timescale: /time|scale|duration|complete|progress|when/i,
  fixed_block_present: null,
};

export function fixTargetFor(flag, blocks = []) {
  const editable = blocks.filter((b) => b.kind !== 'fixed' && String(b.body || '').trim());
  if (editable.length === 0) return null;

  const anchored = blocks.find((b) => b.key === flag?.anchor);

  // If the flag already points at something editable, that is the target.
  if (anchored && anchored.kind !== 'fixed') return anchored.key;

  const code = String(flag?.code || '');

  // A check that knows what kind of passage it is about.
  if (Object.prototype.hasOwnProperty.call(FIX_TARGETS, code)) {
    const pattern = FIX_TARGETS[code];
    if (!pattern) return null;
    const match = editable.find((b) => pattern.test(b.key)) || editable.find((b) => pattern.test(b.body));
    if (match) return match.key;
    return null;
  }

  // Fallback: score each editable passage on the words the flag itself used.
  const stop = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'this', 'that', 'these', 'those', 'it',
    'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of', 'in', 'on', 'for',
    'with', 'not', 'no', 'does', 'do', 'above', 'below', 'letter', 'clause',
    'standard', 'client', 'cannot', 'see', 'add', 'check', 'against', 'appears',
    'text', 'record', 'matter', 'firm', 'section', 'confirm', 'intended',
  ]);
  const terms = String(flag?.message || '')
    .toLowerCase().split(/[^a-z]+/)
    .filter((w) => w.length > 3 && !stop.has(w));

  let best = null;
  let bestScore = 0;
  for (const b of editable) {
    const body = String(b.body).toLowerCase();
    const key = String(b.key).toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (body.includes(t)) score += 2;
      if (key.includes(t)) score += 3;
    }
    if (score > bestScore) { bestScore = score; best = b.key; }
  }

  // Nothing in common with any passage. Sending someone to the wrong paragraph
  // is worse than sending them nowhere.
  return bestScore > 0 ? best : null;
}
