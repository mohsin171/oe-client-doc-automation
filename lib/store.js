// The seam.
//
// Nothing above this file talks to Postgres directly. Callers ask for a matter
// and do not care where the answer comes from. That is deliberate: if Tool 2 is
// later folded into the unified operations shell, only this file changes.
// If this seam is not kept clean, that migration becomes a rewrite.
//
// Every function takes firmId first and filters on it. Firm scoping is enforced
// here and again in each API route. Never only in the interface.

import { sql } from './db.js';
import { canonicalKey } from './fields.js';

// ---------------------------------------------------------------
// Firms and users
// ---------------------------------------------------------------

export async function getFirmBySlug(slug) {
  const rows = await sql`SELECT * FROM firms WHERE slug = ${slug} LIMIT 1`;
  return rows[0] || null;
}

export async function getFirm(firmId) {
  const rows = await sql`SELECT * FROM firms WHERE id = ${firmId} LIMIT 1`;
  return rows[0] || null;
}

export async function getUserByEmail(email) {
  const rows = await sql`
    SELECT * FROM users WHERE lower(email) = lower(${email}) AND active = TRUE LIMIT 1`;
  return rows[0] || null;
}

export async function getUser(userId) {
  const rows = await sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
  return rows[0] || null;
}

export async function listUsers(firmId) {
  return sql`
    SELECT id, email, name, role, charge_rate, active, last_login_at
    FROM users WHERE firm_id = ${firmId} ORDER BY role, name`;
}

// ---------------------------------------------------------------
// Clients
// ---------------------------------------------------------------

export async function findOrCreateClient(firmId, { legalName, email, phone, address, companyNo }) {
  const existing = await sql`
    SELECT * FROM clients
    WHERE firm_id = ${firmId} AND lower(legal_name) = lower(${legalName})
    LIMIT 1`;
  if (existing[0]) return existing[0];

  const rows = await sql`
    INSERT INTO clients (firm_id, legal_name, email, phone, address, company_no)
    VALUES (${firmId}, ${legalName}, ${email || null}, ${phone || null},
            ${address || null}, ${companyNo || null})
    RETURNING *`;
  return rows[0];
}

// ---------------------------------------------------------------
// Matters
// ---------------------------------------------------------------

// An owner sees the whole firm. Anyone else sees files assigned to them, plus
// any they have been given for cover.
export async function listMatters(firmId, actor = null) {
  if (actor && !actor.seesAll) {
    return sql`
      SELECT m.*, c.legal_name AS client_name, c.email AS client_email,
             u.name AS assigned_name,
             (SELECT count(*) FROM documents d
                WHERE d.matter_id = m.id AND d.status IN ('draft','in_review','changes_requested')
             )::int AS pending_documents
      FROM matters m
      JOIN clients c ON c.id = m.client_id
      LEFT JOIN users u ON u.id = m.assigned_user_id
      WHERE m.firm_id = ${firmId}
        AND (m.assigned_user_id = ${actor.userId}
             OR EXISTS (SELECT 1 FROM matter_access ma
                         WHERE ma.matter_id = m.id AND ma.user_id = ${actor.userId}))
      ORDER BY
        CASE m.status WHEN 'incomplete' THEN 0 WHEN 'active' THEN 1
                      WHEN 'open' THEN 2 ELSE 3 END,
        m.created_at DESC`;
  }
  return sql`
    SELECT m.*, c.legal_name AS client_name, c.email AS client_email,
           u.name AS assigned_name,
           (SELECT count(*) FROM documents d
              WHERE d.matter_id = m.id AND d.status IN ('draft','in_review','changes_requested')
           )::int AS pending_documents
    FROM matters m
    JOIN clients c ON c.id = m.client_id
    LEFT JOIN users u ON u.id = m.assigned_user_id
    WHERE m.firm_id = ${firmId}
    ORDER BY
      CASE m.status WHEN 'incomplete' THEN 0 WHEN 'active' THEN 1
                    WHEN 'open' THEN 2 ELSE 3 END,
      m.created_at DESC`;
}

export async function canSeeMatter(firmId, matterId, actor) {
  if (!actor || actor.seesAll) return true;
  const rows = await sql`
    SELECT 1 FROM matters m
    WHERE m.firm_id = ${firmId} AND m.id = ${matterId}
      AND (m.assigned_user_id = ${actor.userId}
           OR EXISTS (SELECT 1 FROM matter_access ma
                       WHERE ma.matter_id = m.id AND ma.user_id = ${actor.userId}))
    LIMIT 1`;
  return Boolean(rows[0]);
}

// A name only conflict check. A firm has to know whether it already acts for
// the other side before taking a matter on, and an employee who can only see
// their own clients cannot discharge that duty. This answers the question
// without revealing the file, the fee earner, or anything else.
export async function conflictCheck(firmId, name) {
  const term = `%${String(name || '').trim().toLowerCase()}%`;
  const rows = await sql`
    SELECT count(*)::int AS n FROM clients
    WHERE firm_id = ${firmId} AND lower(legal_name) LIKE ${term}`;
  return { matches: rows[0]?.n || 0 };
}

export async function grantMatterAccess(matterId, userId, grantedBy) {
  await sql`
    INSERT INTO matter_access (matter_id, user_id, granted_by)
    VALUES (${matterId}, ${userId}, ${grantedBy})
    ON CONFLICT (matter_id, user_id) DO NOTHING`;
}

export async function revokeMatterAccess(matterId, userId) {
  await sql`DELETE FROM matter_access WHERE matter_id = ${matterId} AND user_id = ${userId}`;
}

export async function listMatterAccess(matterId) {
  return sql`
    SELECT ma.user_id, u.name, u.email
    FROM matter_access ma JOIN users u ON u.id = ma.user_id
    WHERE ma.matter_id = ${matterId} ORDER BY u.name`;
}

export async function reassignMatter(firmId, matterId, userId) {
  const rows = await sql`
    UPDATE matters SET assigned_user_id = ${userId}
    WHERE firm_id = ${firmId} AND id = ${matterId} RETURNING *`;
  return rows[0] || null;
}

export async function getMatter(firmId, matterId) {
  const rows = await sql`
    SELECT m.*, c.legal_name AS client_name, c.email AS client_email,
           c.address AS client_address, u.name AS assigned_name, u.email AS assigned_email
    FROM matters m
    JOIN clients c ON c.id = m.client_id
    LEFT JOIN users u ON u.id = m.assigned_user_id
    WHERE m.firm_id = ${firmId} AND m.id = ${matterId}
    LIMIT 1`;
  return rows[0] || null;
}

export async function createMatter(firmId, { clientId, reference, matterType, assignedUserId }) {
  const rows = await sql`
    INSERT INTO matters (firm_id, client_id, reference, matter_type, assigned_user_id, status)
    VALUES (${firmId}, ${clientId}, ${reference}, ${matterType},
            ${assignedUserId || null}, 'incomplete')
    RETURNING *`;
  return rows[0];
}

export async function setMatterStatus(firmId, matterId, status) {
  const stamp = status === 'open' ? 'opened_at' : status === 'closed' ? 'closed_at' : null;
  if (stamp === 'opened_at') {
    return sql`UPDATE matters SET status = ${status}, opened_at = COALESCE(opened_at, now())
               WHERE firm_id = ${firmId} AND id = ${matterId} RETURNING *`;
  }
  if (stamp === 'closed_at') {
    return sql`UPDATE matters SET status = ${status}, closed_at = now()
               WHERE firm_id = ${firmId} AND id = ${matterId} RETURNING *`;
  }
  return sql`UPDATE matters SET status = ${status}
             WHERE firm_id = ${firmId} AND id = ${matterId} RETURNING *`;
}

// ---------------------------------------------------------------
// Matter fields: value, provenance, confidence
// ---------------------------------------------------------------

export async function getMatterFields(matterId) {
  return sql`SELECT * FROM matter_fields WHERE matter_id = ${matterId} ORDER BY key`;
}

// Rule one lives here. A field with no stated value is not written at all.
// Absence is the signal that blocks generation. Never write a guessed value.
export async function upsertMatterField(matterId, field) {
  const { value, source, provenance, confidence, isNumeric } = field;
  // Stored under the shared name, so a value captured as matter_description and
  // a template asking for scope_summary are the same fact rather than two.
  const key = canonicalKey(field.key);
  if (value === null || value === undefined || String(value).trim() === '') return null;

  const rows = await sql`
    INSERT INTO matter_fields
      (matter_id, key, value, source, provenance, confidence, is_numeric, updated_at)
    VALUES (${matterId}, ${key}, ${String(value)}, ${source}, ${provenance || null},
            ${confidence ?? null}, ${Boolean(isNumeric)}, now())
    ON CONFLICT (matter_id, key) DO UPDATE SET
      value = EXCLUDED.value,
      source = EXCLUDED.source,
      provenance = EXCLUDED.provenance,
      confidence = EXCLUDED.confidence,
      is_numeric = EXCLUDED.is_numeric,
      confirmed_at = NULL,
      confirmed_by = NULL,
      updated_at = now()
    RETURNING *`;
  return rows[0];
}

export async function confirmMatterField(matterId, key, userId) {
  // Match either the canonical name or whatever it was stored as before the
  // vocabulary existed, so older records still confirm.
  const canon = canonicalKey(key);
  const rows = await sql`
    UPDATE matter_fields SET confirmed_at = now(), confirmed_by = ${userId}
    WHERE matter_id = ${matterId} AND key IN (${canon}, ${key}) RETURNING *`;
  return rows[0] || null;
}

// Completeness gate. Returns what is missing and what still needs confirming.
// Numbers always need confirmation regardless of confidence, because dictation
// mishears figures and sixty against sixteen in a fee clause is unacceptable.
export async function assessCompleteness(matterId, requiredFields) {
  const fields = await getMatterFields(matterId);
  const byKey = new Map(fields.map((f) => [canonicalKey(f.key), f]));

  const missing = requiredFields
    .map(canonicalKey)
    .filter((k, i, arr) => arr.indexOf(k) === i)
    .filter((k) => {
      const f = byKey.get(k);
      return !f || String(f.value ?? '').trim() === '';
    });

  const unconfirmedNumbers = fields
    .filter((f) => f.is_numeric && !f.confirmed_at)
    .map((f) => canonicalKey(f.key));

  return {
    total: requiredFields.length,
    captured: requiredFields.length - missing.length,
    missing,
    unconfirmedNumbers,
    canGenerate: missing.length === 0 && unconfirmedNumbers.length === 0,
  };
}

// ---------------------------------------------------------------
// Templates and precedents
// ---------------------------------------------------------------

export async function listTemplates(firmId) {
  return sql`
    SELECT id, name, doc_type, version, active, definition
    FROM templates WHERE firm_id = ${firmId} AND active = TRUE ORDER BY name`;
}

export async function getTemplate(firmId, templateId) {
  const rows = await sql`
    SELECT * FROM templates WHERE firm_id = ${firmId} AND id = ${templateId} LIMIT 1`;
  return rows[0] || null;
}

export async function getPrecedents(firmId, docType) {
  return sql`
    SELECT section_key, body FROM precedents
    WHERE firm_id = ${firmId} AND doc_type = ${docType}
    ORDER BY created_at DESC LIMIT 5`;
}

// ---------------------------------------------------------------
// Documents and versions
// ---------------------------------------------------------------

export async function listDocuments(firmId, matterId) {
  return sql`
    SELECT d.*, u.name AS created_by_name,
           (SELECT count(*) FROM flags f
              JOIN document_versions v ON v.id = f.document_version_id
              WHERE v.document_id = d.id AND v.version = d.current_version
                AND f.status = 'open' AND f.severity = 'blocking')::int AS open_blocking
    FROM documents d
    LEFT JOIN users u ON u.id = d.created_by
    WHERE d.firm_id = ${firmId} AND d.matter_id = ${matterId}
    ORDER BY d.created_at DESC`;
}

export async function listAllDocuments(firmId, { status, docType, actor } = {}) {
  // Two explicit queries rather than one with a condition folded into the SQL.
  // The clever version was a single statement whose visibility depended on a
  // parameter comparing equal to a literal, which is hard to read and harder to
  // be sure about. Access control should be obvious on inspection.
  const rows = (actor && !actor.seesAll)
    ? await sql`
        SELECT d.id, d.doc_type, d.status, d.current_version, d.created_at,
               m.id AS matter_id, m.reference, m.matter_type,
               c.legal_name AS client_name,
               u.name AS created_by_name,
               (SELECT u2.name FROM approvals a
                  JOIN document_versions v2 ON v2.id = a.document_version_id
                  JOIN users u2 ON u2.id = a.user_id
                 WHERE v2.document_id = d.id
                 ORDER BY a.approved_at DESC LIMIT 1) AS approved_by,
               (SELECT count(*) FROM flags f
                  JOIN document_versions v ON v.id = f.document_version_id
                 WHERE v.document_id = d.id AND v.version = d.current_version
                   AND f.status = 'open' AND f.severity = 'blocking')::int AS open_blocking
        FROM documents d
        JOIN matters m ON m.id = d.matter_id
        JOIN clients c ON c.id = m.client_id
        LEFT JOIN users u ON u.id = d.created_by
        WHERE d.firm_id = ${firmId}
          AND (m.assigned_user_id = ${actor.userId}
               OR EXISTS (SELECT 1 FROM matter_access ma
                           WHERE ma.matter_id = m.id AND ma.user_id = ${actor.userId}))
        ORDER BY d.created_at DESC
        LIMIT 300`
    : await sql`
        SELECT d.id, d.doc_type, d.status, d.current_version, d.created_at,
               m.id AS matter_id, m.reference, m.matter_type,
               c.legal_name AS client_name,
               u.name AS created_by_name,
               (SELECT u2.name FROM approvals a
                  JOIN document_versions v2 ON v2.id = a.document_version_id
                  JOIN users u2 ON u2.id = a.user_id
                 WHERE v2.document_id = d.id
                 ORDER BY a.approved_at DESC LIMIT 1) AS approved_by,
               (SELECT count(*) FROM flags f
                  JOIN document_versions v ON v.id = f.document_version_id
                 WHERE v.document_id = d.id AND v.version = d.current_version
                   AND f.status = 'open' AND f.severity = 'blocking')::int AS open_blocking
        FROM documents d
        JOIN matters m ON m.id = d.matter_id
        JOIN clients c ON c.id = m.client_id
        LEFT JOIN users u ON u.id = d.created_by
        WHERE d.firm_id = ${firmId}
        ORDER BY d.created_at DESC
        LIMIT 300`;

  return rows
    .filter((r) => !status || r.status === status)
    .filter((r) => !docType || r.doc_type === docType);
}

export async function createDocument(firmId, { matterId, templateId, docType, createdBy }) {
  const rows = await sql`
    INSERT INTO documents (firm_id, matter_id, template_id, doc_type, status, current_version, created_by)
    VALUES (${firmId}, ${matterId}, ${templateId}, ${docType}, 'draft', 1, ${createdBy})
    RETURNING *`;
  return rows[0];
}

export async function addDocumentVersion(documentId, { version, blocks, mergedValues, generatedBy }) {
  const rows = await sql`
    INSERT INTO document_versions (document_id, version, blocks, merged_values, generated_by)
    VALUES (${documentId}, ${version}, ${JSON.stringify(blocks)},
            ${JSON.stringify(mergedValues)}, ${generatedBy})
    RETURNING *`;
  return rows[0];
}

export async function getCurrentVersion(firmId, documentId) {
  const rows = await sql`
    SELECT v.* FROM document_versions v
    JOIN documents d ON d.id = v.document_id
    WHERE d.firm_id = ${firmId} AND v.document_id = ${documentId}
      AND v.version = d.current_version
    LIMIT 1`;
  return rows[0] || null;
}

export async function setDocumentStatus(firmId, documentId, status) {
  const rows = await sql`
    UPDATE documents SET status = ${status}
    WHERE firm_id = ${firmId} AND id = ${documentId} RETURNING *`;
  return rows[0] || null;
}

// ---------------------------------------------------------------
// Flags
// ---------------------------------------------------------------

export async function replaceFlags(documentVersionId, flagList) {
  await sql`DELETE FROM flags WHERE document_version_id = ${documentVersionId}`;
  for (const f of flagList) {
    await sql`
      INSERT INTO flags (document_version_id, severity, code, message, anchor)
      VALUES (${documentVersionId}, ${f.severity}, ${f.code}, ${f.message}, ${f.anchor || null})`;
  }
  return sql`SELECT * FROM flags WHERE document_version_id = ${documentVersionId} ORDER BY severity, id`;
}

export async function getFlags(documentVersionId) {
  return sql`
    SELECT * FROM flags WHERE document_version_id = ${documentVersionId}
    ORDER BY CASE severity WHEN 'blocking' THEN 0 ELSE 1 END, id`;
}

export async function resolveFlag(flagId, userId, { dismissed, reason }) {
  if (dismissed) {
    const rows = await sql`
      UPDATE flags SET status = 'dismissed', dismissed_reason = ${reason || null},
                       dismissed_by = ${userId}, dismissed_at = now()
      WHERE id = ${flagId} RETURNING *`;
    return rows[0] || null;
  }
  const rows = await sql`
    UPDATE flags SET status = 'resolved' WHERE id = ${flagId} RETURNING *`;
  return rows[0] || null;
}

// ---------------------------------------------------------------
// Approval and sending
// ---------------------------------------------------------------

// There is no auto-approve path in this codebase, by design.
// Authority is checked by the caller against the user role before this runs.
export async function recordApproval(documentVersionId, userId, dismissedFlags) {
  const rows = await sql`
    INSERT INTO approvals (document_version_id, user_id, dismissed_flags)
    VALUES (${documentVersionId}, ${userId}, ${JSON.stringify(dismissedFlags || [])})
    RETURNING *`;
  return rows[0];
}

export async function markIssued(documentVersionId) {
  const rows = await sql`
    UPDATE document_versions SET issued_at = COALESCE(issued_at, now())
    WHERE id = ${documentVersionId} RETURNING *`;
  return rows[0] || null;
}

export async function recordSend(payload) {
  const { documentVersionId, matterId, sentBy, toEmail, subject, coverNote, method } = payload;
  const rows = await sql`
    INSERT INTO sends (document_version_id, matter_id, sent_by, to_email, subject, cover_note, method)
    VALUES (${documentVersionId}, ${matterId}, ${sentBy}, ${toEmail},
            ${subject || null}, ${coverNote || null}, ${method || 'compose'})
    RETURNING *`;
  return rows[0];
}

// ---------------------------------------------------------------
// Audit and value reporting
// ---------------------------------------------------------------

export async function logEvent({ firmId, matterId, documentId, actorId, kind, payload }) {
  const rows = await sql`
    INSERT INTO events (firm_id, matter_id, document_id, actor_id, kind, payload)
    VALUES (${firmId}, ${matterId || null}, ${documentId || null}, ${actorId || null},
            ${kind}, ${JSON.stringify(payload || {})})
    RETURNING id`;
  return rows[0];
}

export async function getMatterTimeline(firmId, matterId) {
  return sql`
    SELECT e.*, u.name AS actor_name FROM events e
    LEFT JOIN users u ON u.id = e.actor_id
    WHERE e.firm_id = ${firmId} AND e.matter_id = ${matterId}
    ORDER BY e.created_at DESC`;
}

export async function logTime({ firmId, documentId, userId, secondsSpent, baselineMinutes }) {
  const rows = await sql`
    INSERT INTO time_logs (firm_id, document_id, user_id, seconds_spent, baseline_minutes)
    VALUES (${firmId}, ${documentId || null}, ${userId || null}, ${secondsSpent},
            ${baselineMinutes || null})
    RETURNING *`;
  return rows[0];
}

// Hours recovered and money saved, at the firm's own rates.
// This is what renews the retainer, so it is a first class query, not a report add-on.
export async function valueSummary(firmId, sinceDays = 30) {
  const rows = await sql`
    SELECT
      count(*)::int AS documents,
      COALESCE(sum(baseline_minutes), 0)::int AS baseline_minutes,
      COALESCE(sum(seconds_spent), 0)::int AS actual_seconds
    FROM time_logs
    WHERE firm_id = ${firmId} AND created_at > now() - (${sinceDays} || ' days')::interval`;
  const r = rows[0] || { documents: 0, baseline_minutes: 0, actual_seconds: 0 };
  const savedMinutes = Math.max(0, r.baseline_minutes - Math.round(r.actual_seconds / 60));
  return { ...r, saved_minutes: savedMinutes, saved_hours: +(savedMinutes / 60).toFixed(1) };
}
