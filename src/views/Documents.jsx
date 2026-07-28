import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

// Everything produced, across every client.
//
// This used to open with four large cards stating four numbers, and then the list
// beneath said the same thing again. The counts belong on the filters: they say
// how many are in each state and switch to them in one action.

const LABEL = (k) => String(k || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'in_review', label: 'Awaiting review', match: (d) => ['draft', 'in_review', 'changes_requested'].includes(d.status) },
  { key: 'approved', label: 'Signed off', match: (d) => d.status === 'approved' },
  { key: 'issued', label: 'Issued', match: (d) => d.status === 'issued' },
];

export default function Documents({ onOpenDocument }) {
  const [documents, setDocuments] = useState([]);
  const [scope, setScope] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetched once and filtered here, so a count can be shown for every state and
  // switching between them costs nothing.
  useEffect(() => {
    api.allDocuments()
      .then((d) => { setDocuments(d.documents || []); setScope(d.scope); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const counts = useMemo(() => {
    const out = {};
    for (const f of FILTERS) {
      out[f.key] = f.match ? documents.filter(f.match).length : documents.length;
    }
    return out;
  }, [documents]);

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter);
    return f?.match ? documents.filter(f.match) : documents;
  }, [documents, filter]);

  return (
    <div className="section">
      <div className="section-head">
        <div>
          <div className="section-title">Documents</div>
          <div className="section-hint">
            {scope === 'mine'
              ? 'Letters on your own clients, newest first'
              : 'Everything the firm has produced, newest first'}
          </div>
        </div>
      </div>

      <div className="filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? 'chip-btn on' : 'chip-btn'}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {counts[f.key] > 0 && <span className="chip-count">{counts[f.key]}</span>}
          </button>
        ))}
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <div className="notice err">{error}</div>}

      {!loading && shown.length === 0 && (
        <div className="panel-box">
          <p className="box-empty">
            {filter ? 'Nothing in this state.' : 'Nothing produced yet.'}
          </p>
        </div>
      )}

      {shown.length > 0 && (
        <div className="rows">
          {shown.map((d) => (
            <button key={d.id} className="row clickable" onClick={() => onOpenDocument(d.id)}>
              <div className="row-main">
                <strong>{d.client_name}</strong>
                <span className="row-sub">
                  {LABEL(d.doc_type)} · {d.reference} · v{d.current_version}
                  {d.approved_by ? ` · signed off by ${d.approved_by}` : ''}
                </span>
              </div>
              <div className="row-side">
                {d.open_blocking > 0 && (
                  <span className="badge blocking">{d.open_blocking} blocking</span>
                )}
                <span className="faint">
                  {new Date(d.created_at).toLocaleDateString('en-GB')}
                </span>
                <span className={`badge ${d.status}`}>{d.status.replace(/_/g, ' ')}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
