import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import Queue from './views/Queue.jsx';
import Matter from './views/Matter.jsx';
import Review from './views/Review.jsx';
import Templates from './views/Templates.jsx';

export default function App() {
  const [tab, setTab] = useState('queue');
  const [matterId, setMatterId] = useState(null);
  const [documentId, setDocumentId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [health, setHealth] = useState(null);

  useEffect(() => { api.health().then(setHealth).catch(() => {}); }, []);

  function openMatter(id) { setDocumentId(null); setMatterId(id); }
  function openDocument(id) { setDocumentId(id); }
  function backToQueue() { setMatterId(null); setDocumentId(null); }

  let view;
  if (documentId) {
    view = <Review documentId={documentId} onBack={() => setDocumentId(null)} />;
  } else if (matterId) {
    view = <Matter matterId={matterId} onBack={backToQueue} onOpenDocument={openDocument} />;
  } else if (tab === 'templates') {
    view = <Templates />;
  } else {
    view = <Queue onOpenMatter={openMatter} onNewMatter={() => setShowNew(true)} />;
  }

  return (
    <div className="wrap wide">
      <header className="app-head">
        <div>
          <p className="eyebrow">Orca Edge &middot; Tool 2</p>
          <h1 className="app-title">Document Engine</h1>
        </div>
        <nav className="tabs">
          <button
            className={!matterId && !documentId && tab === 'queue' ? 'tab active' : 'tab'}
            onClick={() => { backToQueue(); setTab('queue'); }}
          >
            Queue
          </button>
          <button
            className={!matterId && !documentId && tab === 'templates' ? 'tab active' : 'tab'}
            onClick={() => { backToQueue(); setTab('templates'); }}
          >
            Templates
          </button>
        </nav>
      </header>

      {health && !health.checks?.sessionSecretSet && (
        <div className="banner">
          Login is not built yet, so every request acts as the firm owner. Set
          SESSION_SECRET and build authentication before any real client data goes in.
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
