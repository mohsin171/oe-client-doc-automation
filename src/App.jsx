import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Login from './views/Login.jsx';
import Queue from './views/Queue.jsx';
import Matter from './views/Matter.jsx';
import Review from './views/Review.jsx';
import Templates from './views/Templates.jsx';
import Team from './views/Team.jsx';

export default function App() {
  const [session, setSession] = useState({ loading: true });
  const [tab, setTab] = useState('queue');
  const [matterId, setMatterId] = useState(null);
  const [documentId, setDocumentId] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const loadSession = useCallback(() => {
    api.session()
      .then((d) => setSession({ loading: false, ...d }))
      .catch((e) => setSession({ loading: false, signedIn: false, error: e.message }));
  }, []);

  useEffect(() => { loadSession(); }, [loadSession]);

  // Any route can expire mid-session. When that happens, drop straight back to
  // the sign-in screen rather than showing a broken view.
  useEffect(() => {
    const onUnauthorised = () => setSession((s) => ({ ...s, signedIn: false }));
    window.addEventListener('oe-unauthenticated', onUnauthorised);
    return () => window.removeEventListener('oe-unauthenticated', onUnauthorised);
  }, []);

  function openMatter(id) { setDocumentId(null); setMatterId(id); }
  function backToQueue() { setMatterId(null); setDocumentId(null); }

  async function signOut() {
    try { await api.logout(); } catch (_) { /* cookie is cleared regardless */ }
    backToQueue();
    setSession({ loading: false, signedIn: false });
  }

  if (session.loading) {
    return <div className="wrap"><p className="muted">Loading…</p></div>;
  }

  if (!session.signedIn) {
    return <Login status={session} onSignedIn={loadSession} />;
  }

  const isOwner = session.user?.role === 'owner';

  let view;
  if (documentId) {
    view = <Review documentId={documentId} onBack={() => setDocumentId(null)} />;
  } else if (matterId) {
    view = <Matter matterId={matterId} onBack={backToQueue} onOpenDocument={setDocumentId} />;
  } else if (tab === 'templates') {
    view = <Templates />;
  } else if (tab === 'team') {
    view = <Team />;
  } else {
    view = <Queue onOpenMatter={openMatter} onNewMatter={() => setShowNew(true)} />;
  }

  const onQueue = !matterId && !documentId;

  return (
    <div className="wrap wide">
      <header className="app-head">
        <div>
          <p className="eyebrow">{session.firm?.name}</p>
          <h1 className="app-title">Document Engine</h1>
        </div>

        <div className="head-right">
          <nav className="tabs">
            <button
              className={onQueue && tab === 'queue' ? 'tab active' : 'tab'}
              onClick={() => { backToQueue(); setTab('queue'); }}
            >
              Queue
            </button>
            <button
              className={onQueue && tab === 'templates' ? 'tab active' : 'tab'}
              onClick={() => { backToQueue(); setTab('templates'); }}
            >
              Templates
            </button>
            {isOwner && (
              <button
                className={onQueue && tab === 'team' ? 'tab active' : 'tab'}
                onClick={() => { backToQueue(); setTab('team'); }}
              >
                Team
              </button>
            )}
          </nav>

          <div className="who">
            <span className="who-name">{session.user.name}</span>
            <span className="who-role">{session.user.role}</span>
            <button className="btn-tiny ghost" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </header>

      {session.emailConfigured === false && isOwner && (
        <div className="banner">
          Email is not connected, so sign-in codes are written to the server log
          rather than sent. Add RESEND_API_KEY before inviting anyone.
        </div>
      )}

      {showNew && (
        <NewMatter
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setShowNew(false); openMatter(id); }}
        />
      )}

      <main>{view}</main>

      <footer>
        <p>
          The AI never fills a gap, and the AI never touches fixed clauses.
          A qualified person signs off on everything before it leaves the firm.
        </p>
      </footer>
    </div>
  );
}

function NewMatter({ onClose, onCreated }) {
  const [form, setForm] = useState({
    clientLegalName: '', clientEmail: '', clientAddress: '', matterType: '', reference: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const d = await api.createMatter(form);
      onCreated(d.matter.id);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Open a matter</h3>
        <p className="muted small">
          The hard facts go in the form, because they must be exactly right.
          Scope and context come next, and can be dictated once that is built.
        </p>

        <label className="gap-input">
          <span>Client legal name</span>
          <input value={form.clientLegalName} onChange={set('clientLegalName')} />
        </label>
        <label className="gap-input">
          <span>Matter type</span>
          <input value={form.matterType} onChange={set('matterType')} placeholder="conveyancing, probate, commercial" />
        </label>
        <label className="gap-input">
          <span>Client email</span>
          <input value={form.clientEmail} onChange={set('clientEmail')} />
        </label>
        <label className="gap-input">
          <span>Client address</span>
          <input value={form.clientAddress} onChange={set('clientAddress')} />
        </label>
        <label className="gap-input">
          <span>Reference (optional)</span>
          <input value={form.reference} onChange={set('reference')} placeholder="generated if left blank" />
        </label>

        {error && <p className="err">{error}</p>}

        <div className="btn-row">
          <button
            className="btn-primary"
            disabled={busy || !form.clientLegalName || !form.matterType}
            onClick={create}
          >
            {busy ? 'Opening…' : 'Open matter'}
          </button>
          <button className="btn-small ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
