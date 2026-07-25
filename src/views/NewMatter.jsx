import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

// Two halves, because the two kinds of information fail differently.
//
// Hard facts are typed. A legal name or a postcode has to be exactly right, and
// typing it takes seconds, so having a model guess at it adds risk for nothing.
//
// Everything else is written or dictated as prose, the way the fee earner would
// describe the call to a colleague. The system reads that and pulls out what a
// document needs, showing the words it relied on for each value.

const TYPED_GROUPS = [
  { key: 'client', title: 'Client', note: 'Exactly as it should appear on a document.' },
  { key: 'matter', title: 'The work', note: 'What this file is, and who is handling it.' },
];

export default function NewMatter({ onClose, onCreated }) {
  const [typed, setTypedFields] = useState(null);
  const [extractable, setExtractable] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [values, setValues] = useState({});
  const [clientId, setClientId] = useState('');
  const [narrative, setNarrative] = useState('');
  const [reading, setReading] = useState(false);
  const [readResult, setReadResult] = useState(null);
  const [provenance, setProvenance] = useState({});

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    api.matterForm()
      .then((d) => {
        setTypedFields(d.typed || []);
        setExtractable(d.extracted || []);
        setUsers(d.users || []);
        setClients(d.clients || []);
        setTemplates(d.templates || []);
        setValues((v) => ({ ...v, fee_earner_name: d.me?.name || '' }));
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  const set = (k) => (e) => {
    setValues({ ...values, [k]: e.target.value });
    // A value a person edits by hand is theirs now, not the system's reading.
    if (provenance[k]) {
      const next = { ...provenance };
      delete next[k];
      setProvenance(next);
    }
  };

  function pickClient(id) {
    setClientId(id);
    const c = clients.find((x) => String(x.id) === String(id));
    if (!c) return;
    setValues((v) => ({
      ...v,
      client_legal_name: c.legal_name,
      client_email: c.email || v.client_email || '',
      client_phone: c.phone || v.client_phone || '',
      client_address: c.address || v.client_address || '',
    }));
  }

  async function readNotes() {
    setReading(true); setError(null); setReadResult(null);
    try {
      const d = await api.extractNotes({ narrative, values });
      const next = { ...values };
      const prov = { ...provenance };
      for (const f of d.found || []) {
        next[f.key] = f.value;
        prov[f.key] = f.quote;
      }
      setValues(next);
      setProvenance(prov);
      setReadResult(d);
    } catch (e) { setError(e.message); }
    setReading(false);
  }

  const typedGrouped = useMemo(() => {
    const out = {};
    for (const f of typed || []) (out[f.group] = out[f.group] || []).push(f);
    return out;
  }, [typed]);

  const ready = ['client_legal_name', 'matter_type'].every((k) => String(values[k] || '').trim());
  const captured = (extractable || []).filter((f) => String(values[f.key] || '').trim()).length;

  async function save() {
    setBusy(true); setError(null);
    try {
      const d = await api.createMatter({
        values, narrative, provenance,
        clientId: clientId || undefined,
        assignedUserId: users.find((u) => u.name === values.fee_earner_name)?.id,
      });
      onCreated(d.matter.id);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  function renderField(f, opts = {}) {
    const v = values[f.key] || '';
    const common = { id: `f-${f.key}`, value: v, onChange: set(f.key) };
    let input;

    if (f.type === 'textarea') input = <textarea rows={f.rows || 2} {...common} />;
    else if (f.type === 'select') {
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
    } else if (f.type === 'date') input = <input type="date" {...common} />;
    else if (f.type === 'number') {
      input = (
        <div className="affixed">
          {f.prefix && <span className="affix">{f.prefix}</span>}
          <input type="text" inputMode="decimal" placeholder="0" {...common} />
          {f.suffix && <span className="affix">{f.suffix}</span>}
        </div>
      );
    } else input = <input type={f.type === 'email' ? 'email' : 'text'} {...common} />;

    const quote = provenance[f.key];

    return (
      <div className={f.type === 'textarea' ? 'field span-2' : 'field'} key={f.key}>
        <label htmlFor={`f-${f.key}`}>
          <span>
            {f.label}
            {quote && <em className="from-notes">read from your notes</em>}
          </span>
        </label>
        {input}
        {quote && <span className="quote">“{quote}”</span>}
        {!quote && f.hint && opts.showHint !== false && <span className="prov">{f.hint}</span>}
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
              Entered once, reused by every document on this file.
            </div>
          </div>
        </div>

        {loadError && <div className="notice err">{loadError}</div>}
        {!typed && !loadError && <p className="muted">Loading…</p>}

        {typed && clients.length > 0 && (
          <div className="panel-box returning-client">
            <label><span>Already on file</span></label>
            <select value={clientId} onChange={(e) => pickClient(e.target.value)}>
              <option value="">Someone new</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.legal_name}</option>)}
            </select>
            <span className="prov">
              Picking someone already on file fills their details and keeps the name
              spelled the same way everywhere.
            </span>
          </div>
        )}

        {typed && TYPED_GROUPS.map((g) => (
          typedGrouped[g.key]?.length ? (
            <section className="panel-box form-group" key={g.key}>
              <div className="form-group-head">
                <div className="box-title">{g.title}</div>
                <span className="prov">{g.note}</span>
              </div>
              <div className="field-grid">{typedGrouped[g.key].map((f) => renderField(f))}</div>
            </section>
          ) : null
        ))}

        {/* The account of the call. This is where the real information lives. */}
        {typed && (
          <section className="panel-box notes-box">
            <div className="form-group-head">
              <div className="box-title">What was agreed on the call</div>
              <span className="prov">
                Write it the way you would tell a colleague. Fees, scope, what is
                excluded, dates, anything unusual. Do it now, while it is fresh.
              </span>
            </div>

            <textarea
              className="narrative"
              rows={9}
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder={'Spoke to the client this morning. Acting on the purchase of the freehold at\u2026 Agreed hourly at 280 plus VAT, capped at\u2026 Not covering the survey or tax advice. Wants to complete before\u2026'}
            />

            <div className="btn-row">
              <button
                className="btn-primary"
                disabled={reading || narrative.trim().length < 30}
                onClick={readNotes}
              >
                {reading ? 'Reading your notes…' : 'Read my notes'}
              </button>
              {extractable.length > 0 && (
                <span className="prov">
                  Looking for {captured} of {extractable.length} things your documents need
                </span>
              )}
            </div>
          </section>
        )}

        {/* What was found, and what was not. Both matter. */}
        {typed && (readResult || captured > 0) && extractable.length > 0 && (
          <section className="panel-box form-group">
            <div className="form-group-head">
              <div className="box-title">From your notes</div>
              <span className="prov">
                Check each one. Nothing was assumed: anything not clearly stated is
                left blank rather than guessed, and blank blocks generation.
              </span>
            </div>
            <div className="field-grid">
              {extractable.map((f) => renderField(f, { showHint: false }))}
            </div>

            {readResult?.unstated?.length > 0 && (
              <div className="unstated">
                <div className="box-title">Not mentioned</div>
                {readResult.unstated.map((u) => (
                  <div className="kv" key={u.key}>
                    <div>
                      <div className="kv-key">{u.label || u.key}</div>
                      <div className="prov">{u.why}</div>
                    </div>
                  </div>
                ))}
                <p className="prov">
                  Add these above, or say more in the notes and read them again.
                </p>
              </div>
            )}
          </section>
        )}

        {typed && templates.length === 0 && (
          <div className="notice warn">
            No documents uploaded yet, so nothing is being looked for beyond the
            basics. Add some on the Your documents tab.
          </div>
        )}

        {error && <div className="notice err">{error}</div>}

        {typed && (
          <div className="form-foot">
            <button className="btn-primary" disabled={busy || !ready} onClick={save}>
              {busy ? 'Saving…' : 'Save client details'}
            </button>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            {!ready && (
              <span className="prov">The client's legal name and the type of work are the minimum.</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
