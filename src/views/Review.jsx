import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import DocumentForm from './DocumentForm.jsx';

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
  const [suggestion, setSuggestion] = useState(null);

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

  const { document: doc, version, flags = [], approvals = [], me, firm, salutation } = state;

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
        busy={busy}
        editing={editing}
        editText={editText}
        setEditing={setEditing}
        setEditText={setEditText}
        dismissing={dismissing}
        setDismissing={setDismissing}
        reason={reason}
        setReason={setReason}
        onSuggest={(flagId) => run(`suggest-${flagId}`, async () => {
          const d = await api.suggest({ documentId, flagId });
          setSuggestion({ flagId, ...d });
        })}
        suggestion={suggestion}
        clearSuggestion={() => setSuggestion(null)}
        onEditSave={(key, override) => run('edit', async () => {
          await api.editBlock({ documentId, blockKey: key, body: override ?? editText });
          setEditing(null);
          setSuggestion(null);
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

// The letter goes from the fee earner's own address, in a thread the client can
// reply into, because an engagement letter is often the first substantial thing
// they receive and it should not arrive from software.
function SendToClient({ doc, firm, salutation, documentId, onClose }) {
  const branding = firm?.branding || {};
  const firmName = branding.letterhead || firm?.name || '';
  const subject = `${firmName}: your engagement letter (${doc.reference})`;
  const [note, setNote] = useState(
    `Dear ${salutation || doc.client_name},\n\n`
    + 'Please find attached our engagement letter for this matter, setting out the '
    + 'terms on which we will act for you and the basis on which we will charge.\n\n'
    + 'Please read it carefully. If anything does not match your understanding of '
    + 'what we discussed, do let me know before we begin work.\n\nKind regards'
  );
  const [step, setStep] = useState(1);

  const mailto = `mailto:${encodeURIComponent(doc.client_email || '')}`
    + `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(note)}`;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Send to client</h2>
        <p className="muted">
          The letter goes from your own address, so the client replies to you
          rather than to us.
        </p>

        <div className="kv">
          <div>
            <div className="kv-key">To</div>
            <div className="kv-val">{doc.client_email || 'No email on this client'}</div>
          </div>
        </div>

        <label className="field" style={{ marginTop: 16 }}>
          <span>Covering note</span>
          <textarea rows={9} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <ol className="send-steps">
          <li className={step > 1 ? 'done' : 'now'}>
            <a className="btn" href={api.downloadUrl(documentId, 'pdf')} onClick={() => setStep(2)}>
              Download the PDF
            </a>
            <span className="prov">Saves to your computer, ready to attach.</span>
          </li>
          <li className={step > 1 ? 'now' : ''}>
            <a className={step > 1 ? 'btn-primary' : 'btn'} href={doc.client_email ? mailto : undefined}>
              Open the email
            </a>
            <span className="prov">A draft from you, with the note above. Attach and send.</span>
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
