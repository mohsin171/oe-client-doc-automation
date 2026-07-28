import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

// Three steps, because the information arrives in three distinct ways.
//
// Who they are is typed, since a legal name or a postcode has to be exact.
// What was agreed is written as prose, the way you would tell a colleague.
// What was read back is checked, because nothing should be accepted unseen.
//
// One long page hid that structure behind four identical grey boxes. Splitting
// it makes each part obviously finishable, and makes the notes a moment rather
// than one field among many.

const STEPS = [
  { key: 'who', title: 'Client' },
  { key: 'call', title: 'The call' },
  { key: 'check', title: 'Check' },
];

export default function NewMatter({ matterId, onClose, onCreated }) {
  // One form for both: opening a client and correcting one. Editing a fee or a
  // scope without being able to see the notes it was read from is editing the
  // answer while leaving the working wrong, so the whole form reopens.
  const isEdit = Boolean(matterId);
  const [step, setStep] = useState(0);
  const [typed, setTypedFields] = useState(null);
  const [extractable, setExtractable] = useState([]);
  const [users, setUsers] = useState([]);
  const [me, setMe] = useState(null);
  const [clients, setClients] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [values, setValues] = useState({});
  const [clientId, setClientId] = useState('');
  const [narrative, setNarrative] = useState('');
  const [provenance, setProvenance] = useState({});
  const [readResult, setReadResult] = useState(null);

  const [reading, setReading] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    Promise.all([api.matterForm(), isEdit ? api.getMatter(matterId) : null])
      .then(([d, existing]) => {
        setTypedFields(d.typed || []);
        setExtractable(d.extracted || []);
        setUsers(d.users || []);
        setMe(d.me || null);
        setClients(d.clients || []);
        setTemplates(d.templates || []);
        if (existing) {
          // Opened with what is on record, so a correction is an edit rather than a
          // re-entry, and nothing already captured is quietly lost by omission.
          const onFile = {};
          for (const f of existing.fields || []) onFile[f.key] = f.value;
          setValues({
            fee_earner_name: d.me?.name || '',
            supervisor_name: d.me?.name || '',
            ...onFile,
            client_legal_name: onFile.client_legal_name || existing.matter?.client_name || '',
            matter_type: onFile.matter_type || existing.matter?.matter_type || '',
          });
          setNarrative(existing.narrative || '');
        } else {
          setValues((v) => ({
            ...v,
            fee_earner_name: d.me?.name || '',
            supervisor_name: d.me?.name || '',
          }));
        }
      })
      .catch((e) => setLoadError(e.message));
  }, [matterId]);

  const set = (k) => (e) => {
    setValues({ ...values, [k]: e.target.value });
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

  // A firm has to know whether it already acts for the other side. An employee
  // who can only see their own clients cannot answer that, so this answers it
  // for them: how many matches, and nothing else. No file, no colleague, no
  // detail that would breach the confidence of another client.
  async function checkConflict() {
    const name = String(values.client_legal_name || '').trim();
    if (name.length < 3) { setConflict(null); return; }
    try {
      const d = await api.conflictCheck(name);
      setConflict(d.matches);
    } catch (_) { setConflict(null); }
  }

  async function readNotes() {
    setReading(true); setError(null);
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
      setStep(2);
    } catch (e) { setError(e.message); }
    setReading(false);
  }

  async function save() {
    setBusy(true); setError(null);
    try {
      if (isEdit) {
        await api.updateMatter({ matterId, values, narrative, provenance });
        onCreated(matterId);
        setBusy(false);
        return;
      }
      const d = await api.createMatter({
        values, narrative, provenance,
        clientId: clientId || undefined,
        assignedUserId: users.find((u) => u.name === values.fee_earner_name)?.id,
      });
      onCreated(d.matter.id);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  const identity = useMemo(
    () => (typed || []).filter((f) => f.group === 'client'),
    [typed]
  );
  const work = useMemo(
    () => (typed || []).filter((f) => f.group !== 'client'),
    [typed]
  );

  const canLeaveWho = ['client_legal_name', 'matter_type'].every((k) => String(values[k] || '').trim());
  const filledExtract = (extractable || []).filter((f) => String(values[f.key] || '').trim()).length;

  function field(f, opts = {}) {
    const v = values[f.key] || '';
    const common = { id: `f-${f.key}`, value: v, onChange: set(f.key) };
    let input;

    if (f.type === 'textarea') input = <textarea rows={f.rows || 2} placeholder={f.placeholder || ''} {...common} />;
    else if (f.type === 'select') {
      input = (
        <select {...common}>
          <option value="">Choose…</option>
          {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    } else if (f.auto === 'signed_in') {
      // Taken from who is signed in, and shown so it is never a surprise.
      return (
        <div className="field assigned" key={f.key}>
          <label><span>{f.label}</span></label>
          <div className="assigned-to">
            <span className="who-dot" aria-hidden="true">{(me?.name || '?').charAt(0)}</span>
            <span>{me?.name || '—'}</span>
            <em>you</em>
          </div>
        </div>
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
            {quote && <em className="from-notes">from your notes</em>}
          </span>
        </label>
        {input}
        {quote && <span className="quote">“{quote}”</span>}
        {!quote && f.hint && opts.hints !== false && <span className="prov">{f.hint}</span>}
      </div>
    );
  }

  if (loadError) return <div className="notice err">{loadError}</div>;
  if (!typed) return <p className="muted">Loading…</p>;

  return (
    <div className="wizard">
      <ol className="steps" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            className={`stepdot ${i === step ? 'now' : ''} ${i < step ? 'done' : ''}`}
          >
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              aria-current={i === step ? 'step' : undefined}
            >
              <span className="stepnum">{i < step ? '✓' : i + 1}</span>
              <span className="steplabel">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="wizard-body" key={step}>
        <h2 className="wizard-head">
          {STEPS[step].title}
          {isEdit && <span className="wizard-editing">correcting an existing file</span>}
        </h2>

        {step === 0 && (
          <>
            {clients.length > 0 && (
              <div className="field">
                <label><span>Already on file</span></label>
                <select value={clientId} onChange={(e) => pickClient(e.target.value)}>
                  <option value="">Someone new</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.legal_name}</option>)}
                </select>
              </div>
            )}

            <div className="field-grid">{identity.map((f) => field(f))}</div>

            {conflict !== null && (
              <div className={conflict > 0 ? 'notice warn' : 'notice info'}>
                {conflict > 0
                  ? `The firm already acts for ${conflict} client${conflict > 1 ? 's' : ''} by this name. Check for a conflict before going further.`
                  : 'No existing client by that name.'}
              </div>
            )}

            {work.length > 0 && (
              <>
                <div className="wizard-sub">The work</div>
                <div className="field-grid">{work.map((f) => field(f))}</div>
              </>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <textarea
              className="narrative"
              rows={12}
              autoFocus
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder={'Spoke to the client this morning. Acting on\u2026 Agreed hourly at\u2026 Not covering\u2026 Wants to complete before\u2026'}
            />
            <p className="prov">
              Fees, scope, exclusions, dates, anything unusual.
            </p>
          </>
        )}

        {step === 2 && (
          <>
            {extractable.length > 0 ? (
              <>
                <div className="readout">
                  <strong>{filledExtract} of {extractable.length}</strong> found in your notes
                </div>
                <div className="field-grid">{extractable.map((f) => field(f, { hints: false }))}</div>

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
                    <p className="prov">Fill these above, or leave them for later.</p>
                  </div>
                )}
              </>
            ) : (
              <p className="muted">
                No letters uploaded yet, so nothing is being looked for beyond the basics.
              </p>
            )}


          </>
        )}

        {error && <div className="notice err">{error}</div>}

        <div className="wizard-foot">
          {step === 0 && (
            <>
              <button
                className="btn-primary"
                disabled={!canLeaveWho}
                onClick={async () => { await checkConflict(); setStep(1); }}
              >
                Continue
              </button>
              <button className="btn" onClick={checkConflict} disabled={!String(values.client_legal_name || '').trim()}>
                Check for conflict
              </button>
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              {!canLeaveWho && <span className="prov">Name and type of work needed</span>}
            </>
          )}

          {step === 1 && (
            <>
              <button
                className="btn-primary"
                disabled={reading || narrative.trim().length < 30}
                onClick={readNotes}
              >
                {reading ? 'Reading your notes…' : 'Read my notes'}
              </button>
              <button className="btn" onClick={() => setStep(2)}>Skip for now</button>
              <button className="btn-ghost" onClick={() => setStep(0)}>Back</button>
            </>
          )}

          {step === 2 && (
            <>
              <button className="btn-primary" disabled={busy} onClick={save}>
                {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Save client'}
              </button>
              <button className="btn-ghost" onClick={() => setStep(1)}>Back to notes</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
