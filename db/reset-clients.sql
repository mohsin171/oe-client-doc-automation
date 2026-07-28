-- Clear the clients and everything produced for them, and keep the letters.
--
-- The other reset, db/reset-data.sql, clears the firm's letters and the structure
-- derived from them as well, which means uploading twenty files and analysing them
-- again before anything can be tested. Most of the time that is not what is wanted:
-- the letters are fine and it is the test clients that need clearing.
--
-- Kept:
--   firms, users, sessions, auth_codes    the firm and its logins
--   precedents                            the letters on file
--   templates                             the structure derived from them
--
-- Cleared: every client, matter, document, version, flag, approval and send.
--
-- Children are deleted before anything they reference rather than relying on a
-- cascade, which is how this project once lost its admin accounts.
--
-- Safe to re-run.

BEGIN;

-- The audit trail first. Its rows point at documents and matters, and although those
-- keys cascade, the order should not depend on that.
DELETE FROM events WHERE matter_id IS NOT NULL OR document_id IS NOT NULL;
DELETE FROM time_logs;

-- What was produced.
DELETE FROM approvals;
DELETE FROM flags;
DELETE FROM sends;
DELETE FROM document_versions;
DELETE FROM documents;

-- The files those documents belonged to.
DELETE FROM matter_fields;
DELETE FROM matter_access;
DELETE FROM captures;
DELETE FROM matters;
DELETE FROM clients;

COMMIT;

-- What survived. precedents and templates should still hold what was uploaded, and
-- users should still list you, or you cannot sign back in.
SELECT 'clients'    AS table_name, count(*) FROM clients
UNION ALL SELECT 'matters',    count(*) FROM matters
UNION ALL SELECT 'documents',  count(*) FROM documents
UNION ALL SELECT 'sends',      count(*) FROM sends
UNION ALL SELECT 'precedents', count(*) FROM precedents
UNION ALL SELECT 'templates',  count(*) FROM templates
UNION ALL SELECT 'users',      count(*) FROM users
UNION ALL SELECT 'firms',      count(*) FROM firms
ORDER BY table_name;
