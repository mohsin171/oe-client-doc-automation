import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// Bring your own template: paste a letter the firm has actually issued and
// watch it become a working template. This is the two minute proof.

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [text, setText] = useState('');
  const [hint, setHint] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try { setTemplates((await api.listTemplates()).templates || []); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function analyse() {
    setBusy('analyse'); setError(null); setResult(null);
    try { setResult(await api.analyseTemplate({ documentText: text, hint })); }
    catch (e) { setError(e.message); }
    setBusy(null);
  }

  async function save() {
    setBusy('save');
    try {
      await api.saveTemplate({ definition: result.definition, name: result.definition.name });
      setResult(null); setText(''); setHint('');
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  return (
    <>
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">Templates</div>
            <div className="section-hint">
              Paste a document the firm has actually issued. The engine separates
              the standard wording from the parts that change, and proposes the
              checks to run on every future copy.
            </div>
          </div>
        </div>

        <div className="panel-box">
          <label className="field">
            <span>What is this document</span>
            <input
              placeholder="engagement letter, client care letter, closing letter"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
            />
          </label>

          <label className="field">
            <span>The full text</span>
            <textarea
              className="tall"
              placeholder="Paste the whole document here."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>

          <button className="btn-primary" disabled={busy === 'analyse' || text.length < 120} onClick={analyse}>
            {busy === 'analyse' ? 'Reading the document…' : 'Analyse this document'}
          </button>

          {error && <div className="notice err" style={{ marginTop: 14 }}>{error}</div>}
        </div>
      </div>

      {result && (
        <div className="section">
          <div className="section-head">
            <div className="section-title">{result.definition.name}</div>
            <div className="section-hint">Review the split before saving</div>
          </div>

          <div className="stats">
            <div className="stat">
              <div className="stat-value">{result.summary.fixed}</div>
              <div className="stat-label">Standard clauses</div>
              <div className="stat-note">The AI never touches these</div>
            </div>
            <div className="stat">
              <div className="stat-value">{result.summary.field}</div>
              <div className="stat-label">Merged lines</div>
              <div className="stat-note">{result.summary.requiredFields} fields needed</div>
            </div>
            <div className="stat">
              <div className="stat-value">{result.summary.bespoke}</div>
              <div className="stat-label">Drafted per matter</div>
              <div className="stat-note">Grounded on firm precedents</div>
            </div>
            <div className="stat">
              <div className="stat-value">{result.summary.blocking}</div>
              <div className="stat-label">Blocking checks</div>
              <div className="stat-note">{result.summary.reviewRules} rules in total</div>
            </div>
          </div>

          <div className="panel-box" style={{ marginTop: 16 }}>
            <div className="box-title">The split</div>
            <div className="blocks-preview">
              {result.definition.blocks.map((b) => (
                <div key={b.key} className={`block block-${b.kind}`}>
                  <span className="block-kind">
                    {b.kind === 'fixed' && 'Standard · reproduced exactly'}
                    {b.kind === 'field' && 'Merged · filled from the matter record'}
                    {b.kind === 'bespoke' && 'Drafted fresh each time'}
                  </span>
                  <p className="block-body">{b.kind === 'bespoke' ? b.prompt : b.body}</p>
                </div>
              ))}
            </div>

            {result.definition.reviewRules.length > 0 && (
              <>
                <div className="box-title" style={{ marginTop: 20 }}>Checks on every future copy</div>
                {result.definition.reviewRules.map((r) => (
                  <div className="rule" key={r.code}>
                    <span className={`badge ${r.severity}`}>{r.severity}</span>
                    <span>{r.message}</span>
                  </div>
                ))}
              </>
            )}

            <button className="btn-primary" style={{ marginTop: 20 }} disabled={busy === 'save'} onClick={save}>
              {busy === 'save' ? 'Saving…' : 'Save as a template'}
            </button>
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <div className="section-title">Saved templates</div>
          <div className="section-hint">Configuration the engine reads, never code</div>
        </div>

        {templates.length === 0 ? (
          <div className="panel-box"><p className="box-empty">None yet.</p></div>
        ) : (
          <div className="rows">
            {templates.map((t) => (
              <div key={t.id} className="row">
                <div className="row-main">
                  <strong>{t.name}</strong>
                  <span className="row-sub">
                    {t.summary.fixed} standard · {t.summary.field} merged ·{' '}
                    {t.summary.bespoke} drafted · {t.summary.requiredFields} fields
                  </span>
                </div>
                <div className="row-side">
                  <span className="chip">{t.summary.blocking} blocking</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
