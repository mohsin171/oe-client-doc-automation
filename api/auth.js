// Sign-in and team management.
//
// Team CRUD is folded into this function rather than given its own route, the
// same consolidation used elsewhere in the stack, so the serverless function
// count stays well inside the Hobby limit.

import { sql } from '../lib/db.js';
import {
  issueCode, redeemCode, checkRateLimit, createSession, destroySession,
  readCookie, setCookie, clearCookie, authConfigured,
} from '../lib/auth.js';
import { sendCodeEmail, sendInviteEmail, emailConfigured } from '../lib/email.js';
import {
  getContext, requireContext, canManageTeam, ROLES, ok, bad, readBody,
} from '../lib/context.js';
import { logEvent } from '../lib/store.js';

// Pre-launch convenience only. When AUTH_DEV_ECHO is exactly 'true', the code
// is returned in the response so the first owner can get in before Resend is
// wired up. Never set this once a real firm is on the system.
const DEV_ECHO = process.env.AUTH_DEV_ECHO === 'true';

export default async function handler(req, res) {
  try {
    // ---------------- Who am I ----------------
    if (req.method === 'GET') {
      const ctx = await getContext(req);
      if (!ctx) {
        return ok(res, {
          signedIn: false,
          authConfigured: authConfigured(),
          emailConfigured: emailConfigured(),
          devEcho: DEV_ECHO,
        });
      }
      return ok(res, {
        signedIn: true,
        user: {
          id: ctx.user_id, name: ctx.name, email: ctx.email, role: ctx.role,
        },
        firm: { id: ctx.firm_id, name: ctx.firm_name, branding: ctx.branding || {} },
        emailConfigured: emailConfigured(),
      });
    }

    if (req.method !== 'POST') return bad(res, 'Method not allowed', 405);

    const body = await readBody(req);
    const action = body.action;

    // ---------------- Request a code ----------------
    if (action === 'request_code') {
      if (!authConfigured()) {
        return bad(res, 'SESSION_SECRET is not set, so sign-in is unavailable.', 503);
      }

      const email = String(body.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) return bad(res, 'Enter a valid email address');

      const rows = await sql`
        SELECT u.id, u.name, u.email, f.name AS firm_name
        FROM users u JOIN firms f ON f.id = u.firm_id
        WHERE lower(u.email) = ${email} AND u.active = TRUE LIMIT 1`;
      const user = rows[0];

      // Invite only. The response is deliberately identical whether or not the
      // address is on the system, so this endpoint cannot be used to discover
      // who works at the firm.
      if (!user) {
        return ok(res, { sent: true, expiresInMinutes: 10 });
      }

      const rate = await checkRateLimit(user.id);
      if (!rate.allowed) {
        return bad(res, `Too many codes requested. Try again in ${rate.retryAfterMinutes} minutes.`, 429);
      }

      const { code, expiresInMinutes } = await issueCode(user.id);

      const mail = await sendCodeEmail({
        to: user.email,
        name: user.name,
        code,
        firmName: user.firm_name,
        minutes: expiresInMinutes,
      });

      // Always available in the function log, so sign-in is recoverable even
      // when the mail provider is down.
      if (!mail.sent) {
        console.log(`[auth] sign-in code for ${user.email}: ${code} (email not sent: ${mail.reason})`);
      }

      return ok(res, {
        sent: true,
        expiresInMinutes,
        emailDelivered: mail.sent,
        ...(DEV_ECHO ? { devCode: code } : {}),
      });
    }

    // ---------------- Verify a code ----------------
    if (action === 'verify_code') {
      const email = String(body.email || '').trim().toLowerCase();
      const code = String(body.code || '').trim();
      if (!email || !code) return bad(res, 'Enter your email address and the code');

      const rows = await sql`
        SELECT id, name FROM users WHERE lower(email) = ${email} AND active = TRUE LIMIT 1`;
      const user = rows[0];
      if (!user) return bad(res, 'That code is not valid', 401);

      const result = await redeemCode(user.id, code);
      if (!result.ok) {
        const messages = {
          no_code: 'Request a new code.',
          expired: 'That code has expired. Request a new one.',
          too_many_attempts: 'Too many incorrect attempts. Request a new code.',
          wrong_code: 'That code is not valid.',
        };
        return bad(res, messages[result.reason] || 'That code is not valid', 401);
      }

      const token = await createSession(user.id);
      setCookie(res, token);

      const full = await sql`
        SELECT u.id, u.name, u.email, u.role, u.firm_id, f.name AS firm_name, f.branding
        FROM users u JOIN firms f ON f.id = u.firm_id WHERE u.id = ${user.id}`;
      const u = full[0];

      await logEvent({
        firmId: u.firm_id, actorId: u.id, kind: 'signed_in', payload: {},
      });

      return ok(res, {
        signedIn: true,
        user: { id: u.id, name: u.name, email: u.email, role: u.role },
        firm: { id: u.firm_id, name: u.firm_name, branding: u.branding || {} },
      });
    }

    // ---------------- Sign out ----------------
    if (action === 'logout') {
      await destroySession(readCookie(req));
      clearCookie(res);
      return ok(res, { signedIn: false });
    }

    // ---------------- Team management, owner only ----------------
    const ctx = await requireContext(req, res);
    if (!ctx) return;

    if (action === 'team_list') {
      const team = await sql`
        SELECT id, name, email, role, active, last_login_at, created_at
        FROM users WHERE firm_id = ${ctx.firm_id}
        ORDER BY active DESC, CASE role WHEN 'owner' THEN 0 ELSE 1 END, name`;
      return ok(res, { team, canManage: canManageTeam(ctx.role), me: ctx.user_id });
    }

    if (!canManageTeam(ctx.role)) {
      return bad(res, 'Only the firm owner can manage the team', 403);
    }

    if (action === 'team_invite') {
      const email = String(body.email || '').trim().toLowerCase();
      const name = String(body.name || '').trim();
      const role = ROLES.includes(body.role) ? body.role : 'admin';

      if (!email.includes('@') || !name) return bad(res, 'Name and email are both required');
      if (role === 'owner') return bad(res, 'There can only be one owner');

      const existing = await sql`
        SELECT id, active FROM users
        WHERE firm_id = ${ctx.firm_id} AND lower(email) = ${email} LIMIT 1`;

      if (existing[0]) {
        // Re-inviting a revoked person restores them rather than duplicating.
        await sql`
          UPDATE users SET active = TRUE, role = ${role}, name = ${name}
          WHERE id = ${existing[0].id}`;
      } else {
        await sql`
          INSERT INTO users (firm_id, email, name, role, invited_by)
          VALUES (${ctx.firm_id}, ${email}, ${name}, ${role}, ${ctx.user_id})`;
      }

      await sendInviteEmail({
        to: email, name, invitedBy: ctx.name, firmName: ctx.firm_name,
      });

      await logEvent({
        firmId: ctx.firm_id, actorId: ctx.user_id,
        kind: 'team_invited', payload: { email, role },
      });

      const team = await sql`
        SELECT id, name, email, role, active, last_login_at FROM users
        WHERE firm_id = ${ctx.firm_id} ORDER BY active DESC, name`;

      return ok(res, { team });
    }

    if (action === 'team_role') {
      const userId = Number(body.userId);
      const role = ROLES.includes(body.role) ? body.role : null;
      if (!role) return bad(res, 'Unknown role');
      if (role === 'owner') return bad(res, 'Ownership cannot be granted from here');
      if (userId === ctx.user_id) return bad(res, 'You cannot change your own role');

      await sql`
        UPDATE users SET role = ${role}
        WHERE id = ${userId} AND firm_id = ${ctx.firm_id} AND role <> 'owner'`;

      await logEvent({
        firmId: ctx.firm_id, actorId: ctx.user_id,
        kind: 'team_role_changed', payload: { userId, role },
      });

      const team = await sql`
        SELECT id, name, email, role, active, last_login_at FROM users
        WHERE firm_id = ${ctx.firm_id} ORDER BY active DESC, name`;
      return ok(res, { team });
    }

    if (action === 'team_revoke') {
      const userId = Number(body.userId);
      if (userId === ctx.user_id) return bad(res, 'You cannot revoke your own access');

      const target = await sql`
        SELECT name FROM users
        WHERE id = ${userId} AND firm_id = ${ctx.firm_id} AND role <> 'owner' LIMIT 1`;
      if (!target[0]) return bad(res, 'Not found', 404);

      // Existing sessions die immediately. Revoking access has to mean now, not
      // whenever their cookie happens to expire.
      await sql`DELETE FROM sessions WHERE user_id = ${userId}`;

      // Has this person left a mark on the record? approvals.user_id and
      // sends.sent_by are both NOT NULL with no cascade, so the database would
      // refuse the delete anyway, and it should: their name is the answer to who
      // signed this letter off and who sent it. Somebody who never did either can
      // be removed outright.
      const history = await sql`
        SELECT
          (SELECT count(*) FROM approvals WHERE user_id = ${userId})::int AS approvals,
          (SELECT count(*) FROM sends WHERE sent_by = ${userId})::int AS sends,
          (SELECT count(*) FROM documents WHERE created_by = ${userId})::int AS documents,
          (SELECT count(*) FROM matters WHERE assigned_user_id = ${userId})::int AS matters`;
      const h = history[0];
      const leftAMark = h.approvals + h.sends + h.documents + h.matters > 0;

      if (leftAMark) {
        await sql`UPDATE users SET active = FALSE WHERE id = ${userId} AND firm_id = ${ctx.firm_id}`;
      } else {
        await sql`DELETE FROM users WHERE id = ${userId} AND firm_id = ${ctx.firm_id} AND role <> 'owner'`;
      }

      await logEvent({
        firmId: ctx.firm_id, actorId: ctx.user_id,
        kind: leftAMark ? 'team_revoked' : 'team_deleted',
        payload: { userId, name: target[0].name, ...(leftAMark ? h : {}) },
      });

      const team = await sql`
        SELECT id, name, email, role, active, last_login_at FROM users
        WHERE firm_id = ${ctx.firm_id} ORDER BY active DESC, name`;

      return ok(res, {
        team,
        removed: !leftAMark,
        note: leftAMark
          ? `${target[0].name} can no longer sign in. Their name stays on the letters `
            + 'they signed off and sent, which is the point of keeping a record.'
          : `${target[0].name} has been removed.`,
      });
    }

    return bad(res, 'Unknown action');
  } catch (err) {
    return bad(res, err.message, 500);
  }
}
