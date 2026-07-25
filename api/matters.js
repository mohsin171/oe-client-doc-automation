// Matters: the queue, matter opening, and field capture.
//
// The completeness gate lives here. A matter cannot leave 'incomplete' while a
// required field is missing or a captured number is unconfirmed.

import {
  listMatters, getMatter, createMatter, setMatterStatus,
  findOrCreateClient, getMatterFields, upsertMatterField, confirmMatterField,
  assessCompleteness, listTemplates, getMatterTimeline, listUsers, logEvent,
} from '../lib/store.js';
import { sql } from '../lib/db.js';
import { requireContext, ok, bad, readBody } from '../lib/context.js';
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
          templates: templates.map((t) => ({ id: t.id, name: t.name, doc_type: t.doc_type })),
          users: users.filter((u) => u.active),
          clients,
          me: { id: ctx.user_id, name: ctx.name },
        });
      }

      if (!id) {
        const matters = await listMatters(ctx.firm_id);
        const users = await listUsers(ctx.firm_id);
        return ok(res, { matters, users, me: {
          id: ctx.user_id, name: ctx.name, role: ctx.role, firm: ctx.firm_name,
        }});
      }

      const matter = await getMatter(ctx.firm_id, Number(id));
      if (!matter) return bad(res, 'Matter not found', 404);

      const fields = await getMatterFields(matter.id);
      const required = await requiredFor(ctx.firm_id, matter);
      const completeness = await assessCompleteness(matter.id, required);
      const templates = await listTemplates(ctx.firm_id);
      const timeline = view === 'full' ? await getMatterTimeline(ctx.firm_id, matter.id) : [];
      const users = (await listUsers(ctx.firm_id)).filter((u) => u.active);

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

      const matter = await createMatter(ctx.firm_id, {
        clientId: client.id,
        reference: ref,
        matterType,
        assignedUserId: body.assignedUserId || ctx.user_id,
      });

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
