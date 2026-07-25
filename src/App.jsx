import React, { useEffect, useState } from 'react';

const STEPS = [
  { key: 'deployed',         label: 'Deployed on Vercel',      hint: 'If you can read this, this one is done.' },
  { key: 'databaseUrlSet',   label: 'DATABASE_URL set',        hint: 'Neon pooled connection string, added in Vercel project settings.' },
  { key: 'anthropicKeySet',  label: 'ANTHROPIC_API_KEY set',   hint: 'Used for bespoke drafting and the review pass.' },
  { key: 'sessionSecretSet', label: 'SESSION_SECRET set',      hint: 'Any 32 byte random hex string.' },
  { key: 'schemaApplied',    label: 'Schema applied',          hint: 'Paste db/schema.sql into the Neon SQL editor and run it.' },
  { key: 'seedApplied',      label: 'Seed applied',            hint: 'Then paste db/seed.sql and run it. Safe to re-run.' },
];

export default function App() {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setState({ loading: false, ...d }))
      .catch((e) => setState({ loading: false, error: e.message }));
  }, []);

  const checks = state.checks || {};
  const doneCount = STEPS.filter((s) => checks[s.key]).length;

  return (
    <div className="wrap">
      <header>
        <p className="eyebrow">Orca Edge · Tool 2</p>
        <h1>Document Generation<br />&amp; Review Automation</h1>
        <p className="sub">
          Internal, staff facing. Standalone. Law firm beachhead.
        </p>
      </header>

      <section className="card">
        <div className="card-head">
          <h2>Setup status</h2>
          {!state.loading && (
            <span className={state.ready ? 'pill pill-ok' : 'pill pill-wait'}>
              {doneCount} of {STEPS.length}
            </span>
          )}
        </div>

        {state.loading && <p className="muted">Checking…</p>}
        {state.error && <p className="err">Could not reach /api/health: {state.error}</p>}

        {!state.loading && !state.error && (
          <ul className="checks">
            {STEPS.map((s) => (
              <li key={s.key} className={checks[s.key] ? 'ok' : 'pending'}>
                <span className="mark">{checks[s.key] ? '✓' : '·'}</span>
                <div>
                  <strong>{s.label}</strong>
                  {!checks[s.key] && <span className="hint">{s.hint}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}

        {checks.databaseError && (
          <p className="err">Database said: {checks.databaseError}</p>
        )}

        {checks.firm && (
          <p className="muted">
            Connected to <strong>{checks.firm.name}</strong> ({checks.firm.vertical}).
            Illustrative demo firm, fictional.
          </p>
        )}

        {state.ready && (
          <p className="ready">
            All four setup steps complete. Ready to start building capture.
          </p>
        )}
      </section>

      <footer>
        <p>
          The two rules this codebase does not bend: the AI never fills a gap,
          and the AI never touches fixed clauses. A qualified person signs off
          on everything before it leaves the firm.
        </p>
      </footer>
    </div>
  );
}
