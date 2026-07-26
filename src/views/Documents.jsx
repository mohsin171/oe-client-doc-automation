import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// Everything produced, across every client.
//
// Documents lived only inside the client file they belonged to, which meant a
// firm could never answer "what went out last month" or "what is sitting
// unapproved" without opening files one at a time.

const LABEL = (k) => String(k || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'in_review', label: 'Awaiting review' },
  { key: 'approved', label: 'Signed off' },
  { key: 'issued', label: 'Issued' },
];

export default function Documents({ onOpenDocument }) {
  const [documents, setDocuments] = useState([]);
  const [scope, setScope] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.allDocuments(filter)
      .then((d) => { setDocuments(d.documents || []); setScope(d.scope); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [filter]);

  const awaiting = documents.filter((d) => ['draft', 'in_review', 'changes_requested'].includes(d.status)).length;
  const issued = documents.filter((d) => d.status === 'issued').length;
  const blocking = documents.reduce((n, d) => n + (d.open_blocking || 0), 0);

  return (
    <>
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

        {!loading && documents.length > 0 && (
          <div className="stats">
            <div className={awaiting > 0 ? 'stat hero' : 'stat'}>
              <div className="stat-value">{awaiting}</div>
              <div className="stat-label">Awaiting a person</div>
              <div className="stat-note">Drafted, not yet signed off</div>
            </div>
            <div className="stat">
              <div className="stat-value">{blocking}</div>
              <div className="stat-label">Blocking flags</div>
              <div className="stat-note">Across all open drafts</div>
            </div>
            <div className="stat">
              <div className="stat-value">{issued}</div>
              <div className="stat-label">Issued</div>
              <div className="stat-note">Sent to a client</div>
            </div>
            <div className="stat">
              <div className="stat-value">{documents.length}</div>
              <div className="stat-label">In total</div>
              <div className="stat-note">Every version on record</div>
            </div>
          </div>
        )}
      </div>

      <div className="section">
        <div className="filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? 'chip-btn on' : 'chip-btn'}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <p className="muted">Loading…</p>}
        {error && <div className="notice err">{error}</div>}

        {!loading && documents.length === 0 && (
          <div className="panel-box">
            <p className="box-empty">
              {filter ? 'Nothing in this state.' : 'Nothing produced yet.'}
            </p>
          </div>
        )}

        {documents.length > 0 && (
          <div className="rows">
            {documents.map((d) => (
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
    </>
  );
}
