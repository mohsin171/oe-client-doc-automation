-- Clear the working data so a fresh set of letters can be tested.
--
-- What this keeps, deliberately:
--   firms       the firm record and its branding
--   users       everyone who can sign in
--   sessions    your current login, so you are not thrown out mid-test
--   auth_codes  any code already in flight
--
-- What it clears: the letters on file, the structure derived from them, and every
-- client, matter and document built on top.
--
-- The order matters. Children first, parents last, so nothing relies on a cascade
-- to do the right thing. A seed file in this project once wiped the admin accounts
-- through a cascade nobody had read, which is why this deletes explicitly and
-- names every table.
--
-- Safe to re-run.

BEGIN;

-- The audit trail first. Its rows point at documents and matters, and although
-- those foreign keys cascade, relying on a cascade is how this project once lost
-- its admin accounts. Deleted explicitly, and before the rows it refers to.
DELETE FROM events;
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

-- What the firm handed over, and what was learned from it.
DELETE FROM templates;
DELETE FROM precedents;

-- Anyone revoked. Their name was kept because it sat on approvals and sends, and
-- those have just gone, so there is nothing left to preserve. Owners are never
-- touched, and neither is anyone still active.
DELETE FROM users WHERE active = FALSE AND role <> 'owner';

COMMIT;

-- What survived. users should still list you, or you cannot sign back in.
SELECT 'firms'     AS table_name, count(*) FROM firms
UNION ALL SELECT 'users',     count(*) FROM users
UNION ALL SELECT 'sessions',  count(*) FROM sessions
UNION ALL SELECT 'clients',   count(*) FROM clients
UNION ALL SELECT 'matters',   count(*) FROM matters
UNION ALL SELECT 'documents', count(*) FROM documents
UNION ALL SELECT 'templates', count(*) FROM templates
UNION ALL SELECT 'precedents', count(*) FROM precedents
UNION ALL SELECT 'events',    count(*) FROM events
ORDER BY table_name;
