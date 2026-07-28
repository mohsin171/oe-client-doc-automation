// PDF output.
//
// Built with pdf-lib and the standard Times faces rather than by converting a
// Word file, because LibreOffice cannot run on a serverless function and
// shelling out to a converter would mean a second service to keep alive.
//
// The layout deliberately mirrors what the fee earner saw on screen. If the
// letter they approved and the letter that arrives are laid out differently,
// the approval starts to mean less than it should.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { layoutLetter, isFurniture, headingFor } from './letter.js';

const A4 = [595.28, 841.89];
const MARGIN = 64;
const INK = rgb(0.08, 0.13, 0.18);
const MUTED = rgb(0.4, 0.45, 0.52);
const RULE = rgb(0.1, 0.14, 0.2);

function wrap(text, font, size, maxWidth) {
  const lines = [];
  for (const paragraph of String(text || '').split(/\n/)) {
    if (!paragraph.trim()) { lines.push(''); continue; }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function renderLetterPdf({ document: doc, version, firm, salutation, dateText }) {
  const pdf = await PDFDocument.create();
  const body = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);

  const branding = firm?.branding || {};
  const width = A4[0];
  const contentWidth = width - MARGIN * 2;

  let page = pdf.addPage(A4);
  let y = A4[1] - MARGIN;

  const room = (needed) => {
    if (y - needed >= MARGIN + 40) return;
    page = pdf.addPage(A4);
    y = A4[1] - MARGIN;
  };

  const write = (text, { font = body, size = 10.5, colour = INK, gap = 4, x = MARGIN } = {}) => {
    const lines = wrap(text, font, size, contentWidth - (x - MARGIN));
    for (const line of lines) {
      room(size + gap);
      if (line) page.drawText(line, { x, y: y - size, size, font, color: colour });
      y -= size + gap;
    }
  };

  // Letterhead
  const firmName = branding.letterhead || firm?.name || '';
  page.drawText(firmName, { x: MARGIN, y: y - 16, size: 16, font: bold, color: INK });
  if (branding.address) {
    page.drawText(branding.address, { x: MARGIN, y: y - 31, size: 9, font: sans, color: MUTED });
  }

  const refText = `Our reference: ${doc.reference}`;
  const refWidth = sans.widthOfTextAtSize(refText, 9);
  const dateWidth = sans.widthOfTextAtSize(dateText, 9);
  page.drawText(refText, { x: width - MARGIN - refWidth, y: y - 16, size: 9, font: sans, color: MUTED });
  page.drawText(dateText, { x: width - MARGIN - dateWidth, y: y - 30, size: 9, font: sans, color: MUTED });

  y -= 48;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: width - MARGIN, y },
    thickness: 1.4, color: RULE,
  });
  y -= 26;

  const parts = layoutLetter(version?.blocks || []);

  // A confidentiality marking sits above everything, as it does on paper.
  if (parts.confidential) {
    write(String(parts.confidential.body).trim(), { font: bold, size: 10, gap: 4 });
    y -= 12;
  }

  // Recipient
  write(doc.client_name, { size: 10.5, gap: 3 });
  if (doc.client_address) write(doc.client_address, { size: 10.5, gap: 3 });
  y -= 16;

  write(parts.salutation ? String(parts.salutation.body).trim()
    : `Dear ${salutation || doc.client_name},`, { size: 10.5, gap: 6 });
  y -= 10;

  if (parts.subject) {
    write(String(parts.subject.body).trim(), { font: bold, size: 11, gap: 5 });
    y -= 10;
  }

  for (const block of parts.body) {
    const text = String(block.body).trim();
    if (!isFurniture(block)) {
      room(28);
      y -= 6;
      write(headingFor(block), { font: bold, size: 11.5, gap: 5 });
      y -= 2;
    }
    write(text, { size: 10.5, gap: 4.5 });
    y -= isFurniture(block) ? 8 : 12;
  }

  if (parts.signoff) {
    y -= 10;
    write(String(parts.signoff.body).trim(), { size: 10.5, gap: 4.5 });
  }

  // Signature block
  room(150);
  y -= 18;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: width - MARGIN, y },
    thickness: 0.6, color: rgb(0.8, 0.84, 0.88),
  });
  y -= 26;

  page.drawText('Client', { x: MARGIN, y: y - 10, size: 9.5, font: sans, color: INK });
  page.drawText('Date signed', { x: MARGIN + 300, y: y - 10, size: 9.5, font: sans, color: INK });
  y -= 68;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: MARGIN + 250, y },
    thickness: 0.6, color: rgb(0.72, 0.77, 0.83),
  });
  page.drawLine({
    start: { x: MARGIN + 300, y }, end: { x: MARGIN + 470, y },
    thickness: 0.6, color: rgb(0.72, 0.77, 0.83),
  });
  y -= 30;
  page.drawText('Print name', { x: MARGIN, y: y - 10, size: 9.5, font: sans, color: INK });
  y -= 40;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: MARGIN + 250, y },
    thickness: 0.6, color: rgb(0.72, 0.77, 0.83),
  });

  // Firm footer on every page, since a loose page should still identify itself.
  const footer = branding.signatureBlock || firmName;
  for (const p of pdf.getPages()) {
    p.drawText(footer, { x: MARGIN, y: 36, size: 7.5, font: sans, color: MUTED });
  }

  return Buffer.from(await pdf.save());
}
