// PDF output.
//
// Built with pdf-lib and the standard Times faces rather than by converting a
// Word file, because LibreOffice cannot run on a serverless function and
// shelling out to a converter would mean a second service to keep alive.
//
// The layout deliberately mirrors what the fee earner saw on screen. If the
// letter they approved and the letter that arrives are laid out differently,
// the approval starts to mean less than it should.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { layoutLetter } from './letter.js';

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

export async function renderLetterPdf({ document: doc, version, firm, salutation, dateText, sender }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const body = await pdf.embedFont(StandardFonts.TimesRoman);

  // The same signature face the screen uses, read from the repo rather than
  // fetched, so the download and the preview show the same mark.
  let script = null;
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    script = await pdf.embedFont(readFileSync(path.join(here, '..', 'assets', 'allura.ttf')));
  } catch (_) {
    // A missing font file should not cost the firm its letter.
    script = null;
  }
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

  // Letterhead. If the firm's own letters carry it, it is already among the blocks
  // and printing it again gives every letter two.
  const firmName = branding.letterhead || firm?.name || '';
  const bodyText = (version?.blocks || []).map((b) => String(b.body || '')).join(' ').toLowerCase();
  const headInBody = firmName.length > 3 && bodyText.includes(firmName.toLowerCase());
  const recipientInBody = String(doc.client_name || '').length > 3
    && bodyText.includes(String(doc.client_name).toLowerCase());

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

    // Anything already printed above is not printed again. A firm whose letters
    // carry the letterhead and the recipient has them among its own blocks, which is
    // how one letter ended up with two of each.
    // Matched on the whole line, not on a substring. Testing whether a block
    // contains the firm's name dropped the opening clause, because it begins
    // "Thank you for instructing Harrow & Fenn Solicitors": any clause naming the
    // firm would have disappeared.
    const flat = text.replace(/\s+/g, ' ').trim().toLowerCase();
    const isLetterheadLine = flat.length < 140
      && headInBody
      && flat.includes(firmName.toLowerCase())
      && (!branding.address || flat.includes(String(branding.address).toLowerCase()));

    // The recipient block is sometimes one block carrying the name and the address
    // together, so equality against either alone missed it.
    const clientName = String(doc.client_name || '').trim().toLowerCase();
    const clientAddr = String(doc.client_address || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const isRecipientBlock = flat.length < 160 && clientName.length > 3
      && flat.includes(clientName)
      && (!clientAddr || flat.includes(clientAddr) || flat === clientName);

    const already = isLetterheadLine
      || isRecipientBlock
      || (branding.address && flat === String(branding.address).trim().toLowerCase())
      || flat.startsWith('our reference:')
      || flat === dateText.toLowerCase()
      || /^\d{1,2}\s+\w+\s+\d{4}$/.test(flat)
      || /^\d{4}-\d{2}-\d{2}$/.test(flat);
    if (already) continue;

    // A short invariant line is one of the firm's own headings, so it is set as one.
    // Anything longer is a clause and is set as prose. Nothing is invented: a heading
    // derived from a block key gave every section two, the firm's own and a made-up
    // one underneath it.
    const isHeading = block.kind === 'fixed' && text.length < 60 && !/[.;:,]$/.test(text);
    if (isHeading) {
      room(30);
      y -= 8;
      write(text, { font: bold, size: 11.5, gap: 5 });
      y -= 2;
      continue;
    }

    write(text, { size: 10.5, gap: 4.5 });
    y -= 12;
  }

  // The close is the firm signing its own letter: the fee earner's name in the
  // signature face, then printed, then the firm.
  const closeLine = parts.signoff
    ? String(parts.signoff.body).trim().split(',')[0]
    : 'Yours sincerely';
  y -= 14;
  write(closeLine, { size: 10.5, gap: 6 });

  if (sender?.name) {
    room(62);
    y -= 12;
    // The same face the screen uses, so the download and the preview close the
    // same way.
    if (script) {
      page.drawText(String(sender.name), {
        x: MARGIN + 2, y: y - 26, size: 25, font: script, color: INK,
      });
      y -= 40;
    } else {
      write(String(sender.name), { font: bold, size: 11, gap: 4 });
    }
    write(branding.letterhead || firm?.name || '', { size: 9.5, colour: MUTED, gap: 4 });
  }

  // Where the client signs, if the letter asks them to.
  room(150);
  y -= 18;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: width - MARGIN, y },
    thickness: 0.6, color: rgb(0.8, 0.84, 0.88),
  });
  y -= 26;

  page.drawText('Signature', { x: MARGIN, y: y - 10, size: 9.5, font: sans, color: INK });
  page.drawText('Date signed', { x: MARGIN + 300, y: y - 10, size: 9.5, font: sans, color: INK });
  y -= 68;

  // What was recorded, if anything. Left empty the lines print blank, so the
  // letter can still be signed by hand.
  if (doc.client_signature) {
    const face = script || await pdf.embedFont(StandardFonts.TimesRomanItalic);
    page.drawText(String(doc.client_signature), {
      x: MARGIN + 4, y: y + 6, size: script ? 26 : 17, font: face, color: INK,
    });
  }
  if (doc.client_signed_on) {
    const when = new Date(doc.client_signed_on).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    page.drawText(when, { x: MARGIN + 304, y: y + 8, size: 10.5, font: body, color: INK });
  }
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: MARGIN + 250, y },
    thickness: 0.6, color: rgb(0.72, 0.77, 0.83),
  });
  page.drawLine({
    start: { x: MARGIN + 300, y }, end: { x: MARGIN + 470, y },
    thickness: 0.6, color: rgb(0.72, 0.77, 0.83),
  });

  // Firm footer on every page, since a loose page should still identify itself.
  const footer = branding.signatureBlock || firmName;
  for (const p of pdf.getPages()) {
    p.drawText(footer, { x: MARGIN, y: 36, size: 7.5, font: sans, color: MUTED });
  }

  return Buffer.from(await pdf.save());
}
