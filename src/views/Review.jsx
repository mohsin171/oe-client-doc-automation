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
    try {
      const d = await api.getDocument(documentId);
      setState({ loading: false, ...d });
    } catch (e) {
      setState({ loading: false, error: e.message });
    }
  }

  useEffect(() => { load(); }, [documentId]);

  if (state.loading) return <p className="muted">Loading…</p>;
  if (state.error) return <p className="err">{state.error}</p>;

  const { document: doc, version, flags = [], approvals = [], me } = state;
  const blocks = version?.blocks || [];
  const openFlags = flags.filter((f) => f.status === 'open');
  const blocking = openFlags.filter((f) => f.severity === 'blocking');
  const isApproved = ['approved', 'issued'].includes(doc.status);

  async function saveEdit(key) {
    setBusy('edit');
    try {
      await api.editBlock({ documentId, blockKey: key, body: editText });
      setEditing(null);
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  async function resolve(flagId) {
    setBusy(flagId);
    try {
      await api.flag({ documentId, flagId, dismissed: false });
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  async function dismiss(flagId) {
    if (!reason.trim()) { setError('A dismissal needs a reason.'); return; }
    setBusy(flagId);
    try {
      await api.flag({ documentId, flagId, dismissed: true, reason });
      setDismissing(null);
      setReason('');
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  async function approve() {
    setBusy('approve');
    setError(null);
    try {
      await api.approve({ documentId });
      await load();
    } catch (e) {
      if (e.detail?.reason === 'blocking_flags') {
        setError('There are still blocking flags open. Resolve or dismiss each one first.');
      } else {
        setError(e.message);
      }
    }
    setBusy(null);
  }

  async function issue() {
    setBusy('issue');
    try {
      await api.issue({ documentId });
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  return (
    <div>
      <button className="link-back" onClick={onBack}>Back</button>

      <div className="row-between">
        <div>
          <h2 className="view-title">{LABEL(doc.doc_type)}</h2>
          <p className="muted small">
            {doc.client_name} · {doc.reference} · version {version?.version}
          </p>
        </div>
        <span className={`tag tag-${doc.status}`}>{doc.status.replace(/_/g, ' ')}</span>
      </div>

      {error && <p className="err">{error}</p>}

      <div className="review-split">
        {/* Draft */}
        <div className="draft">
          {blocks.map((b) => (
            <div key={b.key} className={`block block-${b.kind}`}>
              <div className="block-head">
                <span className="block-kind">
                  {b.kind === 'fixed' && 'Standard clause · not editable by AI'}
                  {b.kind === 'field' && 'Merged from matter record'}
                  {b.kind === 'bespoke' && 'AI drafted · check this closely'}
                  {b.editedByHand && ' · edited by hand'}
                </span>
                {b.kind !== 'fixed' && !isApproved && (
                  <button
                    className="btn-tiny"
                    onClick={() => { setEditing(b.key); setEditText(b.body || ''); }}
                  >
                    Edit
                  </button>
                )}
              </div>

              {editing === b.key ? (
                <div>
                  <textarea
                    className="editor"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={6}
                  />
                  <div className="btn-row">
                    <button className="btn-small" disabled={busy === 'edit'} onClick={() => saveEdit(b.key)}>
                      Save
                    </button>
                    <button className="btn-small ghost" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="block-body">{b.body || <em className="muted">empty</em>}</p>
              )}
            </div>
          ))}
        </div>

        {/* Flags */}
        <div className="flags">
          <div className="card-head">
            <h3>Review</h3>
            <span className={blocking.length ? 'pill pill-warn' : 'pill pill-ok'}>
              {openFlags.length} open
            </span>
          </div>

          {flags.length === 0 && <p className="muted small">No flags raised on this version.</p>}

          {flags.map((f) => (
            <div key={f.id} className={`flag flag-${f.severity} flag-${f.status}`}>
              <div className="flag-head">
                <span className="flag-sev">{f.severity}</span>
                {f.anchor && <span className="flag-anchor">{f.anchor}</span>}
              </div>
              <p className="flag-msg">{f.message}</p>

              {f.status === 'open' && !isApproved && (
                <div className="btn-row">
                  <button className="btn-tiny" disabled={busy === f.id} onClick={() => resolve(f.id)}>
                    Resolved
                  </button>
                  <button className="btn-tiny ghost" onClick={() => setDismissing(f.id)}>
                    Dismiss
                  </button>
                </div>
              )}

              {dismissing === f.id && (
                <div className="dismiss-box">
                  <input
                    placeholder="Why is this not a problem?"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <button className="btn-tiny" disabled={busy === f.id} onClick={() => dismiss(f.id)}>
                    Record
                  </button>
                </div>
              )}

              {f.status === 'dismissed' && (
                <p className="hint">Dismissed: {f.dismissed_reason}</p>
              )}
              {f.status === 'resolved' && <p className="hint">Resolved</p>}
            </div>
          ))}

          {/* Sign-off */}
          <div className="signoff">
            {approvals.length > 0 ? (
              <div className="approved-note">
                <strong>Signed off</strong>
                <span className="hint">
                  {approvals[0].approver_name} · {new Date(approvals[0].approved_at).toLocaleString('en-GB')}
                </span>
              </div>
            ) : me?.canApprove ? (
              <>
                <button
                  className="btn-primary full"
                  disabled={busy === 'approve' || blocking.length > 0}
                  onClick={approve}
                >
                  {busy === 'approve' ? 'Recording…' : 'Sign off'}
                </button>
                {blocking.length > 0 && (
                  <p className="hint">
                    {blocking.length} blocking flag{blocking.length > 1 ? 's' : ''} must be
                    resolved or dismissed first.
                  </p>
                )}
              </>
            ) : (
              <p className="hint">
                Your role cannot sign off. Route this to an approver.
              </p>
            )}

            {doc.status === 'approved' && (
              <div className="btn-row">
                <a className="btn-secondary" href={api.downloadUrl(documentId)}>Download Word</a>
                <button className="btn-small" disabled={busy === 'issue'} onClick={issue}>
                  Mark issued
                </button>
              </div>
            )}

            {doc.status === 'issued' && (
              <a className="btn-secondary full" href={api.downloadUrl(documentId)}>Download Word</a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
