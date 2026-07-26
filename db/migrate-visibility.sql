-- Cover access: a second person given sight of a file they were not assigned.
--
-- Without this, restricted visibility means one person off sick freezes their
-- files until the owner picks them up, which in a three person firm is a real
-- problem rather than a theoretical one.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS matter_access (
  id          SERIAL PRIMARY KEY,
  matter_id   INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (matter_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_matter_access_user ON matter_access(user_id);
CREATE INDEX IF NOT EXISTS idx_matters_assigned ON matters(firm_id, assigned_user_id);

SELECT 'matter_access ready' AS status;
