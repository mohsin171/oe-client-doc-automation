// Which model does which job.
//
// Everything ran on Haiku, chosen when the first thing built was corpus ingestion.
// That was never revisited, so the model writing prose a partner signs was the
// cheapest and fastest available. It is the wrong trade: the letter is the product,
// and a solicitor's time reviewing a weak paragraph costs more than every model call
// a firm will make in a month.
//
// Four jobs, and they do not want the same thing.
//
//   ingest    Splitting a corpus into fixed, merged and written-fresh. Structural
//             work, and it runs once per template rather than once per letter. Haiku.
//
//   extract   Reading a fee earner's notes into fields, with a quotation for each.
//             Structured, and the checks catch what it gets wrong. Haiku.
//
//   draft     Writing the paragraphs a client reads and a partner signs. The only
//             part where prose quality is the product. Worth the better model.
//
//   review    Reading the finished letter as a critic. Catching a subtle
//             inconsistency is exactly what a stronger model is better at, and a
//             missed one reaches the client.
//
// Each can be overridden by an environment variable, so a firm can move a job up or
// down without a deployment, and so a wrong model name can be corrected in a minute.

const DEFAULTS = {
  ingest: 'claude-haiku-4-5-20251001',
  extract: 'claude-haiku-4-5-20251001',
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
