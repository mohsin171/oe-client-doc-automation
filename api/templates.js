// Templates. Owner only for anything that writes.
import { sql } from '../lib/db.js';
import { listTemplates, getTemplate, logEvent } from '../lib/store.js';
import { ingestTemplate, summarise } from '../lib/ingest.js';
import { requireContext, canManageTemplates, ok, bad, readBody } from '../lib/context.js';

export default async function handler(req, res) {
  const ctx = await requireContext(req, res);
  if (!ctx) return;

  try {
    if (req.method === 'GET') {
      const { id } = req.query || {};
      if (id) {
        const t = await getTemplate(ctx.firm_id, Number(id));
        if (!t) return bad(res, 'Template not found', 404);
        return ok(res, { template: t, summary: summarise(t.definition || {}) });
      }
      const templates = await listTemplates(ctx.firm_id);
      return ok(res, {
        templates: templates.map((t) => ({ ...t, summary: summarise(t.definition || {}) })),
      });
    }

    if (req.method !== 'POST') return bad(res, 'Method not allowed', 405);

    const body = await readBody(req);
    const action = body.action || 'analyse';

    // Analyse only. Nothing is written, so a prospect on a call can watch the
    // split happen without anything being saved to their firm.
    if (action === 'analyse') {
      const result = await ingestTemplate({
        documentText: body.documentText,
        firmName: ctx.firm_name,
        hint: body.hint,
      });

      if (!result.ok) {
        const msg = result.reason === 'too_short'
          ? 'That looks too short to be a full document. Paste the whole letter.'
          : 'Could not read a template out of that document. Try pasting the plain text.';
        return bad(res, msg, 422);
      }

      return ok(res, {
        definition: result.definition,
        summary: summarise(result.definition),
      });
    }

    if (action === 'save') {
      if (!canManageTemplates(ctx.role)) {
        return bad(res, 'Only the firm owner can add templates', 403);
      }
      const def = body.definition;
      if (!def || !Array.isArray(def.blocks) || def.blocks.length === 0) {
        return bad(res, 'No template definition supplied');
      }

      const rows = await sql`
        INSERT INTO templates (firm_id, name, doc_type, version, definition)
        VALUES (${ctx.firm_id}, ${body.name || def.name || 'Untitled'},
                ${def.docType || 'document'}, 1, ${JSON.stringify(def)})
        RETURNING id, name, doc_type`;

      await logEvent({
        firmId: ctx.firm_id,
        actorId: ctx.user_id,
        kind: 'template_created',
        payload: { templateId: rows[0].id, name: rows[0].name, summary: summarise(def) },
      });

      return ok(res, { template: rows[0] });
    }

    return bad(res, 'Unknown action');
  } catch (err) {
    return bad(res, err.message, 500);
  }
}
