-- Orca Edge Tool 2: Document Generation & Review Automation
-- Schema v1. Safe to run more than once.
-- Run this in the Neon SQL editor before anything else.

-- ---------------------------------------------------------------
-- Firms and people
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS firms (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  vertical      TEXT NOT NULL DEFAULT 'law',        -- law | financial | tax | mortgage
  branding      JSONB NOT NULL DEFAULT '{}',        -- letterhead, fonts, signature blocks, ref format
  settings      JSONB NOT NULL DEFAULT '{}',        -- sender policy, baseline minutes, charge-out rates
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  firm_id       INTEGER NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'drafter',    -- owner | approver | drafter
  charge_rate   NUMERIC(10,2),                      -- for the value report
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by    INTEGER REFERENCES users(id),
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (firm_id, email)
);

-- Single-use hashed one time codes. Never store the code itself.
CREATE TABLE IF NOT EXISTS auth_codes (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash     TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  attempts      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_user ON auth_codes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,                   -- random opaque token id
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ---------------------------------------------------------------
-- Clients and matters
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clients (
  id            SERIAL PRIMARY KEY,
  firm_id       INTEGER NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  legal_name    TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  company_no    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_firm ON clients(firm_id);

-- A matter is the durable spine. Documents hang off it.
-- status: incomplete -> open -> active -> closed
CREATE TABLE IF NOT EXISTS matters (
  id              SERIAL PRIMARY KEY,
  firm_id         INTEGER NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  reference       TEXT NOT NULL,
  matter_type     TEXT NOT NULL,
  assigned_user_id INTEGER REFERENCES users(id),     -- the person who spoke to the client
  status          TEXT NOT NULL DEFAULT 'incomplete',
  opened_at       TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (firm_id, reference)
);
CREATE INDEX IF NOT EXISTS idx_matters_firm_status ON matters(firm_id, status);

-- One row per captured field, so provenance and confidence are first class.
-- Rule one: a field that was never stated does not get a row. It stays missing.
CREATE TABLE IF NOT EXISTS matter_fields (
  id              SERIAL PRIMARY KEY,
  matter_id       INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  value           TEXT,
  source          TEXT NOT NULL,                    -- form | dictation | import | manual_fix
  provenance      TEXT,                             -- the phrase it came from
  confidence      NUMERIC(3,2),
  is_numeric      BOOLEAN NOT NULL DEFAULT FALSE,   -- numbers always require confirmation
  confirmed_at    TIMESTAMPTZ,
  confirmed_by    INTEGER REFERENCES users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (matter_id, key)
);

-- Raw dictation kept for audit, separate from the structured result.
CREATE TABLE IF NOT EXISTS captures (
  id            SERIAL PRIMARY KEY,
  matter_id     INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES users(id),
  kind          TEXT NOT NULL,                      -- dictation | form | import
  transcript    TEXT,
  extracted     JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- Templates: configuration the engine reads, never code
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS templates (
  id            SERIAL PRIMARY KEY,
  firm_id       INTEGER NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  doc_type      TEXT NOT NULL,                      -- engagement_letter | client_care | status_letter ...
  version       INTEGER NOT NULL DEFAULT 1,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  -- definition holds: blocks[] (fixed | field | bespoke), required_fields[], review_rules[]
  definition    JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_templates_firm ON templates(firm_id, active);

-- The firm's own past wording, used to ground bespoke drafting.
CREATE TABLE IF NOT EXISTS precedents (
  id            SERIAL PRIMARY KEY,
  firm_id       INTEGER NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  doc_type      TEXT NOT NULL,
  section_key   TEXT,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- Documents, versions, flags, approvals
-- ---------------------------------------------------------------

-- status: draft -> in_review -> changes_requested -> approved -> issued
CREATE TABLE IF NOT EXISTS documents (
  id              SERIAL PRIMARY KEY,
  firm_id         INTEGER NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  matter_id       INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  template_id     INTEGER REFERENCES templates(id),
  doc_type        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',
  current_version INTEGER NOT NULL DEFAULT 1,
  created_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_matter ON documents(matter_id);
CREATE INDEX IF NOT EXISTS idx_documents_firm_status ON documents(firm_id, status);

-- Issued versions are immutable. Any change creates a new row.
CREATE TABLE IF NOT EXISTS document_versions (
  id              SERIAL PRIMARY KEY,
  document_id     INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  blocks          JSONB NOT NULL DEFAULT '[]',      -- assembled blocks, each tagged fixed | field | bespoke
  merged_values   JSONB NOT NULL DEFAULT '{}',      -- exactly what was merged, for the audit trail
  generated_by    INTEGER REFERENCES users(id),
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_at       TIMESTAMPTZ,
  UNIQUE (document_id, version)
);

CREATE TABLE IF NOT EXISTS flags (
  id                  SERIAL PRIMARY KEY,
  document_version_id INTEGER NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  severity            TEXT NOT NULL,                -- blocking | advisory
  code                TEXT NOT NULL,
  message             TEXT NOT NULL,
  anchor              TEXT,                         -- the passage it refers to
  status              TEXT NOT NULL DEFAULT 'open', -- open | resolved | dismissed
  dismissed_reason    TEXT,
  dismissed_by        INTEGER REFERENCES users(id),
  dismissed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flags_version ON flags(document_version_id, status);

-- Sign-off is a deliberate, recorded act. There is no auto-approve path.
CREATE TABLE IF NOT EXISTS approvals (
  id                  SERIAL PRIMARY KEY,
  document_version_id INTEGER NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  dismissed_flags     JSONB NOT NULL DEFAULT '[]',
  approved_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sends (
  id                  SERIAL PRIMARY KEY,
  document_version_id INTEGER NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  matter_id           INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  sent_by             INTEGER NOT NULL REFERENCES users(id),
  to_email            TEXT NOT NULL,
  subject             TEXT,
  cover_note          TEXT,
  method              TEXT NOT NULL DEFAULT 'compose', -- compose | in_app | mailbox
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- Audit and value reporting
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS events (
  id            SERIAL PRIMARY KEY,
  firm_id       INTEGER NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  matter_id     INTEGER REFERENCES matters(id) ON DELETE CASCADE,
  document_id   INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  actor_id      INTEGER REFERENCES users(id),
  kind          TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_firm ON events(firm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_matter ON events(matter_id, created_at DESC);

-- Time per document, measured against the baseline captured at onboarding.
CREATE TABLE IF NOT EXISTS time_logs (
  id                SERIAL PRIMARY KEY,
  firm_id           INTEGER NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  document_id       INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  user_id           INTEGER REFERENCES users(id),
  seconds_spent     INTEGER NOT NULL,
  baseline_minutes  INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_time_logs_firm ON time_logs(firm_id, created_at DESC);
