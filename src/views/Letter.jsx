import React, { useState } from 'react';
import FirmMark from './FirmMark.jsx';

// The letter as a document rather than a review pane.
//
// Two things this is for. A fee earner needs to see what the client will
// receive, laid out properly, before signing anything off. And an engagement
// letter is easier to agree to when it is read and acknowledged section by
// section than when it arrives as an attachment to be printed and posted back.
//
// A section-level acknowledgement is also better evidence than one signature at
// the end. If a client later says nobody explained the fee cap, a tick against
// that specific clause, timestamped, answers it.

const NEEDS_ACK = new Set(['bespoke', 'field']);

// Blocks that are pure furniture are not worth an acknowledgement.
function acknowledgeable(block) {
  const body = String(block.body || '').trim();
  if (!body || body.length < 120) return false;
  if (/^(dear|yours|our reference|private and confidential)/i.test(body)) return false;
  return NEEDS_ACK.has(block.kind) || block.kind === 'fixed';
}

function headingFor(block, i) {
  const raw = String(block.key || `Section ${i + 1}`).replace(/_/g, ' ');
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function Letter({ document: doc, version, firm, salutation, onBack }) {
  const [acks, setAcks] = useState({});
  const [mode, setMode] = useState('type');
  const [typed, setTyped] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');

  const branding = firm?.branding || {};
  const blocks = (version?.blocks || []).filter((b) => String(b.body || '').trim());
  const needing = blocks.filter(acknowledgeable);
  const done = needing.filter((b) => acks[b.key]).length;

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="letter-page">
      <div className="letter-bar">
        <button className="back" onClick={onBack}>Back to review</button>
        <span className="prov">
          This is what the client sees. Acknowledgements and the signature are
          captured from them, not here.
        </span>
      </div>

      <article className="letter">
        <header className="letter-head">
          <div className="letter-brand">
            <FirmMark branding={branding} name={firm?.name || ''} size={54} />
            <div>
              <div className="letter-firm">{branding.letterhead || firm?.name}</div>
              {branding.address && <div className="letter-address">{branding.address}</div>}
            </div>
          </div>
          <div className="letter-meta">
            <div>Our reference: {doc.reference}</div>
            <div>{today}</div>
          </div>
        </header>

        <div className="letter-recipient">
          <div>{doc.client_name}</div>
          {doc.client_address && <div className="pre">{doc.client_address}</div>}
        </div>

        <p className="letter-salutation">Dear {salutation || doc.client_name},</p>

        {blocks.map((b, i) => {
          const ack = acknowledgeable(b);
          return (
            <section className="letter-section" key={b.key}>
              {ack && <h3>{headingFor(b, i)}</h3>}
              <p className="letter-body">{b.body}</p>

              {ack && (
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
          );
        })}

        <div className="letter-sign">
          <div className="sign-grid">
            <div>
              <label className="sign-label">Client <em>*</em></label>
              <div className="sign-pad">
                {mode === 'type'
                  ? <input
                      className="sign-typed"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder="Type your name"
                      aria-label="Typed signature"
                    />
                  : <div className="sign-draw">Draw your signature here</div>}
                <span className="sign-rule" />
              </div>
              <div className="sign-modes">
                <button className={mode === 'draw' ? 'on' : ''} onClick={() => setMode('draw')}>draw</button>
                <button className={mode === 'type' ? 'on' : ''} onClick={() => setMode('type')}>type</button>
              </div>
            </div>

            <div>
              <label className="sign-label">Date signed <em>*</em></label>
              <div className="sign-date">{today}</div>
            </div>
          </div>

          <label className="sign-label">Print name <em>*</em></label>
          <div className="name-grid">
            <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First" />
            <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last" />
          </div>
        </div>
      </article>

      <div className="letter-foot">
        <span className={done === needing.length ? 'count ok' : 'count'}>
          {done} of {needing.length} sections acknowledged
        </span>
        <span className="prov">
          Sending this to the client for signature is not built yet. For now the
          approved letter downloads as Word from the review screen.
        </span>
      </div>
    </div>
  );
}
