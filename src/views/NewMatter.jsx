import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

// Capture once, reuse for every document on the matter.
//
// The fields are not hard-coded here. They are the union of what the firm's
// templates declare they need, so adding a template tomorrow adds its fields
// to this form without anyone touching the code.

const GROUPS = [
  { key: 'client', title: 'Client', note: 'Identity and contact details. Typed rather than inferred, because these have to be exactly right.' },
  { key: 'matter', title: 'Matter', note: 'What the work is, and who is responsible for it.' },
  { key: 'engagement', title: 'Fees and dates', note: 'Every figure is confirmed by you here, so nothing is ever guessed downstream.' },
  { key: 'scope', title: 'Scope and context', note: 'The parts that genuinely differ each time. Drafted sections are grounded on this.' },
];

export default function NewMatter({ onClose, onCreated }) {
  const [schema, setSchema] = useState(null);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [values, setValues] = useState({});
  const [clientId, setClientId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    api.matterForm()
      .then((d) => {
        setSchema(d.schema || []);
        setUsers(d.users || []);
        setClients(d.clients || []);
        setTemplates(d.templates || []);
        // The person opening the matter is usually the one who took the call.
        setValues((v) => ({ ...v, fee_earner_name: d.me?.name || '' }));
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  const set = (k) => (e) => setValues({ ...values, [k]: e.target.value });

  // Selecting an existing client fills their details and locks them, so the
  // same person is never entered twice under two slightly different names.
  function pickClient(id) {
    setClientId(id);
    const c = clients.find((x) => String(x.id) === String(id));
    if (!c) return;
    setValues((v) => ({
      ...v,
      client_legal_name: c.legal_name,
      client_email: c.email || v.client_email || '',
      client_address: c.address || v.client_address || '',
      company_no: c.company_no || v.company_no || '',
    }));
  }

  const grouped = useMemo(() => {
    const out = {};
    for (const f of schema || []) {
      (out[f.group] = out[f.group] || []).push(f);
    }
    return out;
  }, [schema]);

  const required = ['client_legal_name', 'matter_type'];
  const ready = required.every((k) => String(values[k] || '').trim());
  const filled = (schema || []).filter((f) => String(values[f.key] || '').trim()).length;
  const total = (schema || []).length;

  async function create() {
    setBusy(true); setError(null);
    try {
      const d = await api.createMatter({
        values,
        clientId: clientId || undefined,
        assignedUserId: users.find((u) => u.name === values.fee_earner_name)?.id,
      });
      onCreated(d.matter.id);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  function renderField(f) {
    const v = values[f.key] || '';
    const common = { id: `f-${f.key}`, value: v, onChange: set(f.key) };

    let input;
    if (f.type === 'textarea') {
      input = <textarea rows={f.rows || 3} {...common} />;
    } else if (f.type === 'select') {
      input = (
        <select {...common}>
          <option value="">Choose…</option>
          {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    } else if (f.type === 'user') {
      input = (
        <select {...common}>
          <option value="">Choose…</option>
          {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
        </select>
      );
    } else if (f.type === 'date') {
      input = <input type="date" {...common} />;
    } else if (f.type === 'number') {
      input = (
        <div className="affixed">
          {f.prefix && <span className="affix">{f.prefix}</span>}
          <input type="text" inputMode="decimal" placeholder="0" {...common} />
          {f.suffix && <span className="affix">{f.suffix}</span>}
        </div>
      );
    } else {
      input = <input type={f.type === 'email' ? 'email' : 'text'} {...common} />;
    }

    const locked = clientId && ['client_legal_name'].includes(f.key);

    return (
      <div className={f.type === 'textarea' ? 'field span-2' : 'field'} key={f.key}>
        <label htmlFor={`f-${f.key}`}>
          <span>{f.label}</span>
        </label>
        {locked ? <input value={v} readOnly /> : input}
        {f.hint && <span className="prov">{f.hint}</span>}
        {!f.hint && f.usedBy?.length > 0 && (
          <span className="prov">Needed by {f.usedBy.join(', ')}</span>
        )}
      </div>
    );
  }

  return (
    <>
      <button className="back" onClick={onClose}>Back to queue</button>

      <div className="form-page">
        <div className="section-head">
          <div>
            <div className="section-title">Client details</div>
            <div className="section-hint">
              Entered once, reused by every document on this file. Nothing here is
              guessed, and no document generates while a required field is empty.
            </div>
          </div>
          {total > 0 && <span className="count">{filled} of {total}</span>}
        </div>

        {loadError && <div className="notice err">{loadError}</div>}
        {!schema && !loadError && <p className="muted">Loading the fields your templates need…</p>}

        {schema && templates.length === 0 && (
          <div className="notice warn">
            No templates yet, so only the basics are captured. Add a template and
            this page will ask for everything that template needs.
          </div>
        )}

        {schema && clients.length > 0 && (
          <div className="panel-box field returning-client">
            <label><span>Returning client</span></label>
            <select value={clientId} onChange={(e) => pickClient(e.target.value)}>
              <option value="">New client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.legal_name}</option>)}
            </select>
            <span className="prov">
              Picking someone already on file fills their details and keeps the name
              spelled the same way everywhere.
            </span>
          </div>
        )}

        {schema && GROUPS.map((g) => (
          grouped[g.key]?.length ? (
            <section className="panel-box form-group" key={g.key}>
              <div className="form-group-head">
                <div className="box-title">{g.title}</div>
                <span className="prov">{g.note}</span>
              </div>
              <div className="field-grid">
                {grouped[g.key].map(renderField)}
              </div>
            </section>
          ) : null
        ))}

        {error && <div className="notice err">{error}</div>}

        <div className="form-foot">
          <button className="btn-primary" disabled={busy || !ready} onClick={create}>
            {busy ? 'Saving…' : 'Save client details'}
          </button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          {!ready && (
            <span className="prov">The client's legal name and the type of work are the minimum.</span>
          )}
        </div>
      </div>
    </>
  );
}
