import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Login from './views/Login.jsx';
import Queue from './views/Queue.jsx';
import Matter from './views/Matter.jsx';
import Review from './views/Review.jsx';
import Templates from './views/Templates.jsx';
import Team from './views/Team.jsx';
import FirmMark from './views/FirmMark.jsx';

const STATUS_LABEL = {
  incomplete: 'Needs data',
  open: 'Ready to draft',
  active: 'In progress',
  closed: 'Closed',
};

export default function App() {
  const [session, setSession] = useState({ loading: true });
  const [tab, setTab] = useState('queue');
  const [matterId, setMatterId] = useState(null);
  const [documentId, setDocumentId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [matters, setMatters] = useState([]);

  const loadSession = useCallback(() => {
    api.session()
      .then(async (d) => {
        // Before sign-in there is no session, so the firm identity for the
        // sign-in screen comes from the public health endpoint.
        if (!d.signedIn) {
          try {
            const h = await api.health();
            d.firm = h.checks?.firm || null;
          } catch (_) { /* sign-in still works unbranded */ }
        }
        setSession({ loading: false, ...d });
      })
      .catch((e) => setSession({ loading: false, signedIn: false, error: e.message }));
  }, []);

  const loadMatters = useCallback(() => {
    api.listMatters().then((d) => setMatters(d.matters || [])).catch(() => {});
  }, []);

  useEffect(() => { loadSession(); }, [loadSession]);
  useEffect(() => { if (session.signedIn) loadMatters(); }, [session.signedIn, loadMatters]);

  useEffect(() => {
    const drop = () => { setMatters([]); loadSession(); };
    window.addEventListener('oe-unauthenticated', drop);
    return () => window.removeEventListener('oe-unauthenticated', drop);
  }, [loadSession]);

  function backToQueue() { setMatterId(null); setDocumentId(null); loadMatters(); }
  function openMatter(id) { setDocumentId(null); setMatterId(id); }

  async function signOut() {
    try { await api.logout(); } catch (_) { /* cookie clears regardless */ }
    setMatterId(null); setDocumentId(null);
    setMatters([]);
    loadSession();
  }

  if (session.loading) {
    return <div className="main"><p className="muted">Loading…</p></div>;
  }
  if (!session.signedIn) {
    return <Login status={session} firm={session.firm} onSignedIn={loadSession} />;
  }

  const isOwner = session.user?.role === 'owner';
  const onQueue = !matterId && !documentId;
  const firmName = session.firm?.name || '';
  const branding = session.firm?.branding || {};

  const counts = matters.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    acc.review += m.pending_documents || 0;
    return acc;
  }, { review: 0 });

  let view;
  if (documentId) {
    view = <Review documentId={documentId} onBack={() => { setDocumentId(null); loadMatters(); }} />;
  } else if (matterId) {
    view = <Matter matterId={matterId} onBack={backToQueue} onOpenDocument={setDocumentId} />;
  } else if (tab === 'templates') {
    view = <Templates />;
  } else if (tab === 'team') {
    view = <Team />;
  } else {
    view = (
      <Queue
        matters={matters}
        onOpenMatter={openMatter}
        onNewMatter={() => setShowNew(true)}
      />
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-inner">
          <div className="brand">
            <FirmMark branding={branding} name={firmName} size={40} />
            <div>
              <div className="brand-name">{branding.shortName || firmName}</div>
              <div className="brand-sub">Document automation</div>
            </div>
          </div>

          <div className="side-section">
            <div className="side-label">Workspace</div>
            <button
              className={onQueue && tab === 'queue' ? 'side-item-btn active' : 'side-item-btn'}
              onClick={() => { backToQueue(); setTab('queue'); }}
            >
              <span className="side-item-label">Queue</span>
              <span className="side-count">{matters.length || ''}</span>
            </button>
            <button
              className={onQueue && tab === 'templates' ? 'side-item-btn active' : 'side-item-btn'}
              onClick={() => { backToQueue(); setTab('templates'); }}
            >
              <span className="side-item-label">Templates</span>
            </button>
            {isOwner && (
              <button
                className={onQueue && tab === 'team' ? 'side-item-btn active' : 'side-item-btn'}
                onClick={() => { backToQueue(); setTab('team'); }}
              >
                <span className="side-item-label">Team</span>
              </button>
            )}
          </div>

          {matters.length > 0 && (
            <div className="side-section">
              <div className="side-label">Matters</div>
              {['incomplete', 'open', 'active', 'closed'].map((k) => (
                counts[k] ? (
                  <div className="side-item" key={k}>
                    <span className={`side-dot ${k}`} />
                    <span className="side-item-label">{STATUS_LABEL[k]}</span>
                    <span className={k === 'incomplete' ? 'side-count urgent' : 'side-count'}>{counts[k]}</span>
                  </div>
                ) : null
              ))}
            </div>
          )}

          <div className="side-foot">
            Signed off by a person, always.
            <br />
            <span className="powered">Powered by Orca Edge</span>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topnav">
          <nav className="topnav-tabs">
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
            <button className="btn btn-sm" onClick={signOut}>Sign out</button>
          </div>
        </header>

        <main className="main">
          {session.emailConfigured === false && isOwner && (
            <div className="notice warn">
              Email is not connected, so sign-in codes are written to the server log
              rather than sent. Add RESEND_API_KEY before inviting anyone.
            </div>
          )}
          {view}
        </main>
      </div>

      {showNew && (
        <NewMatter
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setShowNew(false); loadMatters(); openMatter(id); }}
        />
      )}
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
    setBusy(true); setError(null);
    try {
      const d = await api.createMatter(form);
      onCreated(d.matter.id);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Open a matter</h2>
        <p className="muted">
          Hard facts go in the form, because they have to be exactly right.
          Scope and context follow, and can be dictated once that is built.
        </p>

        <label className="field">
          <span>Client legal name</span>
          <input value={form.clientLegalName} onChange={set('clientLegalName')} />
        </label>
        <label className="field">
          <span>Matter type</span>
          <input value={form.matterType} onChange={set('matterType')} placeholder="conveyancing, probate, commercial" />
        </label>
        <label className="field">
          <span>Client email</span>
          <input value={form.clientEmail} onChange={set('clientEmail')} />
        </label>
        <label className="field">
          <span>Client address</span>
          <input value={form.clientAddress} onChange={set('clientAddress')} />
        </label>
        <label className="field">
          <span>Reference</span>
          <input value={form.reference} onChange={set('reference')} placeholder="generated if left blank" />
        </label>

        {error && <div className="notice err">{error}</div>}

        <div className="btn-row">
          <button
            className="btn-primary"
            disabled={busy || !form.clientLegalName || !form.matterType}
            onClick={create}
          >
            {busy ? 'Opening…' : 'Open matter'}
          </button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
