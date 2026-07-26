// Request context: who is acting, and for which firm.
//
// Every protected route calls requireContext(req, res). It returns null and has
// already sent a 401 when there is no valid session, so a route can simply
// return at that point.
//
// Firm scoping is applied here and again in every store query. Role checks are
// enforced on the server, never only in the interface, because in a regulated
// firm the difference between drafting and approving is a real one.

import { readCookie, sessionUser, authConfigured } from './auth.js';

export { authConfigured };

export async function getContext(req) {
  if (!authConfigured()) return null;
  const token = readCookie(req);
  if (!token) return null;
  return await sessionUser(token);
}

export async function requireContext(req, res) {
  if (!authConfigured()) {
    res.status(503).json({
      error: 'SESSION_SECRET is not set, so sign-in is unavailable. Add it in the Vercel project environment variables and redeploy.',
      code: 'auth_unconfigured',
    });
    return null;
  }

  const ctx = await getContext(req);
  if (!ctx) {
    res.status(401).json({ error: 'Not signed in', code: 'unauthenticated' });
    return null;
  }
  return ctx;
}

// Who this person can see. An owner sees the whole firm; anyone else sees the
// files assigned to them and any they hold for cover. Derived in one place so
// that no individual route has to remember to do it.
export function actorFor(ctx) {
  return { userId: ctx.user_id, seesAll: ctx.role === 'owner' };
}

// Two roles. The AI prepares the document, so there is no separate preparer
// role: anyone with access is a fee earner who can sign off. Only the owner
// manages who has access at all.
export function canApprove(role) {
  return role === 'owner' || role === 'admin';
}

export function canManageTemplates(role) {
  return role === 'owner' || role === 'admin';
}

export function canManageTeam(role) {
  return role === 'owner';
}

export const ROLES = ['owner', 'admin'];

// Shared response helpers so every route behaves the same way.
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
