import React from 'react';

// The landing screen is a queue of what needs a person, not a wall of charts.
// The stats exist because an owner wants them, but the list is the product.

const STATUS_LABEL = {
  incomplete: 'Needs data',
  open: 'Ready',
  active: 'In progress',
  closed: 'Closed',
};

export default function Queue({ matters = [], me, onOpenMatter, onNewMatter }) {
  const needsData = matters.filter((m) => m.status === 'incomplete').length;
  const awaitingReview = matters.reduce((n, m) => n + (m.pending_documents || 0), 0);
  const live = matters.filter((m) => m.status !== 'closed').length;

  if (matters.length === 0) {
    return (
      <div className="section">
        <div className="empty-hero">
          <div className="eh-icon">+</div>
          <h2>No matters yet</h2>
          <p>
            Open a matter to capture the client details once. Every document on
            that file then draws from the same record, with no re-entry.
          </p>
          <button className="btn-primary" onClick={onNewMatter}>Open a matter</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">Your queue</div>
            <div className="section-hint">
              {me ? `${me.name}, ` : ''}here is what is waiting on you.
            </div>
          </div>
          <button className="btn-primary" onClick={onNewMatter}>New matter</button>
        </div>

        <div className="stats">
          <div className={awaitingReview > 0 ? 'stat hero' : 'stat'}>
            <div className="stat-value">{awaitingReview}</div>
            <div className="stat-label">Awaiting review</div>
            <div className="stat-note">Drafts needing a person</div>
          </div>
          <div className="stat">
            <div className="stat-value">{needsData}</div>
            <div className="stat-label">Needing data</div>
            <div className="stat-note">Blocked until the gaps close</div>
          </div>
          <div className="stat">
            <div className="stat-value">{live}</div>
            <div className="stat-label">Live matters</div>
            <div className="stat-note">Open or in progress</div>
          </div>
          <div className="stat">
            <div className="stat-value">{matters.length}</div>
            <div className="stat-label">All matters</div>
            <div className="stat-note">Including closed</div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <div className="section-title">Matters</div>
          <div className="section-hint">Sorted by what needs attention first</div>
        </div>

        <div className="rows">
          {matters.map((m) => (
            <button key={m.id} className="row clickable" onClick={() => onOpenMatter(m.id)}>
              <div className="row-main">
                <strong>{m.client_name}</strong>
                <span className="row-sub">
                  {m.reference} · {m.matter_type}
                  {m.assigned_name ? ` · ${m.assigned_name}` : ''}
                </span>
              </div>
              <div className="row-side">
                {m.pending_documents > 0 && (
                  <span className="badge in_review">{m.pending_documents} to review</span>
                )}
                <span className={`badge ${m.status}`}>{STATUS_LABEL[m.status] || m.status}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
