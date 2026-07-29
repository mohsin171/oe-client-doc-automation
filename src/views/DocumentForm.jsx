import React, { useState } from 'react';
import { api } from '../api.js';
import FirmMark from './FirmMark.jsx';
import { layoutLetter, isFurniture, headingFor } from '../../lib/letter.js';

// The generated letter as a form the client works through, rather than a page
// of prose. Two tabs, sections with an acknowledgement against each, a
// signature at the foot.
//
// The reason for a tick per section rather than one signature at the end: if a
// client later says nobody explained the fee cap, a tick against that clause
// answers it. A signature on page six does not.

export default function DocumentForm({
  doc, version, firm, salutation, flags, approvals, me, groundedOn = [],
  standingInstructions = '',
  busy, editing, editText, setEditing, setEditText,
  onEditSave, onResolve, onDismiss, dismissing, setDismissing, reason, setReason,
  onApprove, onBack, onDelete,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState('agreement');
  // One deliberate confirmation before sign-off, rather than a tick against
  // every clause. The per-clause version read as though the fee earner were
  // agreeing to their own firm's terms, which is not what is happening: they
  // are confirming they have read what they are about to put their name to.
  const [confirmed, setConfirmed] = useState(false);

  const branding = firm?.branding || {};
  const parts = layoutLetter(version?.blocks || []);
  const open = (flags || []).filter((f) => f.status === 'open');
  const blocking = open.filter((f) => f.severity === 'blocking');
  const flagged = new Set(open.map((f) => f.anchor));

  const sections = parts.body.filter((b) => !isFurniture(b));

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const TABS = [
    { key: 'client', label: 'Client information' },
    { key: 'agreement', label: 'Agreement details' },
  ];

  return (
    <div className="doc-form">
      <header className="df-head">
        <div className="df-brand">
          <FirmMark branding={branding} name={firm?.name || ''} size={54} />
          <div>
            <div className="df-firm">{branding.letterhead || firm?.name}</div>
            {branding.address && <div className="df-address">{branding.address}</div>}
          </div>
        </div>
        <h1 className="df-title">
          {headingFor({ key: doc.doc_type })}
          <span>{doc.reference} · version {version?.version}</span>
        </h1>
      </header>

      <nav className="df-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'df-tab on' : 'df-tab'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'client' && (
        <div className="df-body">
          <section className="df-section">
            <h2>Who this letter is for</h2>
            <p className="df-note">
              Taken from the client record. Change it there and regenerate if
              anything is wrong.
            </p>
            <div className="df-kv">
              <div><span>Client</span><strong>{doc.client_name}</strong></div>
              {doc.client_address && (
                <div><span>Address</span><strong className="pre">{doc.client_address}</strong></div>
              )}
              {doc.client_email && <div><span>Email</span><strong>{doc.client_email}</strong></div>}
              <div><span>Reference</span><strong>{doc.reference}</strong></div>
              <div><span>Matter</span><strong>{doc.matter_type}</strong></div>
              <div><span>Dated</span><strong>{today}</strong></div>
              <div><span>Addressed as</span><strong>Dear {salutation || doc.client_name},</strong></div>
            </div>
          </section>
        </div>
      )}

      {tab === 'agreement' && (
        <div className="df-body">
          {open.length > 0 && (
            <div className="df-checks">
              <div className="box-title">
                {blocking.length > 0
                  ? `${blocking.length} to resolve before sign-off`
                  : `${open.length} worth a look`}
              </div>
              {open.map((f) => (
                <div key={f.id} className={`check check-${f.severity}`}>
                  <div className="check-row">
                  <div className="check-main">
                    <div className="flag-head">
                      <span className={`badge ${f.severity}`}>{f.severity}</span>
                      {f.anchor && <span className="flag-anchor">{headingFor({ key: f.anchor })}</span>}
                    </div>
                    <p className="flag-msg">{f.message}</p>
                    {dismissing === f.id && (
                      <div className="dismiss-box">
                        <input
                          placeholder="Why is this not a problem?"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <button className="btn btn-sm" disabled={!reason.trim()} onClick={() => onDismiss(f.id)}>
                          Record
                        </button>
                      </div>
                    )}
                  </div>
                  {dismissing !== f.id && (
                    <div className="check-side">
                      {f.fixIn && parts.body.some((b) => b.key === f.fixIn) && (
                        <button
                          className="btn btn-sm"
                          onClick={() => {
                            const target = parts.body.find((b) => b.key === f.fixIn);
                            setEditing(target.key);
                            setEditText(target.body || '');
                            requestAnimationFrame(() => {
                              window.document
                                .getElementById(`section-${target.key}`)
                                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            });
                          }}
                        >
                          Fix {headingFor({ key: f.fixIn })}
                        </button>
                      )}
                      <button className="btn-ghost" onClick={() => setDismissing(f.id)}>Dismiss</button>
                    </div>
                  )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {parts.subject && (
            <p className="df-subject">{String(parts.subject.body).trim()}</p>
          )}

          {standingInstructions && (
            <div className="notice info instruction">
              <strong>The client asked:</strong> {standingInstructions}
              <span className="prov">
                Check the letter honours this. It is the one thing a client will notice
                being ignored.
              </span>
            </div>
          )}

          {groundedOn.length > 0 && (
            <details className="grounding">
              <summary>
                Drafted from {groundedOn.length} of your own letters
                {groundedOn.some((g) => !g.matched) && ' (some chosen by date)'}
              </summary>
              <ul>
                {groundedOn.map((g) => (
                  <li key={g.name}>
                    {g.name}
                    {!g.matched && <em>nearest by date</em>}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {sections.map((b) => (
            <section
              id={`section-${b.key}`}
              className={`df-section${flagged.has(b.key) ? ' flagged' : ''}`}
              key={b.key}
            >
              <div className="df-section-head">
                <h2>{headingFor(b)}</h2>
                <div className="df-marks">
                  {b.kind === 'bespoke' && <span className="mark-ai">written for this matter</span>}
                  {b.amended && <span className="mark-amended">standard clause changed</span>}
                  {editing !== b.key && (
                    <button
                      className="btn-ghost"
                      onClick={() => { setEditing(b.key); setEditText(b.body || ''); }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {editing === b.key ? (
                <>
                  <textarea rows={7} value={editText} onChange={(e) => setEditText(e.target.value)} />
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button className="btn btn-sm" disabled={busy === 'edit'} onClick={() => onEditSave(b.key)}>
                      Save
                    </button>
                    <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <blockquote className="df-clause">{b.body}</blockquote>
              )}

            </section>
          ))}

          <section className="df-section df-confirm">
              <label className={confirmed ? 'ack on' : 'ack'}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span className="ack-box" aria-hidden="true" />
                <span className="ack-text">
                  I have read this letter in full and confirm it is correct to send.
                </span>
              </label>
          </section>

        </div>
      )}

      <footer className="df-foot">
        <button className="btn" onClick={onBack}>Back</button>

        {confirmDelete ? (
          <>
            <span className="prov">Delete this draft? Nothing has been sent from it.</span>
            <button className="btn danger btn-sm" disabled={busy === 'delete'} onClick={onDelete}>
              {busy === 'delete' ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </>
        ) : (
          <button className="btn-ghost" onClick={() => setConfirmDelete(true)}>Delete draft</button>
        )}

        {me?.canApprove ? (
          <div className="df-foot-right">
            {blocking.length > 0 ? (
              <span className="prov">{blocking.length} to clear first</span>
            ) : !confirmed ? (
              <span className="prov">Confirm you have read it, above</span>
            ) : null}
            <button
              className="btn-primary"
              disabled={busy === 'approve' || blocking.length > 0 || !confirmed}
              onClick={onApprove}
            >
              {busy === 'approve' ? 'Recording…' : 'Sign off'}
            </button>
          </div>
        ) : (
          <span className="prov">Your role cannot sign off. Ask the firm owner.</span>
        )}
      </footer>
    </div>
  );
}
