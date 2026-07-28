import React, { useState } from 'react';

// The client list.
//
// It used to open with four large cards stating four numbers, then the list said
// the same thing again underneath. The counts belong on the filters: they say how
// many are in each state and switch to them in one action, in a line rather than a
// screenful.

const STATUS_LABEL = {
  incomplete: 'Needs data',
  open: 'Ready',
  active: 'In progress',
  closed: 'Closed',
};

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'review', label: 'Awaiting review', match: (m) => (m.pending_documents || 0) > 0 },
  { key: 'incomplete', label: 'Needs data', match: (m) => m.status === 'incomplete' },
  { key: 'open', label: 'Ready', match: (m) => m.status === 'open' },
  { key: 'active', label: 'In progress', match: (m) => m.status === 'active' },
  { key: 'closed', label: 'Closed', match: (m) => m.status === 'closed' },
];

export default function Queue({ matters = [], onOpenMatter, onNewMatter }) {
  const [filter, setFilter] = useState('');

  const counts = {};
  for (const f of FILTERS) {
    counts[f.key] = f.match ? matters.filter(f.match).length : matters.length;
  }

  const active = FILTERS.find((f) => f.key === filter);
  const shown = active?.match ? matters.filter(active.match) : matters;

  if (matters.length === 0) {
    return (
      <div className="section">
        <div className="empty-hero">
          <div className="eh-icon">+</div>
          <h2>No clients yet</h2>
          <p>
            Enter a client's details once. Every document on that file then draws
            from the same record, with nothing typed twice.
          </p>
          <button className="btn-primary" onClick={onNewMatter}>Add client details</button>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="section-head">
        <div>
          <div className="section-title">Clients</div>
          <div className="section-hint">Sorted by what needs you first</div>
        </div>
      </div>

      <div className="filters">
        {FILTERS.map((f) => (
          counts[f.key] > 0 || f.key === '' ? (
            <button
              key={f.key}
              className={filter === f.key ? 'chip-btn on' : 'chip-btn'}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {counts[f.key] > 0 && <span className="chip-count">{counts[f.key]}</span>}
            </button>
          ) : null
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="panel-box"><p className="box-empty">Nothing in this state.</p></div>
      ) : (
        <div className="rows">
          {shown.map((m) => (
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
      )}
    </div>
  );
}
