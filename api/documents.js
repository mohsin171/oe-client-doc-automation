// Documents: generate, read, revise, sign off.
//
// Generation is gated twice. Once on the matter completeness check, and again
// inside the engine, which refuses to call the model while any placeholder is
// unresolved. Both gates are deliberate. Neither is a formality.

import { sql } from '../lib/db.js';
import {
  getMatter, getMatterFields, getTemplate, getPrecedents, assessCompleteness,
  listDocuments, listAllDocuments, createDocument, addDocumentVersion, getCurrentVersion,
  canSeeMatter,
  setDocumentStatus, replaceFlags, getFlags, resolveFlag, recordApproval,
  markIssued, setMatterStatus, logEvent, logTime,
} from '../lib/store.js';
import { generate } from '../lib/engine.js';
import { canonicalKey, isSystemField, SYSTEM_FIELDS } from '../lib/fields.js';
import { requireContext, actorFor, canApprove, ok, bad, readBody } from '../lib/context.js';

function valuesFrom(fields) {
  const out = {};
  for (const f of fields) out[canonicalKey(f.key)] = f.value;
  return out;
}

// UK convention: title plus surname, or Sirs for a company.
function salutationFor(name) {
  const n = String(name || '').trim();
  if (!n) return '';
  if (/\b(limited|ltd|llp|plc)\b/i.test(n)) return 'Sirs';

  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  const parts = n.split(/\s+/).filter(Boolean);
  const titles = ['mr', 'mrs', 'ms', 'miss', 'dr', 'professor', 'prof'];

  if (/^mr and mrs/i.test(n)) return `Mr and Mrs ${cap(parts[parts.length - 1])}`;

  if (parts.length > 1 && titles.includes(parts[0].toLowerCase().replace('.', ''))) {
    return `${cap(parts[0].replace('.', ''))} ${cap(parts[parts.length - 1])}`;
  }

  // No title given, so guessing one means guessing at gender or marital status.
  // Using the full name is the safe and conventional choice.
  return parts.map(cap).join(' ');
}

// A subject line goes to the client. Notes written for the file often carry
// framing that should never appear on a letter, so take the first clause and
// drop anything that reads as an internal aside.
function subjectFrom(scope, matterType) {
  const raw = String(scope || '').trim();
  if (!raw) return matterType ? matterType.charAt(0).toUpperCase() + matterType.slice(1) : '';

  const first = raw.split(/[.;]/)[0].trim();
  const internal = /\b(client (does not|doesn't|is clear|wants|asked|confirmed)|we (are not|will not be) involved|not involved|firm involved|per (the )?notes|internal)\b/i;
  if (internal.test(first) || first.length < 4) {
    return matterType ? matterType.charAt(0).toUpperCase() + matterType.slice(1) : '';
  }
  return first.slice(0, 90);
}

// Everything the system already knows. Asking a person for the reference it
// generated itself, or for today's date, is busywork that blocks a letter on
// information nobody needs to supply.
function systemValues({ matter, ctx, values }) {
  const branding = ctx.branding || {};
  return {
    letter_date: new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    }),
    matter_reference: matter.reference || '',
    client_salutation: salutationFor(values.client_legal_name || matter.client_name),
    firm_name: branding.letterhead || ctx.firm_name || '',
    firm_address: branding.address || '',
    fee_earner_title: ctx.title || '',
    matter_subject: subjectFrom(values.scope_summary, matter.matter_type),
  };
}

export default async function handler(req, res) {
  const ctx = await requireContext(req, res);
  if (!ctx) return;

  try {
    // ---------------- GET ----------------
    if (req.method === 'GET') {
      const { matterId, id } = req.query || {};

      if (matterId) {
        if (!(await canSeeMatter(ctx.firm_id, Number(matterId), actorFor(ctx)))) {
          return bad(res, 'Not found', 404);
        }
        const documents = await listDocuments(ctx.firm_id, Number(matterId));
        return ok(res, { documents });
      }

      // No matter and no document means the whole firm's output.
      if (!id) {
        const actor = actorFor(ctx);
        const documents = await listAllDocuments(ctx.firm_id, {
          status: (req.query || {}).status,
          docType: (req.query || {}).docType,
          actor,
        });
        // Say which scope was applied. Whether a restriction is working should
        // be visible on the screen, not inferred from what happens to be there.
        return ok(res, { documents, scope: actor.seesAll ? 'firm' : 'mine', role: ctx.role });
      }

      const rows = await sql`
        SELECT d.*, m.reference, c.legal_name AS client_name
        FROM documents d
        JOIN matters m ON m.id = d.matter_id
        JOIN clients c ON c.id = m.client_id
        WHERE d.firm_id = ${ctx.firm_id} AND d.id = ${Number(id)} LIMIT 1`;
      const document = rows[0];
      if (!document) return bad(res, 'Document not found', 404);
      if (!(await canSeeMatter(ctx.firm_id, document.matter_id, actorFor(ctx)))) {
        // Same answer as a document that does not exist, so the response cannot
        // be used to work out which clients the firm has.
        return bad(res, 'Document not found', 404);
      }

      const version = await getCurrentVersion(ctx.firm_id, document.id);
      const flags = version ? await getFlags(version.id) : [];

      const approvals = await sql`
        SELECT a.*, u.name AS approver_name FROM approvals a
        JOIN users u ON u.id = a.user_id
        WHERE a.document_version_id = ${version?.id || 0}
        ORDER BY a.approved_at DESC`;

      return ok(res, {
        document, version, flags, approvals,
        me: { id: ctx.user_id, name: ctx.name, role: ctx.role, canApprove: canApprove(ctx.role) },
      });
    }

    if (req.method !== 'POST') return bad(res, 'Method not allowed', 405);

    const body = await readBody(req);
    const action = body.action;

    // ---------------- Generate ----------------
    if (action === 'generate' || action === 'regenerate') {
      const matterId = Number(body.matterId);
      const templateId = Number(body.templateId);

      if (!(await canSeeMatter(ctx.firm_id, matterId, actorFor(ctx)))) {
        return bad(res, 'Not found', 404);
      }
      const matter = await getMatter(ctx.firm_id, matterId);
      if (!matter) return bad(res, 'Not found', 404);

      const template = await getTemplate(ctx.firm_id, templateId);
      if (!template) return bad(res, 'Template not found', 404);

      const definition = template.definition || {};
      const fields = await getMatterFields(matterId);
      const captured = valuesFrom(fields);
      const supplied = systemValues({ matter, ctx, values: captured });
      const values = { ...supplied, ...captured };

      // Gate one covers only what a person has to provide. System values are
      // filled here, so they are excluded rather than blocking generation.
      const mustAsk = (definition.requiredFields || [])
        .map(canonicalKey)
        .filter((f) => !isSystemField(f));
      const completeness = await assessCompleteness(matterId, mustAsk);
      if (!completeness.canGenerate) {
        return bad(res, JSON.stringify({
          reason: 'incomplete',
          missing: completeness.missing,
          unconfirmedNumbers: completeness.unconfirmedNumbers,
        }), 409);
      }

      const started = Date.now();
      const precedents = await getPrecedents(ctx.firm_id, template.doc_type);

      // Gate two lives inside generate(). It will not call the model while any
      // placeholder is unresolved.
      const result = await generate({
        definition,
        values,
        precedents,
        firmName: ctx.firm_name,
        docType: template.doc_type,
        // A system value can legitimately be blank, such as a fee earner with
        // no recorded grade. Those drop out of the text rather than stop it.
        optional: new Set(SYSTEM_FIELDS),
      });

      if (!result.ok) {
        return bad(res, JSON.stringify({ reason: 'incomplete', unresolved: result.unresolved }), 409);
      }

      let documentId = body.documentId ? Number(body.documentId) : null;
      let version = 1;

      if (documentId) {
        const existing = await sql`
          SELECT current_version, status FROM documents
          WHERE firm_id = ${ctx.firm_id} AND id = ${documentId} LIMIT 1`;
        if (!existing[0]) return bad(res, 'Document not found', 404);
        // Issued versions are immutable. A change always makes a new version.
        version = existing[0].current_version + 1;
        await sql`
          UPDATE documents SET current_version = ${version}, status = 'in_review'
          WHERE id = ${documentId}`;
      } else {
        const doc = await createDocument(ctx.firm_id, {
          matterId, templateId, docType: template.doc_type, createdBy: ctx.user_id,
        });
        documentId = doc.id;
        await setDocumentStatus(ctx.firm_id, documentId, 'in_review');
      }

      const dv = await addDocumentVersion(documentId, {
        version,
        blocks: result.blocks,
        mergedValues: result.mergedValues,
        generatedBy: ctx.user_id,
      });

      const flags = await replaceFlags(dv.id, result.flags);

      const baseline = ctx.settings?.baselineMinutes?.[template.doc_type] || null;
      await logTime({
        firmId: ctx.firm_id,
        documentId,
        userId: ctx.user_id,
        secondsSpent: Math.round((Date.now() - started) / 1000),
        baselineMinutes: baseline,
      });

      await logEvent({
        firmId: ctx.firm_id, matterId, documentId, actorId: ctx.user_id,
        kind: version === 1 ? 'document_generated' : 'document_regenerated',
        payload: {
          version,
          docType: template.doc_type,
          flags: flags.length,
          blocking: flags.filter((f) => f.severity === 'blocking').length,
        },
      });

      if (matter.status === 'open') await setMatterStatus(ctx.firm_id, matterId, 'active');

      return ok(res, { documentId, version, blocks: result.blocks, flags });
    }

    // ---------------- Edit a block by hand ----------------
    // One guard for every action that names a document, rather than four
    // separate checks that each have to be remembered.
    if (['edit_block', 'flag', 'approve', 'issue'].includes(action) && body.documentId) {
      const owning = await sql`
        SELECT matter_id FROM documents
        WHERE firm_id = ${ctx.firm_id} AND id = ${Number(body.documentId)} LIMIT 1`;
      if (!owning[0]) return bad(res, 'Document not found', 404);
      if (!(await canSeeMatter(ctx.firm_id, owning[0].matter_id, actorFor(ctx)))) {
        return bad(res, 'Document not found', 404);
      }
    }

    if (action === 'edit_block') {
      const version = await getCurrentVersion(ctx.firm_id, Number(body.documentId));
      if (!version) return bad(res, 'Document version not found', 404);

      const blocks = (version.blocks || []).map((b) =>
        b.key === body.blockKey ? { ...b, body: body.body, editedByHand: true } : b
      );

      await sql`
        UPDATE document_versions SET blocks = ${JSON.stringify(blocks)} WHERE id = ${version.id}`;

      await logEvent({
        firmId: ctx.firm_id, documentId: Number(body.documentId), actorId: ctx.user_id,
        kind: 'block_edited', payload: { blockKey: body.blockKey },
      });

      return ok(res, { blocks });
    }

    // ---------------- Resolve or dismiss a flag ----------------
    if (action === 'flag') {
      const flag = await resolveFlag(Number(body.flagId), ctx.user_id, {
        dismissed: Boolean(body.dismissed),
        reason: body.reason,
      });
      if (!flag) return bad(res, 'Flag not found', 404);

      // A dismissal without a reason is not a dismissal. The reason is what
      // makes the audit trail worth having two years later.
      if (body.dismissed && !body.reason) {
        return bad(res, 'A dismissal needs a reason');
      }

      await logEvent({
        firmId: ctx.firm_id, documentId: Number(body.documentId), actorId: ctx.user_id,
        kind: body.dismissed ? 'flag_dismissed' : 'flag_resolved',
        payload: { flagId: flag.id, code: flag.code, reason: body.reason || null },
      });

      const flags = await getFlags(flag.document_version_id);
      return ok(res, { flags });
    }

    // ---------------- Sign off ----------------
    if (action === 'approve') {
      // Authority is checked on the server. A drafter may prepare but not approve.
      if (!canApprove(ctx.role)) {
        return bad(res, 'Your role cannot sign off documents. Route this to an approver.', 403);
      }

      const documentId = Number(body.documentId);
      const version = await getCurrentVersion(ctx.firm_id, documentId);
      if (!version) return bad(res, 'Document version not found', 404);

      const flags = await getFlags(version.id);
      const openBlocking = flags.filter((f) => f.severity === 'blocking' && f.status === 'open');
      if (openBlocking.length > 0) {
        return bad(res, JSON.stringify({
          reason: 'blocking_flags',
          flags: openBlocking.map((f) => ({ id: f.id, message: f.message })),
        }), 409);
      }

      const dismissed = flags
        .filter((f) => f.status === 'dismissed')
        .map((f) => ({ code: f.code, message: f.message, reason: f.dismissed_reason }));

      await recordApproval(version.id, ctx.user_id, dismissed);
      await setDocumentStatus(ctx.firm_id, documentId, 'approved');

      await logEvent({
        firmId: ctx.firm_id, documentId, actorId: ctx.user_id,
        kind: 'document_approved',
        payload: { version: version.version, dismissedFlags: dismissed },
      });

      return ok(res, { approved: true, version: version.version, by: ctx.name });
    }

    // ---------------- Mark issued ----------------
    if (action === 'issue') {
      const documentId = Number(body.documentId);
      const doc = await sql`
        SELECT status FROM documents WHERE firm_id = ${ctx.firm_id} AND id = ${documentId} LIMIT 1`;
      if (!doc[0]) return bad(res, 'Document not found', 404);
      if (doc[0].status !== 'approved') {
        return bad(res, 'Only an approved document can be issued', 409);
      }

      const version = await getCurrentVersion(ctx.firm_id, documentId);
      await markIssued(version.id);
      await setDocumentStatus(ctx.firm_id, documentId, 'issued');

      await logEvent({
        firmId: ctx.firm_id, documentId, actorId: ctx.user_id,
        kind: 'document_issued', payload: { version: version.version },
      });

      return ok(res, { issued: true });
    }

    return bad(res, 'Unknown action');
  } catch (err) {
    return bad(res, err.message, 500);
  }
}
