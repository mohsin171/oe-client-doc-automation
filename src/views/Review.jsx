import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import FirmMark from './FirmMark.jsx';

// One view: the letter as the client will read it, with the review beside it.
//
// There used to be two, a technical block listing and a letter preview. The
// block listing labelled every paragraph MERGED FROM THE MATTER RECORD or
// STANDARD CLAUSE, which is how the engine thinks rather than how a fee earner
// reads. Nobody signs off a list of blocks; they sign off a letter.
//
// One thing from it was worth keeping. A reviewer has to know which passages
// the model wrote, because that is where attention belongs and it is why
// sign-off means anything. That marking survives, quietly, on the drafted
// sections only.

const LABEL = (k) => String(k || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function isFurniture(block) {
  const body = String(block.body || '').trim();
  if (!body || body.length < 120) return true;
  return /^(dear|yours|our reference|private and confidential|re:)/i.test(body);
}

export default function Review({ documentId, onBack }) {
  const [state, setState] = useState({ loading: true });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState('');
  const [dismissing, setDismissing] = useState(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  async function load() {
    try { setState({ loading: false, ...(await api.getDocument(documentId)) }); }
    catch (e) { setState({ loading: false, error: e.message }); }
  }
  useEffect(() => { load(); }, [documentId]);

  if (state.loading) return <p className="muted">Loading…</p>;
  if (state.error) return <div className="notice err">{state.error}</div>;

  const {
    document: doc, version, flags = [], approvals = [], me, firm, salutation,
  } = state;

  const branding = firm?.branding || {};
  const blocks = (version?.blocks || []).filter((b) => String(b.body || '').trim());
  const open = flags.filter((f) => f.status === 'open');
  const blocking = open.filter((f) => f.severity === 'blocking');
  const locked = ['approved', 'issued'].includes(doc.status);
  const flagged = new Set(flags.filter((f) => f.status === 'open').map((f) => f.anchor));

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const run = async (key, fn) => {
    setBusy(key); setError(null);
    try { await fn(); await load(); } catch (e) { setError(e.message); }
    setBusy(null);
  };

  return (
    <>
      <div className="row-between">
        <div>
          <button className="back" onClick={onBack}>Back</button>
          <div className="section-title">{LABEL(doc.doc_type)}</div>
          <div className="section-hint">
            {doc.client_name} · {doc.reference} · version {version?.version}
          </div>
        </div>
        <span className={`badge ${doc.status}`}>{doc.status.replace(/_/g, ' ')}</span>
      </div>

      {error && <div className="notice err">{error}</div>}

      {/* Before sign-off: what needs clearing, above the letter rather than
          beside it. It is a gate you pass through once, not a permanent panel. */}
      {!locked && open.length > 0 && (
        <div className="checks">
          <div className="checks-head">
            <span className="box-title">
              {blocking.length > 0
                ? `${blocking.length} to resolve before sign-off`
                : `${open.length} worth a look`}
            </span>
          </div>
          {flags.filter((f) => f.status === 'open').map((f) => (
            <div key={f.id} className={`check check-${f.severity}`}>
              <div className="check-main">
                <div className="flag-head">
                  <span className={`badge ${f.severity}`}>{f.severity}</span>
                  {f.anchor && <span className="flag-anchor">{LABEL(f.anchor)}</span>}
                </div>
                <p className="flag-msg">{f.message}</p>
                {dismissing === f.id && (
                  <div className="dismiss-box">
                    <input
                      placeholder="Why is this not a problem?"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <button
                      className="btn btn-sm"
                      disabled={busy === f.id || !reason.trim()}
                      onClick={() => run(f.id, async () => {
                        await api.flag({ documentId, flagId: f.id, dismissed: true, reason });
                        setDismissing(null); setReason('');
                      })}
                    >
                      Record
                    </button>
                  </div>
                )}
              </div>
              {dismissing !== f.id && (
                <div className="check-side">
                  <button
                    className="btn btn-sm"
                    disabled={busy === f.id}
                    onClick={() => run(f.id, () => api.flag({ documentId, flagId: f.id, dismissed: false }))}
                  >
                    Resolved
                  </button>
                  <button className="btn-ghost" onClick={() => setDismissing(f.id)}>Dismiss</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="letter-stage">
        <article className="letter">
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
              <div>{today}</div>
            </div>
          </header>

          <div className="letter-recipient">
            <div>{doc.client_name}</div>
            {doc.client_address && <div className="pre">{doc.client_address}</div>}
          </div>

          <p className="letter-salutation">Dear {salutation || doc.client_name},</p>

          {blocks.map((b) => {
            const furniture = isFurniture(b);
            const drafted = b.kind === 'bespoke';
            const hasFlag = flagged.has(b.key);

            return (
              <section
                className={`letter-section${drafted ? ' drafted' : ''}`
                  + `${b.amended ? ' amended' : ''}${hasFlag ? ' flagged' : ''}`}
                key={b.key}
              >
                {(!furniture || !locked) && (
                  <div className="section-tools">
                    <h3>{furniture ? '' : LABEL(b.key)}</h3>
                    <div className="tool-side">
                      {drafted && <span className="mark-ai">written for this matter</span>}
                      {b.amended && <span className="mark-amended">standard clause changed</span>}
                      {!locked && editing !== b.key && (
                        <button
                          className="btn-ghost"
                          onClick={() => { setEditing(b.key); setEditText(b.body || ''); }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {editing === b.key ? (
                  <>
                    <textarea rows={6} value={editText} onChange={(e) => setEditText(e.target.value)} />
                    <div className="btn-row" style={{ marginTop: 8 }}>
                      <button
                        className="btn btn-sm"
                        disabled={busy === 'edit'}
                        onClick={() => run('edit', async () => {
                          await api.editBlock({ documentId, blockKey: b.key, body: editText });
                          setEditing(null);
                        })}
                      >
                        Save
                      </button>
                      <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <p className="letter-body">{b.body}</p>
                )}

                {locked && !furniture && (
                  <label className="ack" aria-hidden="true">
                    <span className="ack-box" />
                    <span className="ack-text">I acknowledge this section.</span>
                  </label>
                )}
              </section>
            );
          })}

          {locked && (
            <div className="letter-sign">
              <div className="sign-grid">
                <div>
                  <label className="sign-label">Client <em>*</em></label>
                  <div className="sign-pad">
                    <div className="sign-draw">Signature</div>
                    <span className="sign-rule" />
                  </div>
                </div>
                <div>
                  <label className="sign-label">Date signed <em>*</em></label>
                  <div className="sign-date">{today}</div>
                </div>
              </div>
              <label className="sign-label">Print name <em>*</em></label>
              <div className="name-grid">
                <input placeholder="First" readOnly />
                <input placeholder="Last" readOnly />
              </div>
            </div>
          )}
        </article>

      </div>

      <div className="letter-actions">
        {approvals.length > 0 ? (
          <>
            <div className="signed">
              <strong>Signed off</strong>
              <div className="prov">
                {approvals[0].approver_name} · {new Date(approvals[0].approved_at).toLocaleString('en-GB')}
              </div>
            </div>
            <div className="btn-row">
              <a className="btn-primary" href={api.downloadUrl(documentId)}>Download</a>
              <button className="btn" onClick={() => setSending(true)}>Send to client</button>
              {doc.status === 'approved' && (
                <button
                  className="btn btn-sm"
                  disabled={busy === 'issue'}
                  onClick={() => run('issue', () => api.issue({ documentId }))}
                >
                  Mark issued
                </button>
              )}
              <button
                className="btn-ghost"
                disabled={busy === 'reopen'}
                onClick={() => run('reopen', () => api.reopen({ documentId }))}
              >
                {doc.status === 'issued' ? 'Revise as a new version' : 'Reopen for changes'}
              </button>
            </div>
          </>
        ) : me?.canApprove ? (
          <>
            <button
              className="btn-primary lg"
              disabled={busy === 'approve' || blocking.length > 0}
              onClick={() => run('approve', () => api.approve({ documentId }))}
            >
              {busy === 'approve' ? 'Recording…' : 'Sign off this letter'}
            </button>
            <span className="prov">
              {blocking.length > 0
                ? `${blocking.length} check${blocking.length > 1 ? 's' : ''} above must be cleared first.`
                : 'Your name, the version and the time are recorded permanently.'}
            </span>
          </>
        ) : (
          <p className="muted">Your role cannot sign off. Ask the firm owner.</p>
        )}
      </div>

      {sending && (
        <SendToClient
          doc={doc}
          firm={firm}
          salutation={salutation}
          documentId={documentId}
          onClose={() => setSending(false)}
        />
      )}
    </>
  );
}

// Sending. The letter goes from the fee earner's own address, in a thread the
// client can reply into, because an engagement letter is often the first
// substantial thing they receive and it should not arrive from software.
//
// A mail client cannot be handed an attachment from a web page, so the file is
// downloaded and the draft opened alongside it. That is two actions rather than
// one, and it is honest about what is happening. Sending from inside the system
// needs the firm's own domain verified, which is a separate piece of work.
function SendToClient({ doc, firm, salutation, documentId, onClose }) {
  const branding = firm?.branding || {};
  const firmName = branding.letterhead || firm?.name || '';
  const subject = `${firmName}: your engagement letter (${doc.reference})`;
  const [note, setNote] = useState(
    `Dear ${salutation || doc.client_name},\n\n`
    + `Please find attached our engagement letter for this matter, setting out the `
    + `terms on which we will act for you and the basis on which we will charge.\n\n`
    + `Please read it carefully. If anything does not match your understanding of `
    + `what we discussed, do let me know before we begin work.\n\n`
    + `Kind regards`
  );
  const [step, setStep] = useState(1);

  const mailto = `mailto:${encodeURIComponent(doc.client_email || '')}`
    + `?subject=${encodeURIComponent(subject)}`
    + `&body=${encodeURIComponent(note)}`;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Send to client</h2>
        <p className="muted">
          The letter goes from your own address, so the client can reply to you
          rather than to us.
        </p>

        <div className="kv">
          <div>
            <div className="kv-key">To</div>
            <div className="kv-val">{doc.client_email || 'No email on this client'}</div>
          </div>
        </div>
        <div className="kv">
          <div>
            <div className="kv-key">Subject</div>
            <div className="kv-val">{subject}</div>
          </div>
        </div>

        <label className="field" style={{ marginTop: 16 }}>
          <span>Covering note</span>
          <textarea rows={9} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <ol className="send-steps">
          <li className={step > 1 ? 'done' : 'now'}>
            <a
              className="btn"
              href={api.downloadUrl(documentId)}
              onClick={() => setStep(2)}
            >
              Download the letter
            </a>
            <span className="prov">Saves to your computer, ready to attach.</span>
          </li>
          <li className={step > 1 ? 'now' : ''}>
            <a
              className={step > 1 ? 'btn-primary' : 'btn'}
              href={doc.client_email ? mailto : undefined}
              aria-disabled={!doc.client_email}
            >
              Open the email
            </a>
            <span className="prov">Opens a draft from you, with the note above. Attach the file and send.</span>
          </li>
        </ol>

        {!doc.client_email && (
          <div className="notice warn">
            This client has no email address on file. Add one on their details page.
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 18 }}>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
