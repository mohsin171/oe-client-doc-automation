import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const LABEL = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Review({ documentId, onBack }) {
  const [state, setState] = useState({ loading: true });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState('');
  const [dismissing, setDismissing] = useState(null);
  const [reason, setReason] = useState('');

  async function load() {
    try { setState({ loading: false, ...(await api.getDocument(documentId)) }); }
    catch (e) { setState({ loading: false, error: e.message }); }
  }
  useEffect(() => { load(); }, [documentId]);

  if (state.loading) return <p className="muted">Loading…</p>;
  if (state.error) return <div className="notice err">{state.error}</div>;

  const { document: doc, version, flags = [], approvals = [], me } = state;
  const blocks = version?.blocks || [];
  const open = flags.filter((f) => f.status === 'open');
  const blocking = open.filter((f) => f.severity === 'blocking');
  const locked = ['approved', 'issued'].includes(doc.status);

  const run = async (key, fn) => {
    setBusy(key); setError(null);
    try { await fn(); await load(); } catch (e) { setError(e.message); }
    setBusy(null);
  };

  return (
    <>
      <button className="back" onClick={onBack}>Back</button>

      <div className="section-head">
        <div>
          <div className="section-title">{LABEL(doc.doc_type)}</div>
          <div className="section-hint">
            {doc.client_name} · {doc.reference} · version {version?.version}
          </div>
        </div>
        <span className={`badge ${doc.status}`}>{doc.status.replace(/_/g, ' ')}</span>
      </div>

      {error && <div className="notice err">{error}</div>}

      <div className="review-split">
        <div className="draft-doc">
          {blocks.map((b) => (
            <div key={b.key} className={`block block-${b.kind}`}>
              <div className="block-head">
                <span className="block-kind">
                  {b.kind === 'fixed' && 'Standard clause · assembled by code'}
                  {b.kind === 'field' && 'Merged from the matter record'}
                  {b.kind === 'bespoke' && 'AI drafted · check this closely'}
                  {b.editedByHand && ' · edited by hand'}
                </span>
                {b.kind !== 'fixed' && !locked && (
                  <button
                    className="btn-ghost"
                    onClick={() => { setEditing(b.key); setEditText(b.body || ''); }}
                  >
                    Edit
                  </button>
                )}
              </div>

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
                <p className="block-body">{b.body || <span className="faint">empty</span>}</p>
              )}
            </div>
          ))}
        </div>

        <aside className="flags-panel">
          <div className="box-head">
            <span className="box-title">Review</span>
            <span className={blocking.length ? 'badge blocking' : 'badge approved'}>
              {open.length} open
            </span>
          </div>

          {flags.length === 0 && <p className="box-empty">No flags raised on this version.</p>}

          {flags.map((f) => (
            <div key={f.id} className={`flag flag-${f.severity} flag-${f.status}`}>
              <div className="flag-head">
                <span className={`badge ${f.severity}`}>{f.severity}</span>
                {f.anchor && <span className="flag-anchor">{f.anchor}</span>}
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
                    {blocking.length} blocking flag{blocking.length > 1 ? 's' : ''} must be
                    resolved or dismissed first.
                  </p>
                )}
              </>
            ) : (
              <p className="muted">Your role cannot sign off. Route this to an approver.</p>
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
