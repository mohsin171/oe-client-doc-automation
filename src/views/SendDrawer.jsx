import React, { useState } from 'react';

// A drawer rather than a dialog, because sending is not a decision taken in
// isolation: it happens while looking at the letter, and what was sent before
// matters. Summary at the top, the thread beneath it, the message at the bottom.

export default function SendDrawer({
  doc, firm, sender, salutation, sends = [], canSend, busy, error, onSend, onClose,
}) {
  const firmName = firm?.branding?.letterhead || firm?.name || '';
  const [to, setTo] = useState(doc.client_email || '');
  const [subject, setSubject] = useState(
    `${firmName}: your engagement letter (${doc.reference})`
  );
  const [note, setNote] = useState(
    `Dear ${salutation || doc.client_name || 'Sir or Madam'},\n\n`
    + 'Please find attached our engagement letter for this matter, setting out the '
    + 'terms on which we will act for you and the basis on which we will charge.\n\n'
    + 'Please confirm by return that you agree to these terms, so that we may begin '
    + 'work. If anything does not match your understanding of what we discussed, do '
    + 'tell me before you do.\n\n'
    + `Kind regards\n${sender?.name || ''}\n${firmName}`
  );

  const ready = to.includes('@') && note.trim().length > 20 && canSend;

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Send to client">
        <header className="drawer-head">
          <div>
            <div className="drawer-title">Send to client</div>
            <div className="prov">{doc.reference}</div>
          </div>
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </header>

        <div className="drawer-summary">
          <div className="kv">
            <div>
              <div className="kv-key">To</div>
              <div className="kv-val">{doc.client_name}</div>
            </div>
          </div>
          <div className="kv">
            <div>
              <div className="kv-key">From</div>
              <div className="kv-val">{sender?.name}</div>
              <div className="prov">
                Replies come to {sender?.email}. Sent on {firmName}&rsquo;s behalf from
                our verified domain until the firm verifies its own.
              </div>
            </div>
          </div>
          <div className="kv">
            <div>
              <div className="kv-key">Attached</div>
              <div className="kv-val">
                The signed-off letter, as a PDF, generated when you press send
              </div>
            </div>
          </div>
        </div>

        <div className="drawer-thread">
          <div className="drawer-thread-label">Sent on this file</div>
          {sends.length === 0 ? (
            <p className="box-empty">Nothing sent on this file yet.</p>
          ) : (
            sends.map((s) => (
              <div className="msg" key={s.id}>
                <div className="msg-head">
                  <strong>{s.sent_by_name}</strong>
                  <span className="prov">
                    to {s.to_email} · {new Date(s.sent_at).toLocaleString('en-GB')}
                  </span>
                </div>
                {s.subject && <div className="msg-subject">{s.subject}</div>}
                {s.cover_note && <p className="msg-body">{s.cover_note}</p>}
              </div>
            ))
          )}
        </div>

        <div className="drawer-compose">
          {!canSend && (
            <div className="notice warn">
              Email is not connected, so nothing can be sent. Add RESEND_API_KEY
              and redeploy.
            </div>
          )}

          <label className="field">
            <span>To</span>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" />
          </label>

          <label className="field">
            <span>Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>

          <label className="field">
            <span>Message</span>
            <textarea rows={11} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          {error && <div className="notice err">{error}</div>}

          <div className="btn-row">
            <button
              className="btn-primary"
              disabled={!ready || busy === 'send'}
              onClick={() => onSend({ to, subject, note })}
            >
              {busy === 'send' ? 'Sending…' : 'Send with the letter attached'}
            </button>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </aside>
    </>
  );
}
