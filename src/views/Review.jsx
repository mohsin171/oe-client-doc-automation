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
  const [acks, setAcks] = useState({});

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

  const needing = blocks.filter((b) => !isFurniture(b));
  const acked = needing.filter((b) => acks[b.key]).length;

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

      <div className="review-split">
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
                className={`letter-section${drafted ? ' drafted' : ''}${hasFlag ? ' flagged' : ''}`}
                key={b.key}
              >
                {!furniture && (
                  <div className="section-tools">
                    <h3>{LABEL(b.key)}</h3>
                    <div className="tool-side">
                      {drafted && <span className="mark-ai">written for this matter</span>}
                      {b.kind !== 'fixed' && !locked && editing !== b.key && (
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

                {!furniture && !editing && (
                  <label className={acks[b.key] ? 'ack on' : 'ack'}>
                    <input
                      type="checkbox"
                      checked={Boolean(acks[b.key])}
                      onChange={(e) => setAcks({ ...acks, [b.key]: e.target.checked })}
                    />
                    <span className="ack-box" aria-hidden="true" />
                    <span className="ack-text">I acknowledge this section.</span>
                  </label>
                )}
              </section>
            );
          })}

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
            <p className="prov" style={{ marginTop: 12 }}>
              {acked} of {needing.length} sections acknowledged. Captured from the
              client once sending is built.
            </p>
          </div>
        </article>

        <aside className="flags-panel">
          <div className="box-head">
            <span className="box-title">Review</span>
            <span className={blocking.length ? 'badge blocking' : 'badge approved'}>
              {open.length} open
            </span>
          </div>

          {flags.length === 0 && <p className="box-empty">No flags on this version.</p>}

          {flags.map((f) => (
            <div key={f.id} className={`flag flag-${f.severity} flag-${f.status}`}>
              <div className="flag-head">
                <span className={`badge ${f.severity}`}>{f.severity}</span>
                {f.anchor && <span className="flag-anchor">{LABEL(f.anchor)}</span>}
              </div>
              <p className="flag-msg">{f.message}</p>

              {f.status === 'open' && !locked && (
                <div className="btn-row" style={{ marginTop: 8 }}>
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

              {f.status === 'dismissed' && <div className="prov">Dismissed: {f.dismissed_reason}</div>}
              {f.status === 'resolved' && <div className="prov">Resolved</div>}
            </div>
          ))}

          <div className="signoff">
            {approvals.length > 0 ? (
              <div className="signed">
                <strong>Signed off</strong>
                <div className="prov">
                  {approvals[0].approver_name} · {new Date(approvals[0].approved_at).toLocaleString('en-GB')}
                </div>
              </div>
            ) : me?.canApprove ? (
              <>
                <button
                  className="btn-primary full"
                  disabled={busy === 'approve' || blocking.length > 0}
                  onClick={() => run('approve', () => api.approve({ documentId }))}
                >
                  {busy === 'approve' ? 'Recording…' : 'Sign off'}
                </button>
                {blocking.length > 0 && (
                  <p className="prov">
                    {blocking.length} blocking flag{blocking.length > 1 ? 's' : ''} to resolve or dismiss first.
                  </p>
                )}
              </>
            ) : (
              <p className="muted">Your role cannot sign off. Ask the firm owner.</p>
            )}

            {doc.status === 'approved' && (
              <div className="btn-row" style={{ marginTop: 12 }}>
                <a className="btn" href={api.downloadUrl(documentId)}>Download Word</a>
                <button
                  className="btn btn-sm"
                  disabled={busy === 'issue'}
                  onClick={() => run('issue', () => api.issue({ documentId }))}
                >
                  Mark issued
                </button>
              </div>
            )}
            {doc.status === 'issued' && (
              <a className="btn full" style={{ marginTop: 12 }} href={api.downloadUrl(documentId)}>
                Download Word
              </a>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
