import React, { useState } from 'react';
import { api } from '../api.js';

// Two steps: address, then code. No password to remember, and no way to create
// an account. Access exists only because the firm owner granted it.

export default function Login({ onSignedIn, status }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [devCode, setDevCode] = useState(null);

  async function requestCode() {
    setBusy(true);
    setError(null);
    setDevCode(null);
    try {
      const d = await api.requestCode({ email });
      setStep('code');
      setNotice(
        d.emailDelivered === false
          ? 'Email is not connected yet, so the code was written to the server log instead.'
          : `A ${'six digit'} code is on its way. It expires in ${d.expiresInMinutes} minutes.`
      );
      if (d.devCode) setDevCode(d.devCode);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const d = await api.verifyCode({ email, code });
      onSignedIn(d);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="login-page">
      {/* Decorative only. */}
      <div className="orbs" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
        <span className="orb orb-ring" />
        <span className="orb orb-ring-2" />
      </div>

      <div className="login-stack">
      <div className="login-card">
        <p className="eyebrow">Orca Edge</p>
        <h1 className="app-title">Document Generation<br />&amp; Review Automation</h1>
        <p className="muted small login-sub">
          Sign in with your work email address. Access is granted by your firm,
          so there is nothing to register.
        </p>

        {status && !status.authConfigured && (
          <div className="banner">
            Sign-in is unavailable because SESSION_SECRET is not set. Add it in
            the Vercel project environment variables and redeploy.
          </div>
        )}

        {step === 'email' && (
          <>
            <label className="gap-input">
              <span>Work email address</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && email.includes('@') && requestCode()}
                placeholder="you@yourfirm.co.uk"
              />
            </label>
            <button
              className="btn-primary full"
              disabled={busy || !email.includes('@') || (status && !status.authConfigured)}
              onClick={requestCode}
            >
              {busy ? 'Sending…' : 'Send me a code'}
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            {notice && <p className="small notice">{notice}</p>}

            {devCode && (
              <div className="banner">
                Pre-launch mode is on, so the code is shown here: <strong>{devCode}</strong>.
                Turn AUTH_DEV_ECHO off before any real firm uses this.
              </div>
            )}

            <label className="gap-input">
              <span>Six digit code</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && verify()}
                placeholder="000000"
              />
            </label>

            <button className="btn-primary full" disabled={busy || code.length !== 6} onClick={verify}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>

            <button
              className="link-back"
              style={{ marginTop: 14 }}
              onClick={() => { setStep('email'); setCode(''); setError(null); setNotice(null); }}
            >
              Use a different address
            </button>
          </>
        )}

        {error && <p className="err">{error}</p>}
      </div>

      <p className="login-foot">
        The AI never fills a gap, and the AI never touches fixed clauses.
        A qualified person signs off on everything before it leaves the firm.
      </p>
      </div>
    </div>
  );
}
