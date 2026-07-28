import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import FirmMark from './FirmMark.jsx';
import { layoutLetter, isFurniture, headingFor } from '../../lib/letter.js';

// The generated letter as a form the client works through, rather than a page
// of prose. Two tabs, sections with an acknowledgement against each, a
// signature at the foot.
//
// The reason for a tick per section rather than one signature at the end: if a
// client later says nobody explained the fee cap, a tick against that clause
// answers it. A signature on page six does not.

function SignaturePad({ value, onChange, mode }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (mode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0F1826';
  }, [mode]);

  function pos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  }

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  };

  if (mode === 'type') {
    return (
      <input
        className="sig-typed"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your name"
        aria-label="Typed signature"
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="sig-canvas"
      onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
      onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      aria-label="Draw your signature"
    />
  );
}

export default function DocumentForm({
  doc, version, firm, salutation, flags, approvals, me,
  busy, editing, editText, setEditing, setEditText,
  onEditSave, onResolve, onDismiss, dismissing, setDismissing, reason, setReason,
  onApprove, onIssue, onReopen, onSend, onBack, onSuggest, suggestion, clearSuggestion,
  onAddFacts, facts, setFacts,
}) {
  const [tab, setTab] = useState('agreement');
  const [acks, setAcks] = useState({});
  const [sigMode, setSigMode] = useState('draw');
  const [sig, setSig] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');

  const branding = firm?.branding || {};
  const parts = layoutLetter(version?.blocks || []);
  const locked = ['approved', 'issued'].includes(doc.status);
  const open = (flags || []).filter((f) => f.status === 'open');
  const blocking = open.filter((f) => f.severity === 'blocking');
  const flagged = new Set(open.map((f) => f.anchor));

  const sections = parts.body.filter((b) => !isFurniture(b));
  const acked = sections.filter((b) => acks[b.key]).length;

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const TABS = [
    { key: 'client', label: 'Client information' },
    { key: 'agreement', label: 'Agreement details' },
  ];

  return (
    <div className="doc-form">
      <header className="df-head">
        <div className="df-brand">
          <FirmMark branding={branding} name={firm?.name || ''} size={54} />
          <div>
            <div className="df-firm">{branding.letterhead || firm?.name}</div>
            {branding.address && <div className="df-address">{branding.address}</div>}
          </div>
        </div>
        <h1 className="df-title">
          {headingFor({ key: doc.doc_type })}
          <span>{doc.reference} · version {version?.version}</span>
        </h1>
      </header>

      <nav className="df-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'df-tab on' : 'df-tab'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'client' && (
        <div className="df-body">
          <section className="df-section">
            <h2>Who this letter is for</h2>
            <p className="df-note">
              Taken from the client record. Change it there and regenerate if
              anything is wrong.
            </p>
            <div className="df-kv">
              <div><span>Client</span><strong>{doc.client_name}</strong></div>
              {doc.client_address && (
                <div><span>Address</span><strong className="pre">{doc.client_address}</strong></div>
              )}
              {doc.client_email && <div><span>Email</span><strong>{doc.client_email}</strong></div>}
              <div><span>Reference</span><strong>{doc.reference}</strong></div>
              <div><span>Matter</span><strong>{doc.matter_type}</strong></div>
              <div><span>Dated</span><strong>{today}</strong></div>
              <div><span>Addressed as</span><strong>Dear {salutation || doc.client_name},</strong></div>
            </div>
          </section>
        </div>
      )}

      {tab === 'agreement' && (
        <div className="df-body">
          {!locked && open.length > 0 && (
            <div className="df-checks">
              <div className="box-title">
                {blocking.length > 0
                  ? `${blocking.length} to resolve before sign-off`
                  : `${open.length} worth a look`}
              </div>
              {open.map((f) => (
                <div key={f.id} className={`check check-${f.severity}`}>
                  <div className="check-row">
                  <div className="check-main">
                    <div className="flag-head">
                      <span className={`badge ${f.severity}`}>{f.severity}</span>
                      {f.anchor && <span className="flag-anchor">{headingFor({ key: f.anchor })}</span>}
                    </div>
                    <p className="flag-msg">{f.message}</p>
                    {dismissing === f.id && (
                      <div className="dismiss-box">
                        <input
                          placeholder="Why is this not a problem?"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <button className="btn btn-sm" disabled={!reason.trim()} onClick={() => onDismiss(f.id)}>
                          Record
                        </button>
                      </div>
                    )}
                  </div>
                  {dismissing !== f.id && (
                    <div className="check-side">
                      {f.fixIn && parts.body.some((b) => b.key === f.fixIn) && !locked && (
                        <button
                          className="btn btn-sm"
                          onClick={() => {
                            const target = parts.body.find((b) => b.key === f.fixIn);
                            setEditing(target.key);
                            setEditText(target.body || '');
                            requestAnimationFrame(() => {
                              window.document
                                .getElementById(`section-${target.key}`)
                                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            });
                          }}
                        >
                          Fix {headingFor({ key: f.fixIn })}
                        </button>
                      )}
                      {f.fixIn && (
                        <button
                          className="btn btn-sm"
                          disabled={busy === `suggest-${f.id}`}
                          onClick={() => onSuggest(f.id)}
                        >
                          {busy === `suggest-${f.id}` ? 'Thinking…' : 'Suggest a fix'}
                        </button>
                      )}
                      {!f.verifiable && (
                        <button className="btn btn-sm" onClick={() => onResolve(f.id)}>Resolved</button>
                      )}
                      <button className="btn-ghost" onClick={() => setDismissing(f.id)}>Dismiss</button>
                    </div>
                  )}
                  </div>
                  {/* A proposal, not a change. Nothing is written until it is
                      accepted, and the current wording stays visible beside it
                      so the difference is a decision rather than a surprise. */}
                  {suggestion?.flagId === f.id && (
                    <div className="suggestion">
                      {suggestion.canFix ? (
                        <>
                          <div className="sug-head">
                            <span className="box-title">Suggested wording</span>
                            {suggestion.note && <span className="prov">{suggestion.note}</span>}
                          </div>
                          <blockquote className="sug-text">{suggestion.suggestion}</blockquote>
                          <details className="sug-current">
                            <summary>Show the wording it replaces</summary>
                            <blockquote className="sug-text was">{suggestion.current}</blockquote>
                          </details>
                          <div className="btn-row">
                            <button
                              className="btn-primary btn-sm"
                              disabled={busy === 'edit'}
                              onClick={() => {
                                setEditing(suggestion.anchor);
                                setEditText(suggestion.suggestion);
                                onEditSave(suggestion.anchor, suggestion.suggestion);
                              }}
                            >
                              Use this wording
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => {
                                setEditing(suggestion.anchor);
                                setEditText(suggestion.suggestion);
                                clearSuggestion();
                              }}
                            >
                              Edit it first
                            </button>
                            <button className="btn-ghost" onClick={clearSuggestion}>Discard</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="box-title">This needs a fact, not different wording</div>
                          <p className="prov">{suggestion.note}</p>

                          {suggestion.needs?.length > 0 && (
                            <div className="needs">
                              <div className="field-grid">
                                {suggestion.needs.map((meta) => (
                                  <div className="field" key={meta.key}>
                                    <label><span>{meta.label}</span></label>
                                    {meta.type === 'date' ? (
                                      <input
                                        type="date"
                                        value={facts[meta.key] || ''}
                                        onChange={(e) => setFacts({ ...facts, [meta.key]: e.target.value })}
                                      />
                                    ) : meta.type === 'number' ? (
                                      <div className="affixed">
                                        {meta.prefix && <span className="affix">{meta.prefix}</span>}
                                        <input
                                          inputMode="decimal"
                                          placeholder="0"
                                          value={facts[meta.key] || ''}
                                          onChange={(e) => setFacts({ ...facts, [meta.key]: e.target.value })}
                                        />
                                      </div>
                                    ) : (
                                      <input
                                        value={facts[meta.key] || ''}
                                        onChange={(e) => setFacts({ ...facts, [meta.key]: e.target.value })}
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div className="btn-row">
                                <button
                                  className="btn-primary btn-sm"
                                  disabled={busy === 'facts'
                                    || Object.values(facts).every((v) => !String(v).trim())}
                                  onClick={() => onAddFacts(suggestion.matterId, facts, f.id)}
                                >
                                  {busy === 'facts' ? 'Saving…' : 'Record and try again'}
                                </button>
                                <button className="btn-ghost" onClick={clearSuggestion}>Cancel</button>
                              </div>
                              <p className="prov">
                                Saved against the client, so every later document uses it too.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {parts.subject && (
            <p className="df-subject">{String(parts.subject.body).trim()}</p>
          )}

          {sections.map((b) => (
            <section
              id={`section-${b.key}`}
              className={`df-section${flagged.has(b.key) ? ' flagged' : ''}`}
              key={b.key}
            >
              <div className="df-section-head">
                <h2>{headingFor(b)}</h2>
                <div className="df-marks">
                  {b.kind === 'bespoke' && <span className="mark-ai">written for this matter</span>}
                  {b.amended && <span className="mark-amended">standard clause changed</span>}
                  {!locked && editing !== b.key && (
                    <button
                      className="btn-ghost"
                      onClick={() => { setEditing(b.key); setEditText(b.body || ''); }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {editing === b.key ? (
                <>
                  <textarea rows={7} value={editText} onChange={(e) => setEditText(e.target.value)} />
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button className="btn btn-sm" disabled={busy === 'edit'} onClick={() => onEditSave(b.key)}>
                      Save
                    </button>
                    <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <blockquote className="df-clause">{b.body}</blockquote>
              )}

              {editing !== b.key && (
                <label className={acks[b.key] ? 'ack on' : 'ack'}>
                  <input
                    type="checkbox"
                    checked={Boolean(acks[b.key])}
                    onChange={(e) => setAcks({ ...acks, [b.key]: e.target.checked })}
                  />
                  <span className="ack-box" aria-hidden="true" />
                  <span className="ack-text">
                    I, {[first, last].filter(Boolean).join(' ') || '\u2026'}, acknowledge this section.
                  </span>
                </label>
              )}
            </section>
          ))}

          <section className="df-section df-signature">
            <div className="sig-grid">
              <div>
                <label className="sig-label">Client <em>*</em></label>
                <div className="sig-pad">
                  <SignaturePad value={sig} onChange={setSig} mode={sigMode} />
                  <span className="sig-rule" />
                  {sig && (
                    <button className="sig-clear" onClick={() => setSig('')} aria-label="Clear signature">×</button>
                  )}
                </div>
                <div className="sig-modes">
                  <button className={sigMode === 'draw' ? 'on' : ''} onClick={() => { setSigMode('draw'); setSig(''); }}>draw</button>
                  <button className={sigMode === 'type' ? 'on' : ''} onClick={() => { setSigMode('type'); setSig(''); }}>type</button>
                </div>
              </div>
              <div>
                <label className="sig-label">Date signed <em>*</em></label>
                <div className="sig-date">{today}</div>
              </div>
            </div>

            <label className="sig-label">Print name <em>*</em></label>
            <div className="name-grid">
              <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First" />
              <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last" />
            </div>

            <p className="prov" style={{ marginTop: 14 }}>
              {acked} of {sections.length} sections acknowledged. Captured from the
              client once sending is built; what you enter here is not stored.
            </p>
          </section>
        </div>
      )}

      <footer className="df-foot">
        <button className="btn" onClick={onBack}>Back</button>

        {approvals.length > 0 ? (
          <>
            <span className="signed-inline">
              Signed off by {approvals[0].approver_name} ·{' '}
              {new Date(approvals[0].approved_at).toLocaleString('en-GB')}
            </span>
            <div className="df-foot-right">
              <a className="btn-primary" href={api.downloadUrl(doc.id, 'pdf')}>Download PDF</a>
              <button className="btn" onClick={onSend}>Send to client</button>
              {doc.status === 'approved' && (
                <button className="btn" disabled={busy === 'issue'} onClick={onIssue}>Mark issued</button>
              )}
              <button className="btn-ghost" disabled={busy === 'reopen'} onClick={onReopen}>
                {doc.status === 'issued' ? 'Revise' : 'Reopen'}
              </button>
            </div>
          </>
        ) : me?.canApprove ? (
          <div className="df-foot-right">
            {blocking.length > 0 && (
              <span className="prov">{blocking.length} to clear first</span>
            )}
            <button
              className="btn-primary"
              disabled={busy === 'approve' || blocking.length > 0}
              onClick={onApprove}
            >
              {busy === 'approve' ? 'Recording…' : 'Sign off'}
            </button>
          </div>
        ) : (
          <span className="prov">Your role cannot sign off. Ask the firm owner.</span>
        )}
      </footer>
    </div>
  );
}
