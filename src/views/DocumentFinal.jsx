import React from 'react';
import { api } from '../api.js';
import FirmMark from './FirmMark.jsx';
import { layoutLetter, isFurniture, headingFor } from '../../lib/letter.js';

// A separate screen, reached only by signing off.
//
// The working screen has checks, edit controls, a confirmation and marks showing
// which passages the model wrote. None of that is the letter. This is what the
// client receives, and seeing it without the apparatus is the last chance to
// notice something wrong.
//
// Going back is possible and is deliberately not free: it reopens the letter and
// the sign-off has to be given again, because the text approved and the text sent
// must be the same text.

export default function DocumentFinal({
  doc, version, firm, salutation, approvals, busy,
  onDownload, onSend, onIssue, onReopen, onBack,
}) {
  const branding = firm?.branding || {};
  const parts = layoutLetter(version?.blocks || []);
  const approval = approvals?.[0];

  const dateText = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const ordered = [
    parts.confidential, parts.salutation, parts.subject, ...parts.body, parts.signoff,
  ].filter(Boolean);

  return (
    <div className="final">
      <div className="final-bar">
        <button className="back" onClick={onBack}>All documents</button>
        <span className={`badge ${doc.status}`}>{doc.status.replace(/_/g, ' ')}</span>
      </div>

      <article className="letter final-letter">
        <header className="letter-head">
          <div className="letter-brand">
            <FirmMark branding={branding} name={firm?.name || ''} size={52} />
            <div>
              <div className="letter-firm">{branding.letterhead || firm?.name}</div>
              {branding.address && <div className="letter-address">{branding.address}</div>}
            </div>
          </div>
          <div className="letter-meta">
            <div>Our reference: {doc.reference}</div>
            <div>{dateText}</div>
          </div>
        </header>

        {parts.confidential && (
          <p className="letter-confidential">{String(parts.confidential.body).trim()}</p>
        )}

        <div className="letter-recipient">
          <div>{doc.client_name}</div>
          {doc.client_address && <div className="pre">{doc.client_address}</div>}
        </div>

        {!parts.salutation && (
          <p className="letter-salutation">Dear {salutation || doc.client_name},</p>
        )}

        {ordered
          .filter((b) => b !== parts.confidential)
          .map((b) => (
            <section className="letter-section" key={b.key}>
              {!isFurniture(b) && <h3>{headingFor(b)}</h3>}
              <p
                className={b === parts.subject ? 'letter-subject' : 'letter-body'}
              >
                {b.body}
              </p>
            </section>
          ))}

        <div className="letter-sign">
          <div className="sign-grid">
            <div>
              <label className="sig-label">Signature</label>
              <div className="sig-pad"><span className="sig-rule" /></div>
            </div>
            <div>
              <label className="sig-label">Date signed</label>
              <div className="sig-pad short"><span className="sig-rule" /></div>
            </div>
          </div>
        </div>
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
          <a className="btn-primary" href={api.downloadUrl(doc.id, 'pdf')} onClick={onDownload}>
            Download PDF
          </a>
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
