import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Login from './views/Login.jsx';
import Queue from './views/Queue.jsx';
import Matter from './views/Matter.jsx';
import Review from './views/Review.jsx';
import Templates from './views/Templates.jsx';
import Documents from './views/Documents.jsx';
import Team from './views/Team.jsx';
import FirmMark from './views/FirmMark.jsx';
import NewMatter from './views/NewMatter.jsx';

// Three destinations. Adding a client is an action taken on the client list,
// not a place you navigate to, so it does not belong in the navigation.
// Two different things that were sharing one name: the letters the firm has
// written before, which is what drafting learns from, and the letters this
// system has produced.
const NAV = [
  { key: 'clients', label: 'Clients' },
  { key: 'documents', label: 'Documents' },
  { key: 'templates', label: 'Templates' },
  { key: 'team', label: 'Team', ownerOnly: true },
];

const TITLES = {
  clients: 'Clients',
  new: 'New client',
  documents: 'Documents',
  templates: 'Templates',
  team: 'Team',
};

export default function App() {
  const [session, setSession] = useState({ loading: true });
  const [tab, setTab] = useState('clients');
  const [matterId, setMatterId] = useState(null);
  const [documentId, setDocumentId] = useState(null);
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
  function go(next) { setMatterId(null); setDocumentId(null); setTab(next); loadMatters(); }
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
  if (tab === 'new') {
    view = (
      <NewMatter
        onClose={() => go('clients')}
        onCreated={(id) => { setTab('clients'); loadMatters(); openMatter(id); }}
      />
    );
  } else if (documentId) {
    view = <Review documentId={documentId} onBack={() => { setDocumentId(null); loadMatters(); }} />;
  } else if (matterId) {
    view = <Matter matterId={matterId} onBack={backToQueue} onOpenDocument={setDocumentId} />;
  } else if (tab === 'documents') {
    view = <Documents onOpenDocument={setDocumentId} />;
  } else if (tab === 'templates') {
    view = <Templates />;
  } else if (tab === 'team') {
    view = <Team />;
  } else {
    view = (
      <Queue
        matters={matters}
        onOpenMatter={openMatter}
        onNewMatter={() => go('new')}
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
            {NAV.filter((n) => !n.ownerOnly || isOwner).map((n) => (
              <button
                key={n.key}
                className={onQueue && tab === n.key ? 'side-item-btn active' : 'side-item-btn'}
                onClick={() => go(n.key)}
              >
                <span className="side-item-label">{n.label}</span>
                {n.key === 'clients' && matters.length > 0 && (
                  <span className="side-count">{matters.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="side-foot">
            Signed off by a person, always.
            <br />
            <span className="powered">Powered by Orca Edge</span>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topnav">
          <div className="crumbs">
            {(matterId || documentId) ? (
              <>
                <button className="crumb-link" onClick={backToQueue}>Clients</button>
                <span className="crumb-sep">/</span>
                <span className="crumb-here">{documentId ? 'Document' : 'Client file'}</span>
              </>
            ) : (
              <span className="crumb-here">{TITLES[tab] || ''}</span>
            )}
          </div>

          {/* The navigation lives in the sidebar. Below the sidebar breakpoint
              it has nowhere to be, so it appears here instead. */}
          <nav className="topnav-tabs compact-only">
            {NAV.filter((n) => !n.ownerOnly || isOwner).map((n) => (
              <button
                key={n.key}
                className={onQueue && tab === n.key ? 'tab active' : 'tab'}
                onClick={() => go(n.key)}
              >
                {n.label}
              </button>
            ))}
          </nav>

          <div className="who">
            {onQueue && tab === 'clients' && (
              <button className="btn-primary btn-sm" onClick={() => go('new')}>New client</button>
            )}
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

    </div>
  );
}
