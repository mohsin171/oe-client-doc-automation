-- Run this once in the Neon SQL editor.
-- Removes the two colleagues the original seed invented, and migrates the old
-- three role model (owner / approver / drafter) to the current two (owner / admin).
-- Safe to re-run.

-- 1. Remove the seeded demo people. The owner account is untouched.
DELETE FROM users
WHERE email IN ('sarah.fenn@harrowfenn.example', 'dan.okoye@harrowfenn.example');

-- 2. Migrate any remaining old roles.
UPDATE users SET role = 'admin' WHERE role IN ('approver', 'drafter');

-- 3. Check what is left. Expect one row: the owner.
SELECT id, name, email, role, active FROM users ORDER BY id;
