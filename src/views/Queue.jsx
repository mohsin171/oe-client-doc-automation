import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// The landing screen is a queue, not a dashboard of charts. A fee earner
// opening this at nine in the morning needs to know what is waiting for them.

const STATUS_LABEL = {
  incomplete: 'Needs data',
  open: 'Ready',
  active: 'In progress',
  closed: 'Closed',
};

export default function Queue({ onOpenMatter, onNewMatter }) {
  const [state, setState] = useState({ loading: true, matters: [], me: null });

  useEffect(() => {
    api.listMatters()
      .then((d) => setState({ loading: false, ...d }))
      .catch((e) => setState({ loading: false, error: e.message, matters: [] }));
  }, []);

  const { matters = [], me } = state;
  const needsData = matters.filter((m) => m.status === 'incomplete').length;
  const inReview = matters.reduce((n, m) => n + (m.pending_documents || 0), 0);

  return (
    <div>
      <div className="row-between">
        <div>
          <h2 className="view-title">Your queue</h2>
          {me && <p className="muted small">{me.name} · {me.role} · {me.firm}</p>}
        </div>
        <button className="btn-primary" onClick={onNewMatter}>New matter</button>
      </div>

      {!state.loading && matters.length > 0 && (
        <div className="summary-strip">
          <span><strong>{needsData}</strong> needing data</span>
          <span><strong>{inReview}</strong> awaiting review</span>
          <span><strong>{matters.length}</strong> matters</span>
        </div>
      )}

      {state.loading && <p className="muted">Loading…</p>}
      {state.error && <p className="err">{state.error}</p>}

      {!state.loading && matters.length === 0 && (
        <div className="empty">
          <p>No matters yet.</p>
          <p className="muted small">
            Open one to capture the client details and start producing documents.
          </p>
        </div>
      )}

      <div className="list">
        {matters.map((m) => (
          <button key={m.id} className="list-row" onClick={() => onOpenMatter(m.id)}>
            <div className="list-main">
              <strong>{m.client_name}</strong>
              <span className="muted small">
                {m.reference} · {m.matter_type}
                {m.assigned_name ? ` · ${m.assigned_name}` : ''}
              </span>
            </div>
            <div className="list-side">
              {m.pending_documents > 0 && (
                <span className="tag tag-attention">{m.pending_documents} to review</span>
              )}
              <span className={`tag tag-${m.status}`}>{STATUS_LABEL[m.status] || m.status}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
