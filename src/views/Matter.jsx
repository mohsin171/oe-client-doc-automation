import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const LABEL = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Matter({ matterId, onBack, onOpenDocument }) {
  const [state, setState] = useState({ loading: true });
  const [documents, setDocuments] = useState([]);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const d = await api.getMatter(matterId, 'full');
      const docs = await api.listDocuments(matterId);
      setState({ loading: false, ...d });
      setDocuments(docs.documents || []);
    } catch (e) {
      setState({ loading: false, error: e.message });
    }
  }

  useEffect(() => { load(); }, [matterId]);

  if (state.loading) return <p className="muted">Loading…</p>;
  if (state.error) return <p className="err">{state.error}</p>;

  const { matter, fields = [], completeness = {}, templates = [], timeline = [] } = state;
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const missing = completeness.missing || [];
  const unconfirmed = completeness.unconfirmedNumbers || [];

  async function saveGaps() {
    setBusy('fields');
    setError(null);
    try {
      const d = await api.saveFields({ matterId, values: draft, source: 'manual_fix' });
      setDraft({});
      setState((s) => ({ ...s, fields: d.fields, completeness: d.completeness }));
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(null);
  }

  async function confirmNumber(key) {
    setBusy(key);
    try {
      const d = await api.saveFields({ matterId, confirm: [key] });
      setState((s) => ({ ...s, fields: d.fields, completeness: d.completeness }));
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  async function generate(templateId) {
    setBusy('generate');
    setError(null);
    try {
      const d = await api.generate({ matterId, templateId });
      onOpenDocument(d.documentId);
    } catch (e) {
      if (e.detail?.reason === 'incomplete') {
        const bits = [];
        if (e.detail.missing?.length) bits.push(`missing: ${e.detail.missing.join(', ')}`);
        if (e.detail.unconfirmedNumbers?.length) bits.push(`unconfirmed: ${e.detail.unconfirmedNumbers.join(', ')}`);
        if (e.detail.unresolved?.length) {
          bits.push(`unresolved: ${e.detail.unresolved.map((u) => u.field).join(', ')}`);
        }
        setError(`This document cannot be generated yet. ${bits.join('. ')}`);
      } else {
        setError(e.message);
      }
    }
    setBusy(null);
  }

  return (
    <div>
      <button className="link-back" onClick={onBack}>Back to queue</button>

      <div className="row-between">
        <div>
          <h2 className="view-title">{matter.client_name}</h2>
          <p className="muted small">
            {matter.reference} · {matter.matter_type}
            {matter.assigned_name ? ` · ${matter.assigned_name}` : ''}
          </p>
        </div>
        <span className={`tag tag-${matter.status}`}>{matter.status}</span>
      </div>

      {/* Completeness gate, shown as plain arithmetic */}
      <div className={`card ${completeness.canGenerate ? 'card-ok' : 'card-warn'}`}>
        <div className="card-head">
          <h3>Matter record</h3>
          <span className="pill pill-wait">
            {completeness.captured} of {completeness.total} captured
          </span>
        </div>

        {completeness.canGenerate ? (
          <p className="small">Record complete. Documents can be generated.</p>
        ) : (
          <p className="small">
            Generation is blocked until the gaps are closed. Nothing is guessed on your behalf.
          </p>
        )}

        <div className="fields">
          {fields.map((f) => (
            <div key={f.key} className="field-row">
              <div>
                <strong>{LABEL(f.key)}</strong>
                <span className="field-value">{f.value}</span>
                {f.provenance && <span className="hint">{f.provenance}</span>}
              </div>
              {f.is_numeric && !f.confirmed_at && (
                <button
                  className="btn-small"
                  disabled={busy === f.key}
                  onClick={() => confirmNumber(f.key)}
                >
                  Confirm figure
                </button>
              )}
            </div>
          ))}
        </div>

        {missing.length > 0 && (
          <div className="gaps">
            <p className="small"><strong>{missing.length} still needed from you</strong></p>
            {missing.map((k) => (
              <label key={k} className="gap-input">
                <span>{LABEL(k)}</span>
                <input
                  value={draft[k] || ''}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                  placeholder={`Enter ${LABEL(k).toLowerCase()}`}
                />
              </label>
            ))}
            <button
              className="btn-primary"
              disabled={busy === 'fields' || Object.keys(draft).length === 0}
              onClick={saveGaps}
            >
              {busy === 'fields' ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}

        {unconfirmed.length > 0 && (
          <p className="small warn">
            Figures always need confirming before generation, whatever the source.
          </p>
        )}
      </div>

      {error && <p className="err">{error}</p>}

      {/* Documents */}
      <div className="card">
        <div className="card-head"><h3>Documents</h3></div>

        {documents.length === 0 && <p className="muted small">Nothing produced on this matter yet.</p>}

        <div className="list">
          {documents.map((d) => (
            <button key={d.id} className="list-row" onClick={() => onOpenDocument(d.id)}>
              <div className="list-main">
                <strong>{LABEL(d.doc_type)}</strong>
                <span className="muted small">
                  Version {d.current_version} · {new Date(d.created_at).toLocaleDateString('en-GB')}
                </span>
              </div>
              <div className="list-side">
                {d.open_blocking > 0 && <span className="tag tag-attention">{d.open_blocking} blocking</span>}
                <span className={`tag tag-${d.status}`}>{d.status.replace(/_/g, ' ')}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="generate-row">
          {templates.map((t) => (
            <button
              key={t.id}
              className="btn-secondary"
              disabled={!completeness.canGenerate || busy === 'generate'}
              onClick={() => generate(t.id)}
            >
              {busy === 'generate' ? 'Generating…' : `Generate ${t.name}`}
            </button>
          ))}
          {templates.length === 0 && (
            <p className="muted small">No templates yet. Add one on the Templates tab.</p>
          )}
        </div>
      </div>

      {/* Audit timeline */}
      {timeline.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>Timeline</h3></div>
          <div className="timeline">
            {timeline.map((e) => (
              <div key={e.id} className="timeline-row">
                <span className="timeline-kind">{e.kind.replace(/_/g, ' ')}</span>
                <span className="muted small">
                  {e.actor_name || 'system'} · {new Date(e.created_at).toLocaleString('en-GB')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
