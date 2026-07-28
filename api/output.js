// Branded Word output.
//
// Only an approved or issued version can be downloaded. A draft cannot leave
// the building, and that is enforced here rather than by hiding a button.

import {
  Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle,
} from 'docx';
import { sql } from '../lib/db.js';
import { getCurrentVersion, getVersionById, logEvent, canSeeMatter } from '../lib/store.js';
import { requireContext, actorFor, bad } from '../lib/context.js';
import { renderLetterPdf } from '../lib/pdf.js';

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
  return parts.map(cap).join(' ');
}

export default async function handler(req, res) {
  const ctx = await requireContext(req, res);
  if (!ctx) return;

  try {
    const q = req.query || {};
    const versionId = q.versionId ? Number(q.versionId) : null;

    // A version asked for by id is a historical one: what a client received on a
    // particular day. It is served whatever the document says now, because the
    // point of keeping it is that it does not change.
    if (versionId) {
      const v = await getVersionById(ctx.firm_id, versionId);
      if (!v) return bad(res, 'That version was not found', 404);
      if (!(await canSeeMatter(ctx.firm_id, v.matter_id, actorFor(ctx)))) {
        return bad(res, 'That version was not found', 404);
      }

      const pdf = await renderLetterPdf({
        document: {
          reference: v.reference,
          doc_type: v.doc_type,
          client_name: v.client_name,
          client_address: v.client_address,
          client_signature: null,
          client_signed_on: null,
        },
        version: v,
        firm: { name: ctx.firm_name, branding: ctx.branding || {} },
        salutation: salutationFor(v.client_name),
        dateText: new Date(v.generated_at).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric',
        }),
      });

      await logEvent({
        firmId: ctx.firm_id, documentId: v.document_id, actorId: ctx.user_id,
        kind: 'sent_version_downloaded', payload: { version: v.version },
      });

      const name = `${v.doc_type}-${String(v.reference).replace(/\//g, '-')}-v${v.version}-as-sent.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      res.status(200).send(pdf);
      return;
    }

    const documentId = Number(q.documentId);
    if (!documentId) return bad(res, 'Supply documentId or versionId');

    const format = String(q.format || 'pdf').toLowerCase();

    const rows = await sql`
      SELECT d.*, m.reference, c.legal_name AS client_name, c.address AS client_address
      FROM documents d
      JOIN matters m ON m.id = d.matter_id
      JOIN clients c ON c.id = m.client_id
      WHERE d.firm_id = ${ctx.firm_id} AND d.id = ${documentId} LIMIT 1`;
    const document = rows[0];
    if (!document) return bad(res, 'Document not found', 404);
    // A download link is a URL. Without this, a restricted file is one guessed
    // id away from leaving the firm.
    if (!(await canSeeMatter(ctx.firm_id, document.matter_id, actorFor(ctx)))) {
      return bad(res, 'Document not found', 404);
    }

    if (!['approved', 'issued'].includes(document.status)) {
      return bad(res, 'This document has not been signed off yet. Only approved documents can be downloaded.', 409);
    }

    const version = await getCurrentVersion(ctx.firm_id, documentId);
    if (!version) return bad(res, 'No version found', 404);

    const branding = ctx.branding || {};
    const dateText = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const filenameBase = `${document.doc_type}-${document.reference.replace(/\//g, '-')}-v${version.version}`;

    if (format === 'pdf') {
      const pdf = await renderLetterPdf({
        document,
        version,
        firm: { name: ctx.firm_name, branding },
        salutation: salutationFor(document.client_name),
        dateText,
      });

      await logEvent({
        firmId: ctx.firm_id, documentId, actorId: ctx.user_id,
        kind: 'document_downloaded', payload: { version: version.version, format: 'pdf' },
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
      res.status(200).send(pdf);
      return;
    }

    const headingFont = branding.headingFont || 'Georgia';
    const bodyFont = branding.bodyFont || 'Arial';

    const children = [];

    // A firm's letterhead usually appears in every letter they issue, so it is
    // correctly detected as a standard clause and lives in the document body.
    // Adding our own on top prints it twice.
    const firmLabel = (branding.letterhead || ctx.firm_name || '').toLowerCase();
    const bodyText = (version.blocks || []).map((b) => (b.body || '')).join(' ').toLowerCase();
    const letterheadInBody = firmLabel.length > 3 && bodyText.includes(firmLabel);

    // Letterhead
    if (!letterheadInBody) children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({
        text: branding.letterhead || ctx.firm_name,
        font: headingFont, bold: true, size: 30,
      })],
    }));

    if (branding.address && !letterheadInBody) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '888888', space: 8 } },
        children: [new TextRun({ text: branding.address, font: bodyFont, size: 18, color: '555555' })],
      }));
    }

    // Same for the reference and date: if the template already places them,
    // printing them again is noise.
    const refInBody = bodyText.includes(String(document.reference).toLowerCase());
    if (!refInBody) {
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({
          text: `Our reference: ${document.reference}`, font: bodyFont, size: 18, color: '555555',
        })],
      }));
      children.push(new Paragraph({
        spacing: { after: 300 },
        children: [new TextRun({
          text: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
          font: bodyFont, size: 18, color: '555555',
        })],
      }));
    }

    // Body blocks, in template order
    for (const block of version.blocks || []) {
      const text = (block.body || '').trim();
      if (!text) continue;

      for (const para of text.split(/\n{2,}/)) {
        children.push(new Paragraph({
          spacing: { after: 200, line: 300 },
          children: [new TextRun({ text: para.trim(), font: bodyFont, size: 22 })],
        }));
      }
    }

    // Signature block
    if (branding.signatureBlock) {
      children.push(new Paragraph({
        spacing: { before: 400 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 8 } },
        children: [new TextRun({
          text: branding.signatureBlock, font: bodyFont, size: 16, color: '666666',
        })],
      }));
    }

    const doc = new Document({
      creator: ctx.firm_name,
      title: `${document.doc_type} ${document.reference}`,
      sections: [{
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    await logEvent({
      firmId: ctx.firm_id, documentId, actorId: ctx.user_id,
      kind: 'document_downloaded', payload: { version: version.version, format: 'docx' },
    });

    const filename = `${document.doc_type}-${document.reference.replace(/\//g, '-')}-v${version.version}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (err) {
    return bad(res, err.message, 500);
  }
}
