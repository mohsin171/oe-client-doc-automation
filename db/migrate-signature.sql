-- Record the client's signature against a document.
--
-- Two ways a letter gets signed in a small firm: the client types their name
-- into the form, or they sign a printed copy in the office and someone records
-- that they did. Both end up here, with the date, and both are worth keeping on
-- the document rather than only in someone's memory.
--
-- Left empty, the letter prints with blank lines to be signed by hand.
--
-- Safe to re-run.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_signature TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_signed_on DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signature_recorded_by INTEGER REFERENCES users(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signature_recorded_at TIMESTAMPTZ;

SELECT 'signature columns ready' AS status;
