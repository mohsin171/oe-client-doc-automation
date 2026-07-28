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

          {body.map((b) => (
            <p className={isFurniture(b) ? 'sheet-para tight' : 'sheet-para'} key={b.key}>
              {b.body}
            </p>
          ))}

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
