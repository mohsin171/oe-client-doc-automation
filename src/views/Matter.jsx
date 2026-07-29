import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const LABEL = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Matter({ matterId, onBack, onOpenDocument, onEdit, onRemoved }) {
  const [state, setState] = useState({ loading: true });
  const [documents, setDocuments] = useState([]);
  const [draft, setDraft] = useState({});
  const [extra, setExtra] = useState({});
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(false);

  async function load() {
    try {
      const d = await api.getMatter(matterId, 'full');
      const docs = await api.listDocuments(matterId);
      setState({ loading: false, ...d });
      setDocuments(docs.documents || []);
    } catch (e) { setState({ loading: false, error: e.message }); }
  }
  useEffect(() => { load(); }, [matterId]);

  if (state.loading) return <p className="muted">Loading…</p>;
  if (state.error) return <div className="notice err">{state.error}</div>;

  const {
    matter, fields = [], completeness = {}, templates = [], timeline = [],
    users = [], gaps = [], suggestions = [], access = [], canManageAccess = false,
  } = state;
  const missing = completeness.missing || [];
  const unconfirmed = completeness.unconfirmedNumbers || [];

  async function saveGaps() {
    setBusy('fields'); setError(null);
    try {
      await api.saveFields({ matterId, values: draft, source: 'manual_fix' });
      setDraft({});
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  }


  async function removeMatter() {
    setBusy('remove'); setError(null);
    try {
      await api.deleteMatter({ matterId });
      onRemoved();
    } catch (e) {
      setError(e.message);
      setRemoving(false);
    }
    setBusy(null);
  }

  async function changeAccess(fn) {
    setBusy('access'); setError(null);
    try { await fn(); await load(); } catch (e) { setError(e.message); }
    setBusy(null);
  }

  async function saveExtra() {
    setBusy('extra'); setError(null);
    try {
      await api.saveFields({ matterId, values: extra, source: 'manual_fix' });
      setExtra({});
      setAdding(false);
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  async function confirmNumber(key) {
    setBusy(key);
    try { await api.saveFields({ matterId, confirm: [key] }); await load(); }
    catch (e) { setError(e.message); }
    setBusy(null);
  }

  async function generate(templateId) {
    setBusy('generate'); setError(null);
    try {
      const d = await api.generate({ matterId, templateId });
      onOpenDocument(d.documentId);
    } catch (e) {
      const bits = [];
      if (e.detail?.missing?.length) bits.push(`missing ${e.detail.missing.join(', ')}`);
      if (e.detail?.unconfirmedNumbers?.length) bits.push(`unconfirmed ${e.detail.unconfirmedNumbers.join(', ')}`);
      if (e.detail?.unresolved?.length) bits.push(`unresolved ${e.detail.unresolved.map((u) => u.field).join(', ')}`);
      setError(bits.length
        ? `This cannot be generated yet: ${bits.join('; ')}.`
        : e.message);
    }
    setBusy(null);
  }

  return (
    <>
      <button className="back" onClick={onBack}>Back to queue</button>

      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">{matter.client_name}</div>
            <div className="section-hint">
              {matter.reference} · {matter.matter_type}
              {matter.assigned_name ? ` · ${matter.assigned_name}` : ''}
            </div>
          </div>
          <span className={`badge ${matter.status}`}>{matter.status.replace(/_/g, ' ')}</span>
        </div>

        <div className={completeness.canGenerate ? 'gate ok' : 'gate blocked'}>
          <strong>{completeness.captured} of {completeness.total} captured.</strong>{' '}
          {completeness.canGenerate
            ? 'Record complete. Documents can be generated.'
            : 'Generation stays blocked until the gaps close. Nothing is guessed on your behalf.'}
        </div>

        <div className="panel-box">
          <div className="record-head">
            <div className="box-title">Matter record</div>
            <button className="btn btn-sm" onClick={onEdit}>Edit this file</button>
          </div>

          {fields.map((f) => (
            <div className="kv" key={f.key}>
              <div>
                <div className="kv-key">{LABEL(f.key)}</div>
                <div className="kv-val">{f.value}</div>
                {f.provenance && <div className="prov">{f.provenance}</div>}
              </div>
              {f.is_numeric && !f.confirmed_at && (
                <button className="btn btn-sm" disabled={busy === f.key} onClick={() => confirmNumber(f.key)}>
                  Confirm figure
                </button>
              )}
            </div>
          ))}

          {missing.length > 0 && (
            <div className="gaps">
              <div className="box-title">{missing.length} still needed from you</div>
              <div className="field-grid">
                {missing.map((k) => {
                  const meta = gaps.find((g) => g.key === k) || { key: k, label: LABEL(k), type: 'text' };
                  const val = draft[k] || '';
                  const on = (e) => setDraft({ ...draft, [k]: e.target.value });
                  let input;

                  if (meta.type === 'user') {
                    input = (
                      <select value={val} onChange={on}>
                        <option value="">Choose…</option>
                        {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                      </select>
                    );
                  } else if (meta.type === 'select') {
                    input = (
                      <select value={val} onChange={on}>
                        <option value="">Choose…</option>
                        {(meta.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    );
                  } else if (meta.type === 'date') {
                    input = <input type="date" value={val} onChange={on} />;
                  } else if (meta.type === 'textarea') {
                    input = <textarea rows={meta.rows || 3} value={val} onChange={on} />;
                  } else if (meta.type === 'number') {
                    input = (
                      <div className="affixed">
                        {meta.prefix && <span className="affix">{meta.prefix}</span>}
                        <input type="text" inputMode="decimal" value={val} onChange={on} placeholder="0" />
                        {meta.suffix && <span className="affix">{meta.suffix}</span>}
                      </div>
                    );
                  } else {
                    input = <input value={val} onChange={on} placeholder={`Enter ${meta.label.toLowerCase()}`} />;
                  }

                  return (
                    <div className={meta.type === 'textarea' ? 'field span-2' : 'field'} key={k}>
                      <label><span>{meta.label}</span></label>
                      {input}
                      {meta.hint && <span className="prov">{meta.hint}</span>}
                    </div>
                  );
                })}
              </div>
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
            <p className="muted" style={{ marginTop: 14 }}>
              Figures always need confirming before generation, whatever the source.
            </p>
          )}

          {/* A record is not only what a document demands. An estimate matters
              even when the fee paragraph is prose rather than a merge line. */}
          {suggestions.length > 0 && (
            <div className="optional-facts">
              {!adding ? (
                <button className="link-btn" onClick={() => setAdding(true)}>
                  Add something else to this file
                </button>
              ) : (
                <>
                  <div className="box-title">Anything else worth recording</div>
                  <p className="prov">
                    None of these are required, and leaving one blank will never block
                    a document. They are here because a file is worth more than the
                    minimum a template happens to ask for.
                  </p>
                  <div className="field-grid">
                    {suggestions.map((meta) => {
                      const val = extra[meta.key] || '';
                      const on = (e) => setExtra({ ...extra, [meta.key]: e.target.value });
                      let input;

                      if (meta.type === 'user') {
                        input = (
                          <select value={val} onChange={on}>
                            <option value="">Choose…</option>
                            {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                          </select>
                        );
                      } else if (meta.type === 'select') {
                        input = (
                          <select value={val} onChange={on}>
                            <option value="">Choose…</option>
                            {(meta.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        );
                      } else if (meta.type === 'date') {
                        input = <input type="date" value={val} onChange={on} />;
                      } else if (meta.type === 'textarea') {
                        input = <textarea rows={meta.rows || 2} value={val} onChange={on} />;
                      } else if (meta.type === 'number') {
                        input = (
                          <div className="affixed">
                            {meta.prefix && <span className="affix">{meta.prefix}</span>}
                            <input type="text" inputMode="decimal" value={val} onChange={on} placeholder="0" />
                            {meta.suffix && <span className="affix">{meta.suffix}</span>}
                          </div>
                        );
                      } else {
                        input = <input value={val} onChange={on} />;
                      }

                      return (
                        <div className={meta.type === 'textarea' ? 'field span-2' : 'field'} key={meta.key}>
                          <label><span>{meta.label}</span></label>
                          {input}
                          {meta.hint && <span className="prov">{meta.hint}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="btn-row">
                    <button
                      className="btn-primary"
                      disabled={busy === 'extra' || Object.values(extra).every((v) => !String(v).trim())}
                      onClick={saveExtra}
                    >
                      {busy === 'extra' ? 'Saving…' : 'Save'}
                    </button>
                    <button className="btn-ghost" onClick={() => { setAdding(false); setExtra({}); }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {error && <div className="notice err">{error}</div>}

      <div className="section">
        <div className="section-head">
          <div className="section-title">Documents</div>
          <div className="section-hint">Every version, and who signed it off</div>
        </div>

        {documents.length === 0 ? (
          <div className="panel-box"><p className="box-empty">Nothing produced on this matter yet.</p></div>
        ) : (
          <div className="rows">
            {documents.map((d) => (
              <button key={d.id} className="row clickable" onClick={() => onOpenDocument(d.id)}>
                <div className="row-main">
                  <strong>{LABEL(d.doc_type)}</strong>
                  <span className="row-sub">
                    Version {d.current_version} · {new Date(d.created_at).toLocaleDateString('en-GB')}
                    {d.created_by_name ? ` · ${d.created_by_name}` : ''}
                  </span>
                </div>
                <div className="row-side">
                  {d.open_blocking > 0 && <span className="badge blocking">{d.open_blocking} blocking</span>}
                  <span className={`badge ${d.status}`}>{d.status.replace(/_/g, ' ')}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* One row per letter, each saying what it needs. A closing letter can be ready
            on a file where an engagement letter is not, and one answer for the whole
            matter hid that. */}
        <div className="letters">
          {templates.map((t) => {
            const n = t.needs || {};
            const ready = n.ready !== false;
            return (
              <div className={ready ? 'letter-option ready' : 'letter-option'} key={t.id}>
                <div className="letter-option-main">
                  <strong>{t.name}</strong>
                  <span className="row-sub">
                    {ready
                      ? (t.intro?.hint || 'Everything needed is on file.')
                      : `Needs ${n.need.map((f) => f.label.toLowerCase()).join(', ')}`}
                  </span>
                  {ready && n.recheck?.length > 0 && (
                    <span className="letter-recheck">
                      Worth rechecking:{' '}
                      {n.recheck.map((r) => `${r.label.toLowerCase()} ${r.value}`).join(', ')}
                    </span>
                  )}
                </div>
                <div className="letter-option-side">
                  {n.note === 'essential' && <span className="badge in_review">needs a note</span>}
                  {n.canDrawOnHistory && <span className="badge approved">from the file</span>}
                  <button
                    className={ready ? 'btn-primary btn-sm' : 'btn btn-sm'}
                    disabled={!ready || busy === 'generate'}
                    onClick={() => generate(t.id)}
                  >
                    {busy === 'generate' ? 'Writing…' : 'Write it'}
                  </button>
                </div>
              </div>
            );
          })}
          {templates.length === 0 && (
            <p className="muted">No letters yet. Add some on Your letters.</p>
          )}
        </div>
      </div>

      {canManageAccess && (
        <div className="section">
          <div className="section-head">
            <div className="section-title">Who can see this file</div>
            <div className="section-hint">
              Assigned to one person. Add a colleague for cover so time off does
              not freeze the work.
            </div>
          </div>

          <div className="panel-box">
            <div className="field">
              <label><span>Handled by</span></label>
              <select
                value={users.find((u) => u.name === matter.assigned_name)?.id || ''}
                disabled={busy === 'access'}
                onChange={(e) => changeAccess(() => api.reassign(matterId, Number(e.target.value)))}
              >
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            {access.length > 0 && (
              <div className="rows" style={{ marginBottom: 14 }}>
                {access.map((a) => (
                  <div className="row" key={a.user_id}>
                    <div className="row-main">
                      <strong>{a.name}</strong>
                      <span className="row-sub">Added for cover</span>
                    </div>
                    <div className="row-side">
                      <button
                        className="btn-ghost"
                        disabled={busy === 'access'}
                        onClick={() => changeAccess(() => api.revokeAccess(matterId, a.user_id))}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {users.filter((u) => u.name !== matter.assigned_name
                && !access.some((a) => a.user_id === u.id)).length > 0 && (
              <div className="field">
                <label><span>Give someone else access</span></label>
                <select
                  value=""
                  disabled={busy === 'access'}
                  onChange={(e) => e.target.value
                    && changeAccess(() => api.grantAccess(matterId, Number(e.target.value)))}
                >
                  <option value="">Choose a colleague…</option>
                  {users
                    .filter((u) => u.name !== matter.assigned_name
                      && !access.some((a) => a.user_id === u.id))
                    .map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {canManageAccess && (
        <div className="section danger-zone">
          {!removing ? (
            <button className="btn-ghost danger" onClick={() => setRemoving(true)}>
              Remove this client
            </button>
          ) : (
            <>
              <div className="box-title">Remove {matter.client_name}?</div>
              <p className="prov">
                The file, its record and any draft go. Letters that went to the client
                cannot be removed, and if there are any this will be refused: closing
                the file takes it off the list and keeps the history.
              </p>
              <div className="btn-row">
                <button className="btn danger" disabled={busy === 'remove'} onClick={removeMatter}>
                  {busy === 'remove' ? 'Removing…' : 'Yes, remove it'}
                </button>
                <button className="btn-ghost" onClick={() => setRemoving(false)}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {timeline.length > 0 && (
        <div className="section">
          <div className="section-head">
            <div className="section-title">Timeline</div>
            <div className="section-hint">The audit trail for this file</div>
          </div>
          <div className="panel-box">
            {timeline.map((e) => (
              <div className="timeline-row" key={e.id}>
                <span className="timeline-kind">{e.kind.replace(/_/g, ' ')}</span>
                <span className="faint">
                  {e.actor_name || 'system'} · {new Date(e.created_at).toLocaleString('en-GB')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
