// Matters: the queue, matter opening, and field capture.
//
// The completeness gate lives here. A matter cannot leave 'incomplete' while a
// required field is missing or a captured number is unconfirmed.

import {
  listMatters, getMatter, createMatter, setMatterStatus, canSeeMatter,
  conflictCheck, grantMatterAccess, revokeMatterAccess, listMatterAccess, reassignMatter,
  findOrCreateClient, getMatterFields, upsertMatterField, confirmMatterField,
  assessCompleteness, listTemplates, getMatterTimeline, listUsers, logEvent,
} from '../lib/store.js';
import { sql } from '../lib/db.js';
import { requireContext, actorFor, ok, bad, readBody } from '../lib/context.js';
import { buildFormSchema, splitSchema, fieldMeta, canonicalKey, isSystemField } from '../lib/fields.js';
import { extractFromNarrative } from '../lib/extract.js';

// A file needs some things no document ever prints. An email address is how
// anything reaches the client at all, so it cannot depend on whether a template
// happens to mention it. Template fields are unioned on top of these.
const CORE_FIELDS = [
  'client_legal_name',
  'client_email',
  'client_phone',
  'client_address',
  'matter_type',
  'fee_earner_name',
];

// Of those, only these two are genuinely required to open a file.
const REQUIRED_TO_OPEN = ['client_legal_name', 'matter_type'];

// Facts a file benefits from whether or not a template asks for them. Offered,
// never demanded, so a missing one can never block a letter.
const SUGGESTED_FIELDS = [
  'fee_estimate', 'hours_estimate', 'fee_cap', 'disbursements',
  'engagement_date', 'completion_date', 'key_dates', 'exclusions',
  'supervisor_name', 'other_party',
];

// Anything that looks like money, a rate, or a count is treated as numeric and
// always requires explicit confirmation. Dictation mishears figures, and sixty
// against sixteen in a fee clause ends a client relationship.
function looksNumeric(key, value) {
  if (/rate|fee|amount|price|cost|hours|total|estimate|cap|percent/i.test(key)) return true;
  return /^[£$€]?\s*[\d,]+(\.\d+)?\s*%?$/.test(String(value).trim());
}

async function requiredFor(firmId, matter) {
  const templates = await listTemplates(firmId);
  const set = new Set(REQUIRED_TO_OPEN);
  // An earlier version skipped templates whose doc_type did not equal the
  // matter_type. Those are different things: one is a kind of document, the
  // other an area of law, so nothing ever matched and the page reported a
  // record complete without having checked it. Every active template counts.
  for (const t of templates) {
    for (const f of (t.definition?.requiredFields || [])) {
      const k = canonicalKey(f);
      if (!isSystemField(k)) set.add(k);
    }
  }
  return [...set];
}

export default async function handler(req, res) {
  const ctx = await requireContext(req, res);
  if (!ctx) return;

  try {
    // ---------------- GET ----------------
    if (req.method === 'GET') {
      const { id, view } = req.query || {};

      // The form is built from what the firm's templates declare, not from a
      // list hard-coded here. Add a template tomorrow and the form follows.
      if (view === 'form') {
        const templates = await listTemplates(ctx.firm_id);
        const users = await listUsers(ctx.firm_id);
        const clients = await sql`
          SELECT id, legal_name, email, phone, address, company_no
          FROM clients WHERE firm_id = ${ctx.firm_id}
          ORDER BY legal_name LIMIT 200`;
        const schema = buildFormSchema(templates, CORE_FIELDS);
        const split = splitSchema(schema);
        return ok(res, {
          schema,
          typed: split.typed,
          extracted: split.extracted,
          me: { id: ctx.user_id, name: ctx.name },
          templates: templates.map((t) => ({ id: t.id, name: t.name, doc_type: t.doc_type })),
          users: users.filter((u) => u.active),
          clients,
          me: { id: ctx.user_id, name: ctx.name },
        });
      }

      // A name only conflict check, available to everyone. It answers whether
      // the firm already acts for someone by that name and nothing else: no
      // file, no fee earner, no detail.
      if (view === 'conflict') {
        // When correcting a file, the client on it is excluded: a file is not in
        // conflict with itself, and saying it is teaches a reader to ignore the
        // warning, which costs more than the check is worth.
        let excludeClientId = null;
        if ((req.query || {}).matterId) {
          const own = await getMatter(ctx.firm_id, Number(req.query.matterId));
          excludeClientId = own?.client_id || null;
        }
        const { matches } = await conflictCheck(
          ctx.firm_id, (req.query || {}).name, excludeClientId,
        );
        return ok(res, { matches });
      }

      if (!id) {
        const actor = actorFor(ctx);
        const matters = await listMatters(ctx.firm_id, actor);
        const users = await listUsers(ctx.firm_id);
        return ok(res, {
          matters, users,
          scope: actor.seesAll ? 'firm' : 'mine',
          me: { id: ctx.user_id, name: ctx.name, role: ctx.role, firm: ctx.firm_name },
        });
      }

      if (!(await canSeeMatter(ctx.firm_id, Number(id), actorFor(ctx)))) {
        // Deliberately the same answer as a matter that does not exist. Saying
        // "you cannot see this" confirms the client is on the system.
        return bad(res, 'Client not found', 404);
      }

      const matter = await getMatter(ctx.firm_id, Number(id));
      if (!matter) return bad(res, 'Client not found', 404);

      const fields = await getMatterFields(matter.id);
      const required = await requiredFor(ctx.firm_id, matter);
      const completeness = await assessCompleteness(matter.id, required);
      const templates = await listTemplates(ctx.firm_id);
      const timeline = view === 'full' ? await getMatterTimeline(ctx.firm_id, matter.id) : [];
      const users = (await listUsers(ctx.firm_id)).filter((u) => u.active);

      // The notes the facts were read from. Editing a fee or a scope without being
      // able to see, or correct, the notes behind it is editing the answer while
      // leaving the working wrong.
      const capture = (await sql`
        SELECT transcript FROM captures
        WHERE matter_id = ${matter.id} AND transcript IS NOT NULL
        ORDER BY created_at DESC LIMIT 1`)[0];
      const access = await listMatterAccess(matter.id);

      // Describe each gap so it can be filled with the right control rather
      // than a text box for everything.
      const gaps = (completeness.missing || []).map((k) => fieldMeta(k));

      // Anything already held, required, or offered above is not offered again.
      const held = new Set(fields.map((f) => canonicalKey(f.key)));
      const shown = new Set([...held, ...(completeness.missing || []).map(canonicalKey)]);
      const suggestions = SUGGESTED_FIELDS
        .map(canonicalKey)
        .filter((k) => !shown.has(k))
        .map((k) => fieldMeta(k));

      return ok(res, {
        matter, fields, required, completeness, templates, timeline, users, gaps, suggestions,
        // The notes the facts were read from, so correcting a fee does not mean
        // editing the answer while leaving the working wrong.
        narrative: capture?.transcript || '',
        // Who can see this file, and whether the person looking may change it.
        access,
        canManageAccess: ctx.role === 'owner',
      });
    }

    if (!['POST', 'PATCH'].includes(req.method)) return bad(res, 'Method not allowed', 405);

    const body = await readBody(req);

    // ---------------- Create a matter ----------------
    if (req.method === 'POST' && (body.action || 'create') === 'create') {
      const values = body.values || {};
      const clientLegalName = String(values.client_legal_name || body.clientLegalName || '').trim();
      const matterType = String(values.matter_type || body.matterType || '').trim();

      if (!clientLegalName || !matterType) {
        return bad(res, 'Client legal name and matter type are both required');
      }

      const client = body.clientId
        ? (await sql`SELECT * FROM clients WHERE firm_id = ${ctx.firm_id} AND id = ${Number(body.clientId)} LIMIT 1`)[0]
        : await findOrCreateClient(ctx.firm_id, {
            legalName: clientLegalName,
            email: values.client_email,
            phone: values.client_phone,
            address: values.client_address,
            companyNo: values.company_no || values.company_number,
          });

      if (!client) return bad(res, 'Client not found', 404);

      // Contact details change. If this file carries newer ones, keep them,
      // but never overwrite something with nothing.
      if (body.clientId) {
        await sql`
          UPDATE clients SET
            email   = COALESCE(NULLIF(${values.client_email || ''}, ''), email),
            phone   = COALESCE(NULLIF(${values.client_phone || ''}, ''), phone),
            address = COALESCE(NULLIF(${values.client_address || ''}, ''), address)
          WHERE id = ${client.id} AND firm_id = ${ctx.firm_id}`;
      }

      const ref = String(values.matter_reference || body.reference || '').trim()
        || `${new Date().getFullYear()}/${Date.now().toString().slice(-5)}`;

      // Both names come from the session rather than the request. Whoever is
      // signed in entered the client, so they are the person responsible, and a
      // browser should not be able to say otherwise.
      const matter = await createMatter(ctx.firm_id, {
        clientId: client.id,
        reference: ref,
        matterType,
        assignedUserId: ctx.user_id,
      });
      values.fee_earner_name = ctx.name;
      if (!String(values.supervisor_name || '').trim()) values.supervisor_name = ctx.name;

      // The fee earner's own account, kept whole. The structured fields are
      // derived from it, but the account is what a person would want to read
      // in two years when asking why the letter said what it said.
      if (String(body.narrative || '').trim()) {
        await sql`
          INSERT INTO captures (matter_id, user_id, kind, transcript, extracted)
          VALUES (${matter.id}, ${ctx.user_id}, 'notes', ${body.narrative},
                  ${JSON.stringify(body.provenance || {})})`;
      }

      // Rule one is enforced in the store: an empty value is never written, so
      // a gap stays a gap rather than becoming a blank that looks answered.
      const provenance = body.provenance || {};
      for (const [key, value] of Object.entries(values)) {
        const meta = fieldMeta(key);
        const fromNotes = Boolean(provenance[key]);
        const isNum = meta.numeric || looksNumeric(key, value);

        await upsertMatterField(matter.id, {
          key,
          value,
          source: fromNotes ? 'dictation' : 'form',
          provenance: fromNotes
            ? `From your notes: "${String(provenance[key]).slice(0, 200)}"`
            : 'Typed on the client details page',
          confidence: fromNotes ? 0.8 : 1,
          isNumeric: isNum,
        });

        // Typing a figure confirms it. A figure the system read out of the
        // notes does not get that for free, whatever it looked like.
        if (isNum && !fromNotes && String(value ?? '').trim() !== '') {
          await confirmMatterField(matter.id, key, ctx.user_id);
        }
      }

      await logEvent({
        firmId: ctx.firm_id, matterId: matter.id, actorId: ctx.user_id,
        kind: 'matter_created', payload: { reference: ref, matterType },
      });

      const required = await requiredFor(ctx.firm_id, matter);
      const completeness = await assessCompleteness(matter.id, required);
      if (completeness.canGenerate) await setMatterStatus(ctx.firm_id, matter.id, 'open');

      return ok(res, { matter, completeness });
    }

    // ---------------- Read the fee earner's notes ----------------
    // A preview. Nothing is written, because a person confirms first.
    if (body.action === 'extract') {
      const templates = await listTemplates(ctx.firm_id);
      const { extracted } = splitSchema(buildFormSchema(templates, CORE_FIELDS));

      const result = await extractFromNarrative({
        narrative: body.narrative,
        fields: extracted,
        knownValues: body.values || {},
        firmName: ctx.firm_name,
      });

      if (!result.ok) {
        return bad(res, result.reason === 'too_short'
          ? 'Write a little more about the call first.'
          : 'Could not read those notes. Try rephrasing them.', 422);
      }
      return ok(res, result);
    }

    // ---------------- Capture or correct fields ----------------
    if (body.action === 'fields') {
      const matterId = Number(body.matterId);
      const matter = await getMatter(ctx.firm_id, matterId);
      if (!matter) return bad(res, 'Matter not found', 404);

      for (const [rawKey, value] of Object.entries(body.values || {})) {
        const key = canonicalKey(rawKey);
        // Rule one. An empty value is not a value. It is not written, and the
        // field stays missing so the gate keeps blocking.
        if (value === null || value === undefined || String(value).trim() === '') continue;

        await upsertMatterField(matterId, {
          key,
          value,
          source: body.source || 'manual_fix',
          provenance: body.provenance?.[key] || 'Entered by hand',
          confidence: 1,
          isNumeric: looksNumeric(key, value),
        });

        // A value typed by a person is confirmed by definition.
        if (body.source !== 'dictation') {
          await confirmMatterField(matterId, key, ctx.user_id);
        }
      }

      for (const key of body.confirm || []) {
        await confirmMatterField(matterId, key, ctx.user_id);
      }

      const fields = await getMatterFields(matterId);
      const required = await requiredFor(ctx.firm_id, matter);
      const completeness = await assessCompleteness(matterId, required);

      if (completeness.canGenerate && matter.status === 'incomplete') {
        await setMatterStatus(ctx.firm_id, matterId, 'open');
        await logEvent({
          firmId: ctx.firm_id, matterId, actorId: ctx.user_id,
          kind: 'matter_opened', payload: { captured: completeness.captured },
        });
      }

      return ok(res, { fields, completeness });
    }

    // ---------------- Close a matter ----------------
    // Reassignment and cover, owner only.
    // Correcting the client's own details. Separate from filling a gap, because
    // these live on the client record as well as this matter, and every other file
    // for the same client draws from the same row.
    if (body.action === 'edit_client') {
      const matterId = Number(body.matterId);
      const matter = await getMatter(ctx.firm_id, matterId);
      if (!matter) return bad(res, 'Client not found', 404);
      if (!(await canSeeMatter(ctx.firm_id, matterId, actorFor(ctx)))) {
        return bad(res, 'Client not found', 404);
      }

      const values = body.values || {};
      const name = String(values.client_legal_name || '').trim();
      if (!name) return bad(res, 'A client needs a legal name');

      const beforeRow = (await sql`
        SELECT legal_name, email, phone, address FROM clients
        WHERE id = ${matter.client_id} AND firm_id = ${ctx.firm_id} LIMIT 1`)[0];

      await sql`
        UPDATE clients SET
          legal_name = ${name},
          email   = COALESCE(NULLIF(${values.client_email || ''}, ''), email),
          phone   = COALESCE(NULLIF(${values.client_phone || ''}, ''), phone),
          address = COALESCE(NULLIF(${values.client_address || ''}, ''), address)
        WHERE id = ${matter.client_id} AND firm_id = ${ctx.firm_id}`;

      if (String(values.matter_type || '').trim()) {
        await sql`
          UPDATE matters SET matter_type = ${String(values.matter_type).trim()}
          WHERE id = ${matterId} AND firm_id = ${ctx.firm_id}`;
      }

      // The matter record has its own copy, because a letter is generated from the
      // matter rather than from the client, and a letter issued last year should
      // still say what it said. Both are updated; issued documents are untouched.
      for (const key of ['client_legal_name', 'client_email', 'client_phone',
        'client_address', 'matter_type']) {
        const v = values[key];
        if (v === undefined || String(v).trim() === '') continue;
        await upsertMatterField(matterId, {
          key: canonicalKey(key),
          value: String(v).trim(),
          source: 'manual_fix',
          provenance: 'Corrected by hand',
          confidence: 1,
          isNumeric: false,
        });
        await confirmMatterField(matterId, canonicalKey(key), ctx.user_id);
      }

      // What changed, in the record, because a client's name appearing differently
      // on two letters is a question somebody will ask.
      const changed = {};
      for (const [col, key] of [['legal_name', 'client_legal_name'], ['email', 'client_email'],
        ['phone', 'client_phone'], ['address', 'client_address']]) {
        const now = String(values[key] || '').trim();
        if (now && now !== String(beforeRow?.[col] || '')) {
          changed[col] = { from: beforeRow?.[col] || null, to: now };
        }
      }

      await logEvent({
        firmId: ctx.firm_id, matterId, actorId: ctx.user_id,
        kind: 'client_details_corrected', payload: { changed },
      });

      return ok(res, { changed: Object.keys(changed) });
    }

    // Everything the client form holds, corrected in one act: the typed facts, the
    // facts read from the notes, and the notes themselves.
    if (body.action === 'update') {
      const matterId = Number(body.matterId);
      const matter = await getMatter(ctx.firm_id, matterId);
      if (!matter) return bad(res, 'Client not found', 404);
      if (!(await canSeeMatter(ctx.firm_id, matterId, actorFor(ctx)))) {
        return bad(res, 'Client not found', 404);
      }

      const values = body.values || {};
      const name = String(values.client_legal_name || '').trim();
      if (!name) return bad(res, 'A client needs a legal name');

      const beforeRow = (await sql`
        SELECT legal_name, email, phone, address FROM clients
        WHERE id = ${matter.client_id} AND firm_id = ${ctx.firm_id} LIMIT 1`)[0];

      await sql`
        UPDATE clients SET
          legal_name = ${name},
          email   = COALESCE(NULLIF(${values.client_email || ''}, ''), email),
          phone   = COALESCE(NULLIF(${values.client_phone || ''}, ''), phone),
          address = COALESCE(NULLIF(${values.client_address || ''}, ''), address)
        WHERE id = ${matter.client_id} AND firm_id = ${ctx.firm_id}`;

      if (String(values.matter_type || '').trim()) {
        await sql`
          UPDATE matters SET matter_type = ${String(values.matter_type).trim()}
          WHERE id = ${matterId} AND firm_id = ${ctx.firm_id}`;
      }

      // Every value the form carries, not only the client's own details. A blank is
      // still not a value: it leaves what is there rather than erasing it, because a
      // field the form did not ask about this time must not be wiped by its absence.
      for (const [rawKey, raw] of Object.entries(values)) {
        const key = canonicalKey(rawKey);
        if (isSystemField(key)) continue;
        const v = String(raw ?? '').trim();
        if (!v) continue;
        await upsertMatterField(matterId, {
          key,
          value: v,
          source: 'manual_fix',
          provenance: body.provenance?.[key] || 'Corrected by hand',
          confidence: 1,
          isNumeric: looksNumeric(key, v),
        });
        await confirmMatterField(matterId, key, ctx.user_id);
      }

      // The notes are kept as a new capture rather than overwritten, so what the
      // facts were originally read from is still on the record.
      const narrative = String(body.narrative || '').trim();
      if (narrative) {
        await sql`
          INSERT INTO captures (matter_id, user_id, kind, transcript, extracted)
          VALUES (${matterId}, ${ctx.user_id}, 'form', ${narrative}, '{}'::jsonb)`;
      }

      const changed = {};
      for (const [col, key] of [['legal_name', 'client_legal_name'], ['email', 'client_email'],
        ['phone', 'client_phone'], ['address', 'client_address']]) {
        const now = String(values[key] || '').trim();
        if (now && now !== String(beforeRow?.[col] || '')) {
          changed[col] = { from: beforeRow?.[col] || null, to: now };
        }
      }

      await logEvent({
        firmId: ctx.firm_id, matterId, actorId: ctx.user_id,
        kind: 'matter_corrected',
        payload: { changed, notesReplaced: Boolean(narrative) },
      });

      return ok(res, { matterId, changed: Object.keys(changed) });
    }

    if (body.action === 'reassign' || body.action === 'grant' || body.action === 'revoke') {
      if (ctx.role !== 'owner') {
        return bad(res, 'Only the firm owner can change who sees a file', 403);
      }
      const matterId = Number(body.matterId);
      const userId = Number(body.userId);

      if (body.action === 'reassign') {
        const updated = await reassignMatter(ctx.firm_id, matterId, userId);
        if (!updated) return bad(res, 'Client not found', 404);
        await logEvent({
          firmId: ctx.firm_id, matterId, actorId: ctx.user_id,
          kind: 'matter_reassigned', payload: { userId },
        });
      } else if (body.action === 'grant') {
        await grantMatterAccess(matterId, userId, ctx.user_id);
        await logEvent({
          firmId: ctx.firm_id, matterId, actorId: ctx.user_id,
          kind: 'access_granted', payload: { userId },
        });
      } else {
        await revokeMatterAccess(matterId, userId);
        await logEvent({
          firmId: ctx.firm_id, matterId, actorId: ctx.user_id,
          kind: 'access_revoked', payload: { userId },
        });
      }

      return ok(res, { access: await listMatterAccess(matterId) });
    }

    if (body.action === 'close') {
      const matterId = Number(body.matterId);
      await setMatterStatus(ctx.firm_id, matterId, 'closed');
      await logEvent({
        firmId: ctx.firm_id, matterId, actorId: ctx.user_id, kind: 'matter_closed', payload: {},
      });
      return ok(res, { closed: true });
    }

    return bad(res, 'Unknown action');
  } catch (err) {
    return bad(res, err.message, 500);
  }
}
