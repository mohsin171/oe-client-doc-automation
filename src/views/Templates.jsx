import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

// Upload the firm's own documents. Not one, a pile.
//
// A single letter tells you nothing about which parts are standard and which
// happened to suit that client. Twenty tells you exactly: the wording that
// appears in every one of them is, by definition, the firm's standard terms.
// Nobody marks anything up. The protected clauses are found by counting.

const ACCEPT = '.txt,.md,.docx,.doc';

async function readFile(file) {
  const name = file.name;
  if (/\.docx?$/i.test(name)) {
    const mammoth = await import('mammoth/mammoth.browser.js');
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return { name, text: value };
  }
  return { name, text: await file.text() };
}

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [corpus, setCorpus] = useState([]);
  const [onFile, setOnFile] = useState([]);
  const [reading, setReading] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [picked, setPicked] = useState('');
  const [docs, setDocs] = useState([]);
  const [hint, setHint] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  async function load() {
    try {
      const d = await api.listTemplates();
      setTemplates(d.templates || []);
      setCorpus(d.corpus || []);
      const f = await api.listCorpus('');
      setOnFile(f.documents || []);
    } catch (e) { setError(e.message); }
  }

  async function openDoc(id) {
    setReading({ id, loading: true });
    try {
      const d = await api.readCorpusDoc(id);
      setReading({ id, doc: d.document });
    } catch (e) { setReading(null); setError(e.message); }
  }

  async function removeDoc(id) {
    try {
      await api.deleteCorpusDoc(id);
      setConfirming(null);
      await load();
    } catch (e) { setError(e.message); }
  }

  async function clearAll() {
    setBusy('clear'); setError(null);
    try {
      await api.clearCorpus(onFile.length);
      setClearing(false);
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  async function removeTemplate(id) {
    try {
      await api.deleteTemplate(id);
      setConfirming(null);
      await load();
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function addFiles(fileList) {
    setError(null);
    const incoming = [...fileList];
    const read = [];
    for (const f of incoming) {
      try {
        const r = await readFile(f);
        if (r.text.trim().length < 120) {
          setError(`${f.name} looks too short to be a full document.`);
          continue;
        }
        read.push(r);
      } catch (_) {
        setError(`Could not read ${f.name}. Plain text or Word files work best.`);
      }
    }
    setDocs((d) => {
      const names = new Set(d.map((x) => x.name));
      return [...d, ...read.filter((r) => !names.has(r.name))];
    });
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  }

  async function analyse() {
    setBusy('analyse'); setError(null); setResult(null);
    try {
      setResult(await api.analyseTemplate({ documents: docs, hint }));
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  async function save() {
    setBusy('save');
    try {
      await api.saveTemplate({
        definition: result.definition,
        name: result.definition.name,
        documents: docs,
      });
      setResult(null); setDocs([]); setHint('');
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  const totalOnFile = corpus.reduce((n, c) => n + c.n, 0);
  const selected = onFile.find((d) => String(d.id) === String(picked)) || null;

  return (
    <>
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">Templates</div>
            <div className="section-hint">
              Letters you have already sent. Wording appearing in all of them is
              your standard terms; the rest is written fresh each time.
            </div>
          </div>
          {totalOnFile > 0 && <span className="count">{totalOnFile} on file</span>}
        </div>

        <div
          className={dragging ? 'dropzone dragging' : 'dropzone'}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
          <div className="dz-icon">↑</div>
          <strong>Drop your documents here</strong>
          <span className="prov">
            Word or plain text, as many as you like. Redacted copies are fine:
            names are not what this reads.
          </span>
        </div>

        {docs.length > 0 && (
          <div className="panel-box" style={{ marginTop: 16 }}>
            <div className="box-head">
              <span className="box-title">{docs.length} ready to analyse</span>
              <button className="btn-ghost" onClick={() => setDocs([])}>Clear</button>
            </div>
            <div className="filelist">
              {docs.map((d) => (
                <div className="filerow" key={d.name}>
                  <span className="fname">{d.name}</span>
                  <span className="fsize">{Math.round(d.text.length / 1000)}k characters</span>
                  <button
                    className="btn-ghost"
                    onClick={() => setDocs(docs.filter((x) => x.name !== d.name))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <label className="field" style={{ marginTop: 16 }}>
              <span>What are these</span>
              <input
                placeholder="engagement letters, client care letters, closing letters"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
              />
            </label>

            {docs.length === 1 && (
              <div className="notice warn">
                One document only tells us so much. With a single letter there is no
                way to know which parts are your standard wording and which just
                suited that client. Add a few more for a much better result.
              </div>
            )}

            <button className="btn-primary" disabled={busy === 'analyse'} onClick={analyse}>
              {busy === 'analyse'
                ? `Reading ${docs.length} document${docs.length > 1 ? 's' : ''}…`
                : `Analyse ${docs.length} document${docs.length > 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {error && <div className="notice err">{error}</div>}
      </div>

      {result && (
        <div className="section">
          <div className="section-head">
            <div className="section-title">{result.definition.name}</div>
            <div className="section-hint">Check the split before saving</div>
          </div>

          <div className="stats">
            <div className="stat hero">
              <div className="stat-value">{result.summary.fixed}</div>
              <div className="stat-label">Standard clauses</div>
              <div className="stat-note">
                {result.corpus?.n > 1
                  ? `In all ${result.corpus.n} documents. The AI can never alter these`
                  : 'The AI can never alter these'}
              </div>
            </div>
            <div className="stat">
              <div className="stat-value">{result.summary.field}</div>
              <div className="stat-label">Merged lines</div>
              <div className="stat-note">{result.summary.requiredFields} values needed</div>
            </div>
            <div className="stat">
              <div className="stat-value">{result.summary.bespoke}</div>
              <div className="stat-label">Written each time</div>
              <div className="stat-note">Grounded on these documents</div>
            </div>
            <div className="stat">
              <div className="stat-value">{result.summary.blocking}</div>
              <div className="stat-label">Blocking checks</div>
              <div className="stat-note">{result.summary.reviewRules} rules in total</div>
            </div>
          </div>

          {result.corpus?.recovered > 0 && (
            <div className="notice info">
              {result.corpus.recovered} standard clause
              {result.corpus.recovered > 1 ? 's were' : ' was'} added back automatically.
              Every clause appearing in all {result.corpus.n} of your documents is included
              with your exact wording, whether or not it was placed correctly first time.
              A protected clause going missing is not something this will let happen.
            </div>
          )}

          <div className="panel-box" style={{ marginTop: 16 }}>
            <div className="box-title">The split</div>
            <div className="blocks-preview">
              {result.definition.blocks.map((b) => (
                <div key={b.key} className={`block block-${b.kind}`}>
                  <span className="block-kind">
                    {b.kind === 'fixed' && 'Standard · reproduced exactly'}
                    {b.kind === 'field' && 'Merged · filled from the client record'}
                    {b.kind === 'bespoke' && 'Written fresh each time'}
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
              {busy === 'save' ? 'Saving…' : `Save and keep all ${docs.length} documents`}
            </button>
          </div>
        </div>
      )}

      {onFile.length > 0 && (
        <div className="section">
          <div className="section-head">
            <div>
              <div className="section-title">Letters on file</div>
              <div className="section-hint">What drafting is grounded on</div>
            </div>
            <div className="row-side">
              <span className="count">{onFile.length}</span>
              {clearing ? (
                <>
                  <button className="btn btn-sm danger" disabled={busy === 'clear'} onClick={clearAll}>
                    {busy === 'clear' ? 'Removing…' : `Yes, remove all ${onFile.length}`}
                  </button>
                  <button className="btn-ghost" onClick={() => setClearing(false)}>Cancel</button>
                </>
              ) : (
                <button className="btn-ghost" onClick={() => setClearing(true)}>Remove all</button>
              )}
            </div>
          </div>

          {clearing && (
            <div className="notice warn">
              This removes all {onFile.length} documents. Any structure derived from
              them stays, but nothing will be grounded on the firm's own wording
              until documents are uploaded again.
            </div>
          )}

          {/* Twenty letters as twenty rows is a wall. One at a time is how they
              are actually read: pick the one you want. */}
          <div className="picker">
            <select
              value={picked}
              onChange={(e) => { setPicked(e.target.value); setConfirming(null); }}
            >
              <option value="">Choose a letter…</option>
              {onFile.map((d) => (
                <option key={d.id} value={d.id}>
                  {String(d.section_key || '').replace(/^corpus:/, '')}
                </option>
              ))}
            </select>

            {selected && (
              <div className="picker-actions">
                <button className="btn btn-sm" onClick={() => openDoc(selected.id)}>Read</button>
                {confirming === `doc-${selected.id}` ? (
                  <>
                    <button className="btn btn-sm danger" onClick={() => { removeDoc(selected.id); setPicked(''); }}>
                      Confirm
                    </button>
                    <button className="btn-ghost" onClick={() => setConfirming(null)}>Cancel</button>
                  </>
                ) : (
                  <button className="btn-ghost" onClick={() => setConfirming(`doc-${selected.id}`)}>Remove</button>
                )}
              </div>
            )}
          </div>

          {selected && (
            <p className="prov picker-meta">
              {selected.doc_type.replace(/_/g, ' ')} ·{' '}
              {Math.round(selected.chars / 1000)}k characters · uploaded{' '}
              {new Date(selected.created_at).toLocaleDateString('en-GB')}
            </p>
          )}
        </div>
      )}

      {reading && (
        <div className="modal-scrim" onClick={() => setReading(null)}>
          <div className="modal reader" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{String(reading.doc?.section_key || '').replace(/^corpus:/, '') || 'Document'}</h2>
              <button className="btn btn-sm" onClick={() => setReading(null)}>Close</button>
            </div>
            {reading.loading && <p className="muted">Loading…</p>}
            {reading.doc && <pre className="doc-text">{reading.doc.body}</pre>}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <div className="section-title">What we have learned</div>
          <div className="section-hint">Structures derived from your documents</div>
        </div>

        {templates.length === 0 ? (
          <div className="panel-box"><p className="box-empty">Nothing yet.</p></div>
        ) : (
          <div className="rows">
            {templates.map((t) => {
              const c = corpus.find((x) => x.doc_type === t.doc_type);
              return (
                <div key={t.id} className="row">
                  <div className="row-main">
                    <strong>{t.name}</strong>
                    <span className="row-sub">
                      {t.summary.fixed} standard · {t.summary.field} merged ·{' '}
                      {t.summary.bespoke} written each time · {t.summary.requiredFields} values
                    </span>
                  </div>
                  <div className="row-side">
                    {c && <span className="chip">{c.n} on file</span>}
                    <span className="chip">{t.summary.blocking} blocking</span>
                    {confirming === `tpl-${t.id}` ? (
                      <>
                        <button className="btn btn-sm" onClick={() => removeTemplate(t.id)}>Confirm</button>
                        <button className="btn-ghost" onClick={() => setConfirming(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn-ghost" onClick={() => setConfirming(`tpl-${t.id}`)}>Remove</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
