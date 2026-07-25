// Matters: the queue, matter opening, and field capture.
//
// The completeness gate lives here. A matter cannot leave 'incomplete' while a
// required field is missing or a captured number is unconfirmed.

import {
  listMatters, getMatter, createMatter, setMatterStatus,
  findOrCreateClient, getMatterFields, upsertMatterField, confirmMatterField,
  assessCompleteness, listTemplates, getMatterTimeline, listUsers, logEvent,
} from '../lib/store.js';
import { requireContext, ok, bad, readBody } from '../lib/context.js';

// Fields every matter needs regardless of document type. Template required
// fields are unioned on top of these when a specific document is generated.
const CORE_FIELDS = ['client_legal_name', 'matter_type', 'fee_earner_name'];

// Anything that looks like money, a rate, or a count is treated as numeric and
// always requires explicit confirmation. Dictation mishears figures, and sixty
// against sixteen in a fee clause ends a client relationship.
function looksNumeric(key, value) {
  if (/rate|fee|amount|price|cost|hours|total|estimate|cap|percent/i.test(key)) return true;
  return /^[£$€]?\s*[\d,]+(\.\d+)?\s*%?$/.test(String(value).trim());
}

async function requiredFor(firmId, matter) {
  const templates = await listTemplates(firmId);
  const set = new Set(CORE_FIELDS);
  for (const t of templates) {
    if (matter && t.doc_type && matter.matter_type && t.doc_type !== matter.matter_type) continue;
    for (const f of (t.definition?.requiredFields || [])) set.add(f);
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

      return ok(res, { matter, fields, required, completeness, templates, timeline });
    }

    if (!['POST', 'PATCH'].includes(req.method)) return bad(res, 'Method not allowed', 405);

    const body = await readBody(req);

    // ---------------- Create a matter ----------------
    if (req.method === 'POST' && (body.action || 'create') === 'create') {
      const { clientLegalName, clientEmail, clientAddress, matterType, reference } = body;
      if (!clientLegalName || !matterType) {
        return bad(res, 'Client legal name and matter type are both required');
      }

      const client = await findOrCreateClient(ctx.firm_id, {
        legalName: clientLegalName,
        email: clientEmail,
        address: clientAddress,
      });

      const ref = reference || `${new Date().getFullYear()}/${Date.now().toString().slice(-5)}`;

      const matter = await createMatter(ctx.firm_id, {
        clientId: client.id,
        reference: ref,
        matterType,
        assignedUserId: body.assignedUserId || ctx.user_id,
      });

      // Seed the fields we already know from the form half. Note that nothing
      // is inferred here: every value written came from a person typing it.
      const seedFields = [
        { key: 'client_legal_name', value: clientLegalName },
        { key: 'matter_type', value: matterType },
        { key: 'fee_earner_name', value: body.assignedName || ctx.name },
        { key: 'client_address', value: clientAddress },
        { key: 'client_email', value: clientEmail },
      ];
      for (const f of seedFields) {
        await upsertMatterField(matter.id, {
          key: f.key,
          value: f.value,
          source: 'form',
          provenance: 'Entered on the matter opening form',
          confidence: 1,
          isNumeric: false,
        });
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

    // ---------------- Capture or correct fields ----------------
    if (body.action === 'fields') {
      const matterId = Number(body.matterId);
      const matter = await getMatter(ctx.firm_id, matterId);
      if (!matter) return bad(res, 'Matter not found', 404);

      for (const [key, value] of Object.entries(body.values || {})) {
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
