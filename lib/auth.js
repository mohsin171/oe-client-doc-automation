// Authentication primitives.
//
// Invite only. There is no self-registration: a person can only receive a code
// if the firm owner has already invited their address. That matches how a law
// firm actually works, and it removes a whole class of abuse.
//
// Codes are six digits, hashed before storage, single use, expire in ten
// minutes, and are rate limited per address. Sessions are opaque random ids
// stored server side, carried in a signed HttpOnly cookie.

import crypto from 'node:crypto';
import { sql } from './db.js';

const CODE_TTL_MINUTES = 10;
const SESSION_TTL_DAYS = 7;
const MAX_CODE_ATTEMPTS = 5;
const MAX_CODES_PER_WINDOW = 3;
const RATE_WINDOW_MINUTES = 15;
const COOKIE_NAME = 'oe_session';

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET is not set. Add it in the Vercel project environment variables.');
  }
  return s;
}

export function authConfigured() {
  const s = process.env.SESSION_SECRET;
  return Boolean(s && s.length >= 16);
}

// ---------------------------------------------------------------
// Codes
// ---------------------------------------------------------------

export function generateCode() {
  // crypto.randomInt avoids the modulo bias of Math.random based schemes.
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(code, userId) {
  // Peppered with the session secret and bound to the user, so a hash lifted
  // from the database is useless against a different account.
  return crypto.createHmac('sha256', secret()).update(`${userId}:${code}`).digest('hex');
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Returns { allowed, retryAfterMinutes }
export async function checkRateLimit(userId) {
  const rows = await sql`
    SELECT count(*)::int AS n FROM auth_codes
    WHERE user_id = ${userId}
      AND created_at > now() - (${RATE_WINDOW_MINUTES} || ' minutes')::interval`;
  const n = rows[0]?.n || 0;
  return { allowed: n < MAX_CODES_PER_WINDOW, retryAfterMinutes: RATE_WINDOW_MINUTES };
}

export async function issueCode(userId) {
  const code = generateCode();

  // Any earlier unused code for this person stops working the moment a new one
  // is issued, so two codes are never live at once.
  await sql`
    UPDATE auth_codes SET used_at = now()
    WHERE user_id = ${userId} AND used_at IS NULL`;

  await sql`
    INSERT INTO auth_codes (user_id, code_hash, expires_at)
    VALUES (${userId}, ${hashCode(code, userId)},
            now() + (${CODE_TTL_MINUTES} || ' minutes')::interval)`;

  return { code, expiresInMinutes: CODE_TTL_MINUTES };
}

// Returns { ok } or { ok: false, reason }
export async function redeemCode(userId, submitted) {
  const rows = await sql`
    SELECT * FROM auth_codes
    WHERE user_id = ${userId} AND used_at IS NULL
    ORDER BY created_at DESC LIMIT 1`;

  const record = rows[0];
  if (!record) return { ok: false, reason: 'no_code' };

  if (new Date(record.expires_at) < new Date()) {
    return { ok: false, reason: 'expired' };
  }

  if (record.attempts >= MAX_CODE_ATTEMPTS) {
    await sql`UPDATE auth_codes SET used_at = now() WHERE id = ${record.id}`;
    return { ok: false, reason: 'too_many_attempts' };
  }

  const expected = hashCode(String(submitted).trim(), userId);
  if (!timingSafeEqual(expected, record.code_hash)) {
    await sql`UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ${record.id}`;
    return { ok: false, reason: 'wrong_code', remaining: MAX_CODE_ATTEMPTS - record.attempts - 1 };
  }

  // Single use. Burned on success.
  await sql`UPDATE auth_codes SET used_at = now() WHERE id = ${record.id}`;
  return { ok: true };
}

// ---------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export async function createSession(userId) {
  const id = crypto.randomBytes(32).toString('base64url');
  await sql`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (${id}, ${userId}, now() + (${SESSION_TTL_DAYS} || ' days')::interval)`;
  await sql`UPDATE users SET last_login_at = now() WHERE id = ${userId}`;

  // Opportunistic cleanup, cheap enough to do on login.
  await sql`DELETE FROM sessions WHERE expires_at < now()`;

  return `${id}.${sign(id)}`;
}

export async function destroySession(token) {
  const id = (token || '').split('.')[0];
  if (!id) return;
  await sql`DELETE FROM sessions WHERE id = ${id}`;
}

export async function sessionUser(token) {
  if (!token) return null;
  const [id, signature] = token.split('.');
  if (!id || !signature) return null;
  if (!timingSafeEqual(sign(id), signature)) return null;

  const rows = await sql`
    SELECT s.id AS session_id, u.id AS user_id, u.name, u.email, u.role, u.firm_id,
           f.name AS firm_name, f.branding, f.settings
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN firms f ON f.id = u.firm_id
    WHERE s.id = ${id} AND s.expires_at > now() AND u.active = TRUE
    LIMIT 1`;

  return rows[0] || null;
}

// ---------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------

export function readCookie(req) {
  const raw = req.headers?.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function setCookie(res, token) {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
}

export function clearCookie(res) {
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}
