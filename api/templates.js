// Templates. Owner only for anything that writes.
import { sql } from '../lib/db.js';
import { listTemplates, getTemplate, logEvent } from '../lib/store.js';
import { ingestTemplate, ingestCorpus, summarise } from '../lib/ingest.js';
import { groupByKind, describeGrouping } from '../lib/cluster.js';
import { requireContext, canManageTemplates, ok, bad, readBody } from '../lib/context.js';

export default async function handler(req, res) {
  const ctx = await requireContext(req, res);
  if (!ctx) return;

  try {
    if (req.method === 'GET') {
      const { id, corpusId, docType } = req.query || {};

      // Read one document in full.
      if (corpusId) {
        const rows = await sql`
          SELECT id, doc_type, section_key, body, created_at
          FROM precedents WHERE firm_id = ${ctx.firm_id} AND id = ${Number(corpusId)} LIMIT 1`;
        if (!rows[0]) return bad(res, 'Document not found', 404);
        return ok(res, { document: rows[0] });
      }

      // Everything on file, newest first, without hauling the full text over.
      if (docType !== undefined) {
        const rows = docType
          ? await sql`
              SELECT id, doc_type, section_key, length(body) AS chars, created_at
              FROM precedents WHERE firm_id = ${ctx.firm_id} AND doc_type = ${docType}
              ORDER BY created_at DESC, id DESC`
          : await sql`
              SELECT id, doc_type, section_key, length(body) AS chars, created_at
              FROM precedents WHERE firm_id = ${ctx.firm_id}
              ORDER BY created_at DESC, id DESC`;
        return ok(res, { documents: rows });
      }

      if (id) {
        const t = await getTemplate(ctx.firm_id, Number(id));
        if (!t) return bad(res, 'Template not found', 404);
        return ok(res, { template: t, summary: summarise(t.definition || {}) });
      }
      const templates = await listTemplates(ctx.firm_id);
      const corpus = await sql`
        SELECT doc_type, count(*)::int AS n FROM precedents
        WHERE firm_id = ${ctx.firm_id} GROUP BY doc_type`;
      return ok(res, {
        templates: templates.map((t) => ({ ...t, summary: summarise(t.definition || {}) })),
        corpus,
      });
    }

    if (req.method !== 'POST') return bad(res, 'Method not allowed', 405);

    const body = await readBody(req);
    const action = body.action || 'analyse';

    // Analyse only. Nothing is written, so a prospect on a call can watch the
    // split happen without a single row being saved to their firm.
    if (action === 'analyse') {
      const documents = Array.isArray(body.documents) && body.documents.length
        ? body.documents
        : (body.documentText ? [{ name: 'pasted', text: body.documentText }] : []);

      if (documents.length === 0) return bad(res, 'No documents supplied');

      // Sort the pile into kinds before counting anything.
      //
      // A firm hands over its correspondence folder: engagement letters, status updates,
      // chases, completions, closing letters, unsorted, because why would they sort it.
      // The counting that finds a firm's standard clauses compares like with like, and
      // given a hundred and forty letters of seven kinds it found four standard clauses
      // and produced one useless template. Telling the firm to upload one kind at a time
      // is not an answer, it is asking them to do the work.
      const grouped = groupByKind(documents);

      if (grouped.groups.length === 0) {
        return bad(res, 'Those files look too short, or too few of one kind, to count from. '
          + 'Three or more letters of the same kind are needed.', 422);
      }

      // One structure per kind. Each is analysed on its own group, which is what makes
      // the counting mean anything.
      const structures = [];
      for (const group of grouped.groups) {
        const result = await ingestCorpus({
          documents: group.documents,
          firmName: ctx.firm_name,
          hint: body.hint,
        });
        if (!result.ok) continue;
        structures.push({
          definition: result.definition,
          summary: summarise(result.definition),
          corpus: result.corpus,
          documents: group.documents,
          size: group.size,
        });
      }

      if (structures.length === 0) {
        return bad(res, 'Could not read a structure out of those documents. Plain text '
          + 'works best.', 422);
      }

      return ok(res, {
        // The first is returned on its own as well, so anything expecting a single
        // structure keeps working rather than breaking on a shape it has not seen.
        definition: structures[0].definition,
        summary: structures[0].summary,
        corpus: structures[0].corpus,
        structures,
        grouping: describeGrouping(grouped),
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

      // Keep every uploaded document. The structure is only half of what they
      // are worth: the pile itself is what later drafting is grounded on, so
      // the output reads like this firm rather than like generic legal prose.
      // Re-analysing a corpus is normal: the structure gets better, the
      // documents do not change. Storing them again would double the pile and
      // skew the counting that the whole approach rests on.
      let stored = 0;
      let alreadyHeld = 0;
      for (const d of (body.documents || [])) {
        const text = String(d?.text || '').trim();
        if (text.length < 120) continue;
        const key = `corpus:${String(d.name || 'upload').slice(0, 80)}`;

        const existing = await sql`
          SELECT id FROM precedents
          WHERE firm_id = ${ctx.firm_id} AND section_key = ${key} LIMIT 1`;
        if (existing[0]) { alreadyHeld += 1; continue; }

        await sql`
          INSERT INTO precedents (firm_id, doc_type, section_key, body)
          VALUES (${ctx.firm_id}, ${def.docType || 'document'}, ${key}, ${text})`;
        stored += 1;
      }

      await logEvent({
        firmId: ctx.firm_id,
        actorId: ctx.user_id,
        kind: 'template_created',
        payload: {
          templateId: rows[0].id, name: rows[0].name,
          summary: summarise(def), documentsStored: stored, alreadyHeld,
        },
      });

      return ok(res, { template: rows[0], stored, alreadyHeld });
    }

    if (action === 'delete_document') {
      if (!canManageTemplates(ctx.role)) {
        return bad(res, 'Only the firm owner can remove documents', 403);
      }
      const rows = await sql`
        DELETE FROM precedents
        WHERE firm_id = ${ctx.firm_id} AND id = ${Number(body.corpusId)}
        RETURNING section_key, doc_type`;
      if (!rows[0]) return bad(res, 'Document not found', 404);

      await logEvent({
        firmId: ctx.firm_id, actorId: ctx.user_id,
        kind: 'corpus_document_removed',
        payload: { name: rows[0].section_key, docType: rows[0].doc_type },
      });

      // Removing a document changes what the corpus proves, so say so plainly
      // rather than letting the derived structure quietly go stale.
      const left = await sql`
        SELECT count(*)::int AS n FROM precedents
        WHERE firm_id = ${ctx.firm_id} AND doc_type = ${rows[0].doc_type}`;
      return ok(res, { removed: rows[0].section_key, remaining: left[0]?.n || 0 });
    }

    // Clearing everything is a different act from removing one document, so it
    // asks for the number back as confirmation. A stray click cannot wipe a
    // firm's corpus, but a deliberate one takes a single step.
    if (action === 'clear_documents') {
      if (!canManageTemplates(ctx.role)) {
        return bad(res, 'Only the firm owner can clear documents', 403);
      }

      const scope = body.docType
        ? await sql`SELECT count(*)::int AS n FROM precedents
                    WHERE firm_id = ${ctx.firm_id} AND doc_type = ${body.docType}`
        : await sql`SELECT count(*)::int AS n FROM precedents WHERE firm_id = ${ctx.firm_id}`;
      const expected = scope[0]?.n || 0;

      if (Number(body.confirmCount) !== expected) {
        return bad(res, `That would remove ${expected} documents. Confirm the number to continue.`, 409);
      }

      const rows = body.docType
        ? await sql`DELETE FROM precedents
                    WHERE firm_id = ${ctx.firm_id} AND doc_type = ${body.docType} RETURNING id`
        : await sql`DELETE FROM precedents WHERE firm_id = ${ctx.firm_id} RETURNING id`;

      await logEvent({
        firmId: ctx.firm_id, actorId: ctx.user_id,
        kind: 'corpus_cleared',
        payload: { removed: rows.length, docType: body.docType || 'all' },
      });

      return ok(res, { removed: rows.length });
    }

    if (action === 'delete_template') {
      if (!canManageTemplates(ctx.role)) {
        return bad(res, 'Only the firm owner can remove a structure', 403);
      }
      const rows = await sql`
        DELETE FROM templates WHERE firm_id = ${ctx.firm_id} AND id = ${Number(body.templateId)}
        RETURNING name`;
      if (!rows[0]) return bad(res, 'Not found', 404);
      await logEvent({
        firmId: ctx.firm_id, actorId: ctx.user_id,
        kind: 'template_removed', payload: { name: rows[0].name },
      });
      return ok(res, { removed: rows[0].name });
    }

    return bad(res, 'Unknown action');
  } catch (err) {
    return bad(res, err.message, 500);
  }
}
