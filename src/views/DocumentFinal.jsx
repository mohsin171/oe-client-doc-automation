import React from 'react';
import { api } from '../api.js';
import FirmMark from './FirmMark.jsx';
import { layoutLetter, isFurniture } from '../../lib/letter.js';

// The letter as a letter.
//
// The working screen shows it as a structure, because that is what a reviewer
// needs: headings, marks on the drafted passages, a check against each problem.
// A client receives none of that. They receive a masthead, an address, a
// salutation, continuous prose, and a name at the bottom.
//
// The headings in particular have to go. They exist so a reviewer can find a
// clause and a flag can point at one. On the page they make an engagement letter
// look like a form.

export default function DocumentFinal({
  doc, version, firm, salutation, approvals, sender, busy,
  onSend, onIssue, onReopen, onBack,
}) {
  const branding = firm?.branding || {};
  const parts = layoutLetter(version?.blocks || []);
  const approval = approvals?.[0];
  const firmName = branding.letterhead || firm?.name || '';

  const dateText = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // Prose only. The salutation, subject and sign-off are placed by hand, and
  // the confidentiality marking sits above the address as it does on paper.
  const body = parts.body.filter((b) => String(b.body || '').trim());

  return (
    <div className="final">
      <div className="final-bar">
        <button className="back" onClick={onBack}>All documents</button>
        <span className={`badge ${doc.status}`}>{doc.status.replace(/_/g, ' ')}</span>
      </div>

      <article className="sheet">
        <div className="sheet-watermark" aria-hidden="true">
          <FirmMark branding={branding} name={firmName} size={420} />
        </div>

        <div className="sheet-inner">
          <header className="sheet-head">
            <FirmMark branding={branding} name={firmName} size={62} />
            <div className="sheet-firm">{firmName}</div>
          </header>

          {parts.confidential && (
            <p className="sheet-confidential">{String(parts.confidential.body).trim()}</p>
          )}

          <div className="sheet-meta">
            <div className="sheet-to">
              <div>{doc.client_name}</div>
              {doc.client_address && <div className="pre">{doc.client_address}</div>}
            </div>
            <div className="sheet-date">{dateText}</div>
          </div>

          <p className="sheet-salutation">
            {parts.salutation ? String(parts.salutation.body).trim().replace(/,$/, '') : `Dear ${salutation || doc.client_name}`}
          </p>

          {parts.subject && (
            <p className="sheet-subject">{String(parts.subject.body).trim()}</p>
          )}

          {/* A heading with nothing under it is dropped with the section it introduces.
              The same rule as the PDF, in lib/letter.js, so the screen and the download
              cannot disagree about what the letter says. */}
          {body
            .filter((b, i, all) => {
              const isHeading = (x) => x && x.kind === 'fixed'
                && String(x.body || '').trim().length > 0
                && String(x.body || '').trim().length < 60
                && !/[.;:,]$/.test(String(x.body || '').trim());
              if (isHeading(b)) {
                for (let j = i + 1; j < all.length; j += 1) {
                  if (isHeading(all[j])) break;
                  if (String(all[j].body || '').trim()) return true;
                }
                return false;
              }
              return String(b.body || '').trim().length > 0;
            })
            .map((b) => {
            const text = String(b.body).trim();
            const flat = text.replace(/\s+/g, ' ').toLowerCase();

            // Whatever the masthead and the address block already show is not shown
            // again. A firm whose own letters carry the letterhead has it among its
            // blocks, which is how a letter ended up with two of each. Matched on the
            // whole line, since testing for the firm's name inside a block would drop
            // the opening clause, which begins by naming the firm.
            const isLetterheadLine = flat.length < 140
              && flat.includes(firmName.toLowerCase())
              && (!branding.address || flat.includes(String(branding.address).toLowerCase()));
            if (isLetterheadLine) return null;

            // The recipient block sometimes carries the name and the address together.
            // Compared without punctuation: the block runs across three lines with no
            // commas while the record holds one, so a plain comparison missed it and the
            // recipient printed twice.
            const flatten = (x) => String(x || '').replace(/[\s,.]+/g, ' ').trim().toLowerCase();
            const clientName = flatten(doc.client_name);
            const clientAddr = flatten(doc.client_address);
            const flatNoPunct = flatten(text);
            if (flatNoPunct.length < 160 && clientName.length > 3
              && flatNoPunct.includes(clientName)
              && (!clientAddr || flatNoPunct.includes(clientAddr)
                || flatNoPunct === clientName)) return null;

            if (branding.address && flat === String(branding.address).trim().toLowerCase()) return null;
            if (flat.startsWith('our reference:')) return null;
            if (/^\d{1,2}\s+\w+\s+\d{4}$/.test(flat) || /^\d{4}-\d{2}-\d{2}$/.test(flat)) return null;

            // The close is set out below, so a signature block among the body gives
            // two of them.
            const senderName = String(sender?.name || '').trim().toLowerCase();
            if (senderName && flat.length < 90 && flat.includes(senderName)
              && flat.includes(firmName.toLowerCase())) return null;
            if (senderName && flat === senderName) return null;

            // A short invariant line is one of the firm's own headings, so it is set
            // as one. Nothing is derived from a block key.
            const isHeading = b.kind === 'fixed' && text.length < 60 && !/[.;:,]$/.test(text);
            if (isHeading) return <h3 className="sheet-heading" key={b.key}>{text}</h3>;

            return <p className="sheet-para" key={b.key}>{text}</p>;
          })}

          <div className="sheet-close">
            <div className="sheet-regards">
              {parts.signoff
                ? String(parts.signoff.body).trim().split(',')[0]
                : 'Yours sincerely'}
            </div>
            <div className="sheet-hand">{sender?.name || ''}</div>
            <div className="sheet-signame">
              <span className="sheet-firmline">{firmName}</span>
            </div>
          </div>
        </div>

        <footer className="sheet-foot">
          <span className="sheet-foot-accent" />
          <div className="sheet-contacts">
            {branding.phone && (
              <div><span className="ci">✆</span>{branding.phone}</div>
            )}
            {(branding.website || branding.email) && (
              <div>
                <span className="ci">✉</span>
                {branding.website && <span>{branding.website}</span>}
                {branding.email && <span>{branding.email}</span>}
              </div>
            )}
            {branding.address && (
              <div><span className="ci">⌖</span>{branding.address}</div>
            )}
          </div>
        </footer>
      </article>

      <footer className="final-foot">
        {approval && (
          <div className="signed">
            <strong>Signed off</strong>
            <div className="prov">
              {approval.approver_name} ·{' '}
              {new Date(approval.approved_at).toLocaleString('en-GB')}
            </div>
          </div>
        )}

        <div className="final-actions">
          <a className="btn-primary" href={api.downloadUrl(doc.id, 'pdf')}>Download PDF</a>
          <button className="btn" onClick={onSend}>Send to client</button>
          {doc.status === 'approved' && (
            <button className="btn" disabled={busy === 'issue'} onClick={onIssue}>
              Mark issued
            </button>
          )}
          <button className="btn-ghost" disabled={busy === 'reopen'} onClick={onReopen}>
            {doc.status === 'issued' ? 'Revise as a new version' : 'Back to make changes'}
          </button>
        </div>
      </footer>
    </div>
  );
}
