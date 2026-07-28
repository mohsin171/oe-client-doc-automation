// Documents: generate, read, revise, sign off.
//
// Generation is gated twice. Once on the matter completeness check, and again
// inside the engine, which refuses to call the model while any placeholder is
// unresolved. Both gates are deliberate. Neither is a formality.

import { sql } from '../lib/db.js';
import {
  getMatter, getMatterFields, getTemplate, getPrecedents, assessCompleteness,
  listDocuments, listAllDocuments, createDocument, addDocumentVersion, getCurrentVersion,
  canSeeMatter, recordSend,
  setDocumentStatus, replaceFlags, getFlags, resolveFlag, recordApproval,
  markIssued, setMatterStatus, logEvent, logTime,
} from '../lib/store.js';
import { generate, runDeterministicRules, isVerifiable } from '../lib/engine.js';
import { canonicalKey, isSystemField, SYSTEM_FIELDS, fieldMeta } from '../lib/fields.js';
import { fixTargetFor } from '../lib/letter.js';
import { queryForMatter, describeGrounding } from '../lib/relevance.js';
import { renderLetterPdf } from '../lib/pdf.js';
import { sendDocumentEmail, emailConfigured } from '../lib/email.js';
import { requireContext, actorFor, canApprove, ok, bad, readBody } from '../lib/context.js';

function valuesFrom(fields) {
  const out = {};
  for (const f of fields) out[canonicalKey(f.key)] = f.value;
  return out;
}

// Run the firm's own checks over a letter again and reconcile them with what
// is already on the record.
//
// Three rules govern the reconciliation. A judgement a person already made is
// not undone by a re-run: a flag they resolved or dismissed stays that way, with
// their reason. A problem that has gone away is removed rather than left sitting
// there. And a problem that has appeared is raised, open, so it has to be
// answered before sign-off.
async function recheck({ ctx, documentId, version, blocks }) {
  const docRows = await sql`
    SELECT template_id FROM documents
    WHERE firm_id = ${ctx.firm_id} AND id = ${documentId} LIMIT 1`;
  if (!docRows[0]?.template_id) return;

  const template = await getTemplate(ctx.firm_id, docRows[0].template_id);
  if (!template) return;

  const values = version.merged_values || {};
  const found = runDeterministicRules(template.definition || {}, blocks, values);

  const existing = await sql`
    SELECT * FROM flags WHERE document_version_id = ${version.id}`;

  const keyOf = (f) => `${f.code}:${f.anchor || ''}`;
  const settled = new Map(
    existing.filter((f) => f.status !== 'open').map((f) => [keyOf(f), f])
  );
  const stillFound = new Set(found.map(keyOf));

  // Anything the model raised is left alone: this pass only owns the firm's
  // own deterministic checks, and re-running the model on every keystroke
  // would be slow and would produce different opinions each time.
  const deterministicCodes = new Set(found.map((f) => f.code));

  for (const f of existing) {
    if (f.status !== 'open') continue;
    if (stillFound.has(keyOf(f))) continue;
    // An open check whose problem no longer exists.
    if (deterministicCodes.has(f.code) || f.code === 'standard_clause_amended') continue;
    await sql`DELETE FROM flags WHERE id = ${f.id}`;
  }

  const openNow = new Set(
    (await sql`SELECT code, anchor FROM flags WHERE document_version_id = ${version.id}`)
      .map((f) => `${f.code}:${f.anchor || ''}`)
  );

  for (const f of found) {
    const key = keyOf(f);
    if (openNow.has(key) || settled.has(key)) continue;
    await sql`
      INSERT INTO flags (document_version_id, severity, code, message, anchor)
      VALUES (${version.id}, ${f.severity}, ${f.code}, ${f.message}, ${f.anchor || null})`;
  }
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
  const titled = (t) => (t ? String(t).charAt(0).toUpperCase() + String(t).slice(1) : '');
  const fallback = titled(matterType);

  const raw = String(scope || '').trim();
  if (!raw) return fallback;

  const first = raw.split(/[.;]/)[0].trim();

  // Written for the file rather than the client.
  const internal = /\b(client (does not|doesn't|is clear|wants|asked|confirmed)|we (are not|will not be) involved|not involved|firm involved|per (the )?notes|internal)\b/i;
  if (internal.test(first) || first.length < 4) return fallback;

  // A subject is a label, not a summary. If the first clause runs long it is
  // prose describing the work, and cutting prose to length produces a sentence
  // that stops mid-word. The area of work is a better heading than a fragment.
  if (first.length > 70) return fallback;

  // Reads as an activity rather than a thing. "Reviewing contract and title"
  // is what the firm will do, not what the letter is about.
  if (/^\w+ing\b/i.test(first) && fallback) return fallback;

  return first;
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
        SELECT d.*, m.reference, m.matter_type,
               c.legal_name AS client_name, c.address AS client_address,
               c.email AS client_email
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
      // What this version was grounded on. Read from the audit trail rather than
      // stored on the version, because it is a fact about how the draft was made
      // and that is what the trail is for. Keeping it out of merged_values also
      // matters: the checks scan those values for stray figures, and a list of
      // filenames in there would confuse them.
      const groundedRows = version ? await sql`
        SELECT payload FROM events
        WHERE firm_id = ${ctx.firm_id} AND document_id = ${Number(id)}
          AND kind = 'grounded_on'
        ORDER BY created_at DESC LIMIT 1` : [];
      const groundedOn = groundedRows[0]?.payload?.letters || [];

      const blocks = version?.blocks || [];
      const flags = (version ? await getFlags(version.id) : []).map((f) => ({
        ...f,
        verifiable: isVerifiable(f.code),
        // Where the problem shows is f.anchor. Where the correction goes is
        // this, and they are often different passages.
        fixIn: fixTargetFor(f, blocks),
      }));

      const sends = await sql`
        SELECT s.id, s.to_email, s.subject, s.cover_note, s.method, s.sent_at,
               s.document_version_id,
               u.name AS sent_by_name, u.email AS sent_by_email,
               v.version, d2.doc_type
        FROM sends s
        JOIN users u ON u.id = s.sent_by
        JOIN document_versions v ON v.id = s.document_version_id
        JOIN documents d2 ON d2.id = v.document_id
        WHERE s.matter_id = ${document.matter_id}
        ORDER BY s.sent_at DESC`;

      const assigned = await sql`
        SELECT u.name, u.email FROM matters m
        JOIN users u ON u.id = m.assigned_user_id
        WHERE m.id = ${document.matter_id} LIMIT 1`;

      const approvals = await sql`
        SELECT a.*, u.name AS approver_name FROM approvals a
        JOIN users u ON u.id = a.user_id
        WHERE a.document_version_id = ${version?.id || 0}
        ORDER BY a.approved_at DESC`;

      return ok(res, {
        document, version, flags, approvals, sends, groundedOn,
        sender: assigned[0] || { name: ctx.name, email: ctx.email },
        canSend: emailConfigured(),
        firm: {
          name: ctx.firm_name,
          branding: ctx.branding || {},
        },
        salutation: salutationFor(document.client_name),
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
      // Shown the firm's closest letters, not its most recent. The query is what
      // this matter is about, which is the only thing that distinguishes it from
      // the last one.
      const precedents = await getPrecedents(ctx.firm_id, template.doc_type, {
        query: queryForMatter(values, matter),
        limit: 5,
      });

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

      const before = (version.blocks || []).find((b) => b.key === body.blockKey);
      const wasStandard = before?.kind === 'fixed';
      const changed = String(before?.body || '') !== String(body.body || '');

      const blocks = (version.blocks || []).map((b) =>
        b.key === body.blockKey
          ? { ...b, body: body.body, editedByHand: true, amended: wasStandard && changed ? true : b.amended }
          : b
      );

      await sql`
        UPDATE document_versions SET blocks = ${JSON.stringify(blocks)} WHERE id = ${version.id}`;

      // Re-examine the letter. Checks used to run once, at generation, so a
      // clean draft could be edited to say anything and signed off with nothing
      // looking at it again. The edit is exactly the moment a figure gets
      // changed by hand.
      await recheck({ ctx, documentId: Number(body.documentId), version, blocks });

      // A person may change anything in a letter they are about to put their
      // name to. The rule was always that the model cannot alter a standard
      // clause, not that a solicitor cannot. But it must not pass quietly:
      // this letter now departs from the firm's own terms, and whoever signs
      // it has to be told, in a way they have to answer rather than notice.
      if (wasStandard && changed) {
        const existing = await sql`
          SELECT id FROM flags
          WHERE document_version_id = ${version.id} AND code = 'standard_clause_amended'
            AND anchor = ${body.blockKey} AND status = 'open' LIMIT 1`;
        if (!existing[0]) {
          await sql`
            INSERT INTO flags (document_version_id, severity, code, message, anchor)
            VALUES (${version.id}, 'blocking', 'standard_clause_amended',
                    ${'A standard clause has been changed by hand, so this letter no longer '
                      + "matches the firm's own wording. Confirm the change is intended before signing off."},
                    ${body.blockKey})`;
        }
      }

      await logEvent({
        firmId: ctx.firm_id, documentId: Number(body.documentId), actorId: ctx.user_id,
        kind: wasStandard && changed ? 'standard_clause_amended' : 'block_edited',
        payload: {
          blockKey: body.blockKey,
          ...(wasStandard && changed ? { was: String(before.body).slice(0, 500) } : {}),
        },
      });

      return ok(res, { blocks });
    }

    // ---------------- Resolve or dismiss a flag ----------------
    if (action === 'flag') {
      const current = await sql`
        SELECT f.code FROM flags f
        JOIN document_versions v ON v.id = f.document_version_id
        JOIN documents d ON d.id = v.document_id
        WHERE f.id = ${Number(body.flagId)} AND d.firm_id = ${ctx.firm_id} LIMIT 1`;
      if (!current[0]) return bad(res, 'Flag not found', 404);

      // A dismissal without a reason is not a dismissal. The reason is what
      // makes the audit trail worth having two years later.
      if (body.dismissed && !body.reason) {
        return bad(res, 'A dismissal needs a reason');
      }

      // Marking a check resolved, when the system can see for itself whether it
      // is resolved, would let a letter go out promising an estimate it does not
      // contain while the record says somebody dealt with it.
      if (!body.dismissed && isVerifiable(current[0].code)) {
        return bad(res, 'This check clears itself once the letter is corrected. '
          + 'Edit the section, or dismiss it with a reason.', 409);
      }

      const flag = await resolveFlag(Number(body.flagId), ctx.user_id, {
        dismissed: Boolean(body.dismissed),
        reason: body.reason,
      });
      if (!flag) return bad(res, 'Flag not found', 404);

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

    // ---------------- Reopen after sign-off ----------------
    // A signed-off letter with no way to correct it is a dead end, and someone
    // will work around it by editing the Word file, which is worse: the record
    // then says one thing and the client received another.
    if (action === 'reopen') {
      const documentId = Number(body.documentId);
      const rows = await sql`
        SELECT status, current_version FROM documents
        WHERE firm_id = ${ctx.firm_id} AND id = ${documentId} LIMIT 1`;
      if (!rows[0]) return bad(res, 'Document not found', 404);

      const current = await getCurrentVersion(ctx.firm_id, documentId);
      if (!current) return bad(res, 'No version found', 404);

      if (rows[0].status === 'issued') {
        // An issued version has left the firm. It is immutable, so revising
        // means a new version beside it, never a change to the one the client
        // has in their hands.
        const next = rows[0].current_version + 1;
        await addDocumentVersion(documentId, {
          version: next,
          blocks: current.blocks,
          mergedValues: current.merged_values,
          generatedBy: ctx.user_id,
        });
        await sql`
          UPDATE documents SET current_version = ${next}, status = 'in_review'
          WHERE id = ${documentId}`;
        await logEvent({
          firmId: ctx.firm_id, documentId, actorId: ctx.user_id,
          kind: 'document_revised', payload: { from: rows[0].current_version, to: next },
        });
        return ok(res, { reopened: true, version: next, newVersion: true });
      }

      // Approved but not yet issued: the same version reopens. The earlier
      // approval stays on the record, because it happened.
      await setDocumentStatus(ctx.firm_id, documentId, 'in_review');
      await sql`
        INSERT INTO flags (document_version_id, severity, code, message, anchor)
        VALUES (${current.id}, 'advisory', 'reopened_after_signoff',
                ${'This letter was reopened after being signed off. It needs signing off again '
                  + 'before it can be sent.'}, NULL)`;
      await logEvent({
        firmId: ctx.firm_id, documentId, actorId: ctx.user_id,
        kind: 'document_reopened', payload: { version: rows[0].current_version },
      });
      return ok(res, { reopened: true, version: rows[0].current_version });
    }

    // ---------------- Send to the client ----------------
    if (action === 'send') {
      const documentId = Number(body.documentId);

      const rows = await sql`
        SELECT d.*, m.reference, m.assigned_user_id,
               c.legal_name AS client_name, c.address AS client_address, c.email AS client_email
        FROM documents d
        JOIN matters m ON m.id = d.matter_id
        JOIN clients c ON c.id = m.client_id
        WHERE d.firm_id = ${ctx.firm_id} AND d.id = ${documentId} LIMIT 1`;
      const document = rows[0];
      if (!document) return bad(res, 'Document not found', 404);

      // Only a signed-off letter leaves the firm. Enforced here rather than by
      // hiding a button, since a send is the one action that cannot be undone.
      if (!['approved', 'issued'].includes(document.status)) {
        return bad(res, 'This letter has not been signed off yet.', 409);
      }

      const to = String(body.to || document.client_email || '').trim();
      if (!to) return bad(res, 'No email address for this client.', 422);

      const version = await getCurrentVersion(ctx.firm_id, documentId);
      if (!version) return bad(res, 'No version found', 404);

      // The letter is attached as it stands, generated now rather than trusting
      // a file someone downloaded earlier and may have edited.
      const sender = document.assigned_user_id
        ? (await sql`SELECT name, email FROM users WHERE id = ${document.assigned_user_id} LIMIT 1`)[0]
        : { name: ctx.name, email: ctx.email };

      // Generated now rather than trusting a file someone downloaded earlier.
      const pdf = await renderLetterPdf({
        document,
        version,
        firm: { name: ctx.firm_name, branding: ctx.branding || {} },
        salutation: salutationFor(document.client_name),
        dateText: new Date().toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric',
        }),
        sender,
      });

      const filename = `${document.doc_type}-${document.reference.replace(/\//g, '-')}.pdf`;
      const subject = String(body.subject || '').trim()
        || `${ctx.firm_name}: your engagement letter (${document.reference})`;

      const result = await sendDocumentEmail({
        to,
        replyTo: sender?.email,
        fromName: `${sender?.name || ctx.name}, ${ctx.firm_name}`,
        subject,
        body: String(body.note || ''),
        attachment: pdf,
        filename,
      });

      if (!result.sent) {
        const messages = {
          not_configured: 'Email is not connected. Add RESEND_API_KEY and redeploy.',
          no_recipient: 'No email address for this client.',
          provider_error: `The mail provider refused it: ${result.detail || 'no detail given'}`,
        };
        return bad(res, messages[result.reason] || 'Could not send', 502);
      }

      await recordSend({
        documentVersionId: version.id,
        matterId: document.matter_id,
        sentBy: ctx.user_id,
        toEmail: to,
        subject,
        coverNote: String(body.note || ''),
        method: 'in_app',
      });

      await logEvent({
        firmId: ctx.firm_id, matterId: document.matter_id, documentId, actorId: ctx.user_id,
        kind: 'document_sent',
        payload: { to, subject, version: version.version, from: result.from },
      });

      if (document.status === 'approved') {
        await markIssued(version.id);
        await setDocumentStatus(ctx.firm_id, documentId, 'issued');
      }

      return ok(res, { sent: true, to, from: result.from });
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
