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
  const [checking, setChecking] = useState(false);
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
  // Does the firm already act for someone of this name? A firm has to know before
  // taking a matter on, and an employee who can only see their own clients cannot
  // answer it, so this answers it for them: a count, and nothing else. No file, no
  // colleague, no detail that would breach another client's confidence.
  async function checkConflict() {
    const name = String(values.client_legal_name || '').trim();
    if (name.length < 3) {
      setConflict({ error: 'Enter the client\'s name first.' });
      return;
    }
    setChecking(true);
    setConflict(null);
    try {
      const d = await api.conflictCheck(name, matterId);
      setConflict({ matches: d.matches, name });
    } catch (e) {
      // A check that fails silently is worse than no check: it reads as a clean
      // result. Say so instead.
      setConflict({ error: e.message });
    }
    setChecking(false);
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
            {!isEdit && clients.length > 0 && (
              <div className="field">
                <label><span>Already on file</span></label>
                <select value={clientId} onChange={(e) => pickClient(e.target.value)}>
                  <option value="">Someone new</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.legal_name}</option>)}
                </select>
              </div>
            )}

            <div className="field-grid">{identity.map((f) => field(f))}</div>

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
                {/* What was found, and nothing else.
                    Sixteen boxes with four values in them is a form asking a fee earner
                    to fill twelve blanks nobody can fill, and the answer they gave was to
                    type "nan" into them, which is what a form deserves for asking a
                    question that has no answer. Anything not in the notes is not missing:
                    it is simply not known yet, and the letter that needs it will ask when
                    it is written. */}
                <div className="readout">
                  <strong>{filledExtract} found in your notes</strong>
                  {extractable.length > filledExtract
                    && `, ${extractable.length - filledExtract} not mentioned`}
                </div>

                <div className="field-grid">
                  {extractable
                    .filter((f) => String(values[f.key] ?? '').trim())
                    .map((f) => field(f, { hints: false }))}
                </div>

                {extractable.some((f) => !String(values[f.key] ?? '').trim()) && (
                  <details className="not-mentioned">
                    <summary>
                      {extractable.filter((f) => !String(values[f.key] ?? '').trim()).length}{' '}
                      things the notes did not mention
                    </summary>
                    <p className="prov">
                      None of these is missing. They are not known yet, and whichever letter
                      needs one will ask for it then. Add any you happen to know.
                    </p>
                    <div className="field-grid">
                      {extractable
                        .filter((f) => !String(values[f.key] ?? '').trim())
                        .map((f) => field(f, { hints: false }))}
                    </div>
                  </details>
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
              <button
                className="btn"
                onClick={checkConflict}
                disabled={checking || !String(values.client_legal_name || '').trim()}
              >
                {checking ? 'Checking…' : 'Check for conflict'}
              </button>

              {conflict && (
                <span
                  className={
                    conflict.error ? 'conflict-said bad'
                      : conflict.matches > 0 ? 'conflict-said warn' : 'conflict-said ok'
                  }
                >
                  {conflict.error
                    || (conflict.matches > 0
                      ? `Already acting for ${conflict.matches} client${conflict.matches > 1 ? 's' : ''} of that name`
                      : 'No existing client of that name')}
                </span>
              )}
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
