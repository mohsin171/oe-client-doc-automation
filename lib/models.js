// Which model does which job.
//
// Everything ran on Haiku, chosen when the first thing built was corpus ingestion.
// That was never revisited, so the model writing prose a partner signs was the
// cheapest and fastest available. It is the wrong trade: the letter is the product,
// and a solicitor's time reviewing a weak paragraph costs more than every model call
// a firm will make in a month.
//
// Four jobs, and at these volumes there is no case for economising on any of them.
// Forty letters a month costs about a pound and seventy on the better model, against
// about sixty pence on the cheapest. That difference is not worth one paragraph a
// solicitor has to rewrite, so all four jobs get the better model. The earlier split
// was cost-conscious reasoning applied to an amount that does not matter.
//
//   ingest    Splits a corpus into fixed, merged and written-fresh. Runs once per
//             template, so the cost is negligible, and it decides the structure every
//             later letter is built from. Getting it wrong once affects all of them.
//             The highest leverage of any single call in the product.
//
//   extract   Reads a fee earner's notes into fields. The failure mode is omission,
//             not invention: a quotation is checked against the notes so it cannot
//             fabricate, but nothing catches a fact it simply did not notice. Miss
//             "265 plus VAT" and the letter has no rate.
//
//   draft     Writes the paragraphs a client reads and a partner signs. The only part
//             where prose quality is the product.
//
//   review    Reads the finished letter as a critic. Catching a subtle inconsistency
//             is what a stronger model is better at, and a missed one reaches a client.
//
// Each can be overridden by an environment variable, so a job can be moved without a
// deployment and a wrong model name corrected in a minute.

const DEFAULTS = {
  ingest: 'claude-sonnet-4-5',
  extract: 'claude-sonnet-4-5',
  draft: 'claude-sonnet-4-5',
  review: 'claude-sonnet-4-5',
};

// If a better model is unavailable the letter still gets written. A wrong model name
// or a withdrawn version should not stop a firm working, and it should be visible in
// the logs rather than silent.
export const FALLBACK = 'claude-haiku-4-5-20251001';

export function modelFor(job) {
  const key = `MODEL_${String(job).toUpperCase()}`;
  return process.env[key] || DEFAULTS[job] || FALLBACK;
}

export function isModelMissing(err) {
  const status = err?.status;
  const message = String(err?.message || '').toLowerCase();
  return status === 404
    || message.includes('not_found')
    || message.includes('model')
    && (message.includes('does not exist') || message.includes('not found'));
}
