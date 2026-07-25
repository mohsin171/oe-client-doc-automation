// Request context: who is acting, and for which firm.
//
// PLACEHOLDER. Real login is invite based email one time codes, matching the
// pattern used elsewhere in the Orca Edge stack, and it needs SESSION_SECRET.
// Until that exists, every request resolves to the first firm and its owner.
//
// This is safe only because the deployment is not yet public and holds no real
// client data. Before a single real firm is onboarded, replace resolveContext()
// with a real session lookup. The rest of the codebase does not need to change,
// because everything already takes firmId and actorId as arguments.

import { sql } from './db.js';

export const AUTH_IS_PLACEHOLDER = !process.env.SESSION_SECRET;

export async function resolveContext() {
  const rows = await sql`
    SELECT u.id AS user_id, u.name, u.email, u.role, u.firm_id, f.name AS firm_name,
           f.branding, f.settings
    FROM users u JOIN firms f ON f.id = u.firm_id
    WHERE u.active = TRUE
    ORDER BY CASE u.role WHEN 'owner' THEN 0 WHEN 'approver' THEN 1 ELSE 2 END, u.id
    LIMIT 1`;

  if (!rows[0]) {
    throw new Error('No users found. Run db/seed.sql in the Neon SQL editor.');
  }
  return rows[0];
}

// Sign-off authority. A drafter may prepare but may not approve.
// Enforced here and checked again in the route, never only in the interface.
export function canApprove(role) {
  return role === 'owner' || role === 'approver';
}

export function canManageTemplates(role) {
  return role === 'owner';
}

// Small helpers so every route behaves the same way.
export function ok(res, body) {
  res.status(200).json(body);
}

export function bad(res, message, code = 400) {
  res.status(code).json({ error: message });
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch (_) { resolve({}); }
    });
  });
}
