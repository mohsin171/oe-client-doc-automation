import React, { useState } from 'react';
import { api } from '../api.js';

// Invite only: enter your address, receive a one time code, enter the code.
// Structure mirrors the unified operations app, rendered light rather than dark.

export default function Login({ onSignedIn, status }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [devCode, setDevCode] = useState('');

  async function requestCode() {
    setErr(''); setNote(''); setDevCode('');
    const e = email.trim().toLowerCase();
    if (!e.includes('@')) { setErr('Please enter a valid email address.'); return; }
    setBusy(true);
    try {
      const r = await api.requestCode({ email: e });
      setStep('code');
      setNote(
        r.emailDelivered === false
          ? 'Email is not connected yet, so the code was written to the server log instead.'
          : `If that address is authorised, a six digit code is on its way. It expires in ${r.expiresInMinutes} minutes.`
      );
      if (r.devCode) setDevCode(r.devCode);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  async function verify() {
    setErr('');
    if (!/^\d{6}$/.test(code.trim())) { setErr('Enter the six digit code from your email.'); return; }
    setBusy(true);
    try {
      await api.verifyCode({ email: email.trim().toLowerCase(), code: code.trim() });
      onSignedIn();
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <div className="login-wrap">
      {/* Decorative only. */}
      <div aria-hidden="true">
        <div className="login-bg-glow g1" />
        <div className="login-bg-glow g2" />
        <div className="login-bg-glow g3" />
        <span className="login-ring lr1" />
        <span className="login-ring lr2" />
        <span className="login-ring lr3" />
        <div className="login-orb o1" />
        <div className="login-orb o2" />
        <div className="login-orb o3" />
      </div>

      <div className="login-card">
        <div className="login-brand">
          <div className="login-mark"><span /></div>
          <div>
            <div className="login-firm">Orca Edge</div>
            <div className="login-sub">Document Generation &amp; Review Automation</div>
          </div>
        </div>

        {status && !status.authConfigured && (
          <div className="login-err">
            Sign-in is unavailable because SESSION_SECRET is not set. Add it in the
            Vercel project environment variables and redeploy.
          </div>
        )}

        <div className="login-step" key={step}>
          {step === 'email' ? (
            <>
              <h1>Sign in</h1>
              <p className="login-lead">
                Enter your work email and we will send you a one time code. Access is
                granted by your firm, so there is nothing to register.
              </p>
              <label className="login-label" htmlFor="oe-email">Work email</label>
              <input
                id="oe-email"
                className="login-input"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                placeholder="you@yourfirm.co.uk"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && requestCode()}
              />
              {err && <div className="login-err">{err}</div>}
              <button
                className="login-btn"
                disabled={busy || (status && !status.authConfigured)}
                onClick={requestCode}
              >
                {busy ? 'Sending…' : 'Send code'}
              </button>
            </>
          ) : (
            <>
              <h1>Enter your code</h1>
              <p className="login-lead">
                We sent a six digit code to <b>{email}</b>. It expires in ten minutes
                and can only be used once.
              </p>
              <label className="login-label" htmlFor="oe-code">Six digit code</label>
              <input
                id="oe-code"
                className="login-input login-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                placeholder="••••••"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && verify()}
              />
              {devCode && (
                <div className="login-note">
                  Pre-launch mode, no email connected: your code is <b>{devCode}</b>
                </div>
              )}
              {note && !devCode && <div className="login-note">{note}</div>}
              {err && <div className="login-err">{err}</div>}
              <button className="login-btn" disabled={busy} onClick={verify}>
                {busy ? 'Verifying…' : 'Verify and sign in'}
              </button>
              <button
                className="login-link"
                disabled={busy}
                onClick={() => { setStep('email'); setCode(''); setErr(''); setNote(''); setDevCode(''); }}
              >
                Use a different email
              </button>
            </>
          )}
        </div>

        <div className="login-foot">
          Protected by one time codes and encrypted sessions. Secured over HTTPS.
        </div>
      </div>
    </div>
  );
}
