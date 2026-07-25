import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// Bring your own template. This is the two minute proof: a prospect pastes a
// letter they have actually issued, and watches it become a working template.

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [text, setText] = useState('');
  const [hint, setHint] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const d = await api.listTemplates();
      setTemplates(d.templates || []);
    } catch (e) { setError(e.message); }
  }

  useEffect(() => { load(); }, []);

  async function analyse() {
    setBusy('analyse');
    setError(null);
    setResult(null);
    try {
      const d = await api.analyseTemplate({ documentText: text, hint });
      setResult(d);
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  async function save() {
    setBusy('save');
    try {
      await api.saveTemplate({ definition: result.definition, name: result.definition.name });
      setResult(null);
      setText('');
      setHint('');
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  return (
    <div>
      <h2 className="view-title">Templates</h2>
      <p className="muted small">
        Paste a document the firm has actually issued. The engine separates the
        standard wording from the parts that change, and proposes the checks to
        run on every future copy.
      </p>

      <div className="card">
        <div className="card-head"><h3>Add a template from a real document</h3></div>

        <input
          className="text-input"
          placeholder="What is this document? For example: engagement letter"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
        />

        <textarea
          className="editor tall"
          placeholder="Paste the full text of the document here."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
        />

        <button className="btn-primary" disabled={busy === 'analyse' || text.length < 120} onClick={analyse}>
          {busy === 'analyse' ? 'Reading the document…' : 'Analyse this document'}
        </button>

        {error && <p className="err">{error}</p>}
      </div>

      {result && (
        <div className="card card-ok">
          <div className="card-head">
            <h3>{result.definition.name}</h3>
            <span className="pill pill-ok">{result.summary.fixed + result.summary.field + result.summary.bespoke} blocks</span>
          </div>

          <div className="summary-strip">
            <span><strong>{result.summary.fixed}</strong> standard clauses</span>
            <span><strong>{result.summary.field}</strong> merged lines</span>
            <span><strong>{result.summary.bespoke}</strong> drafted per matter</span>
            <span><strong>{result.summary.requiredFields}</strong> fields needed</span>
            <span><strong>{result.summary.blocking}</strong> blocking checks</span>
          </div>

          <div className="blocks-preview">
            {result.definition.blocks.map((b) => (
              <div key={b.key} className={`block block-${b.kind}`}>
                <span className="block-kind">
                  {b.kind === 'fixed' && 'Standard · reproduced exactly, AI never touches it'}
                  {b.kind === 'field' && 'Merged · filled from the matter record'}
                  {b.kind === 'bespoke' && 'Drafted fresh each time'}
                </span>
                <p className="block-body">{b.kind === 'bespoke' ? b.prompt : b.body}</p>
              </div>
            ))}
          </div>

          {result.definition.reviewRules.length > 0 && (
            <div className="rules">
              <p className="small"><strong>Checks on every future copy</strong></p>
              {result.definition.reviewRules.map((r) => (
                <div key={r.code} className={`rule rule-${r.severity}`}>
                  <span className="flag-sev">{r.severity}</span>
                  <span>{r.message}</span>
                </div>
              ))}
            </div>
          )}

          <button className="btn-primary" disabled={busy === 'save'} onClick={save}>
            {busy === 'save' ? 'Saving…' : 'Save as a template'}
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3>Saved templates</h3></div>
        {templates.length === 0 && <p className="muted small">None yet.</p>}
        <div className="list">
          {templates.map((t) => (
            <div key={t.id} className="list-row static">
              <div className="list-main">
                <strong>{t.name}</strong>
                <span className="muted small">
                  {t.summary.fixed} standard · {t.summary.field} merged ·
                  {' '}{t.summary.bespoke} drafted · {t.summary.blocking} blocking checks
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
