import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import DocumentForm from './DocumentForm.jsx';
import DocumentFinal from './DocumentFinal.jsx';
import SendDrawer from './SendDrawer.jsx';

// The document screen is a thin shell now: it loads, holds the editing state,
// and performs the actions. How the letter looks belongs in DocumentForm.

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

  const run = async (key, fn) => {
    setBusy(key); setError(null);
    try { await fn(); await load(); } catch (e) { setError(e.message); }
    setBusy(null);
  };

  if (state.loading) return <p className="muted">Loading…</p>;
  if (state.error) return <div className="notice err">{state.error}</div>;

  const {
    document: doc, version, flags = [], approvals = [], me, firm, salutation,
    groundedOn = [],
  } = state;

  // Signed off is a different screen, not the same screen with its controls
  // hidden. The working view carries checks, edit tools and marks showing which
  // passages the model wrote; none of that is the letter.
  const signedOff = ['approved', 'issued'].includes(doc.status);

  if (signedOff) {
    return (
      <>
        {error && <div className="notice err">{error}</div>}
        <DocumentFinal
          doc={doc}
          version={version}
          firm={firm}
          salutation={salutation}
          approvals={approvals}
          sender={state.sender}
          busy={busy}
          onSend={() => setSending(true)}
          onIssue={() => run('issue', () => api.issue({ documentId }))}
          onReopen={() => run('reopen', () => api.reopen({ documentId }))}
          onBack={onBack}
        />
        {sending && (
          <SendDrawer
            doc={doc}
            firm={firm}
            sender={state.sender}
            salutation={salutation}
            sends={state.sends || []}
            canSend={state.canSend}
            busy={busy}
            error={error}
            onClose={() => { setSending(false); setError(null); }}
            onSend={(payload) => run('send', async () => {
              await api.sendDocument({ documentId, ...payload });
              setSending(false);
            })}
          />
        )}
      </>
    );
  }

  return (
    <>
      {error && <div className="notice err">{error}</div>}

      <DocumentForm
        doc={doc}
        version={version}
        firm={firm}
        salutation={salutation}
        flags={flags}
        approvals={approvals}
        me={me}
        groundedOn={groundedOn}
        busy={busy}
        editing={editing}
        editText={editText}
        setEditing={setEditing}
        setEditText={setEditText}
        dismissing={dismissing}
        setDismissing={setDismissing}
        reason={reason}
        setReason={setReason}
        onEditSave={(key, override) => run('edit', async () => {
          await api.editBlock({ documentId, blockKey: key, body: override ?? editText });
          setEditing(null);
        })}
        onResolve={(flagId) => run(flagId, () => api.flag({ documentId, flagId, dismissed: false }))}
        onDismiss={(flagId) => run(flagId, async () => {
          await api.flag({ documentId, flagId, dismissed: true, reason });
          setDismissing(null); setReason('');
        })}
        onApprove={() => run('approve', () => api.approve({ documentId }))}
        onIssue={() => run('issue', () => api.issue({ documentId }))}
        onReopen={() => run('reopen', () => api.reopen({ documentId }))}
        onSend={() => setSending(true)}
        onBack={onBack}
      />

    </>
  );
}
