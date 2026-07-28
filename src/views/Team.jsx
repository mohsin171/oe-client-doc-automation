import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Team() {
  const [state, setState] = useState({ loading: true, team: [] });
  const [invite, setInvite] = useState({ name: '', email: '', role: 'admin' });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null);

  async function load() {
    try { setState({ loading: false, ...(await api.team()) }); }
    catch (e) { setState({ loading: false, error: e.message, team: [] }); }
  }
  useEffect(() => { load(); }, []);

  const run = async (key, fn) => {
    setBusy(key); setError(null);
    try { const d = await fn(); if (d?.team) setState((s) => ({ ...s, team: d.team })); }
    catch (e) { setError(e.message); }
    setBusy(null);
  };

  if (state.loading) return <p className="muted">Loading…</p>;
  if (state.error) return <div className="notice err">{state.error}</div>;

  const { team = [], canManage, me } = state;

  return (
    <>
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">Team</div>
            <div className="section-hint">
              {canManage
                ? 'Access is by invitation only. Nobody can register themselves.'
                : 'People at the firm. Only the owner can add or remove someone.'}
            </div>
          </div>
        </div>

        {error && <div className="notice err">{error}</div>}

        {canManage && (
          <div className="panel-box">
            <div className="box-title">Invite someone</div>
            <div className="invite-grid">
              <label className="field">
                <span>Name</span>
                <input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
              </label>
              <label className="field">
                <span>Work email</span>
                <input value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
              </label>
            </div>
            <p className="prov">
              Everyone invited can open their own clients, draft and sign off. Only
              you can add or remove people.
            </p>
            <button
              className="btn-primary"
              style={{ marginTop: 14 }}
              disabled={busy === 'invite' || !invite.name || !invite.email.includes('@')}
              onClick={() => run('invite', async () => {
                const d = await api.teamInvite(invite);
                setInvite({ name: '', email: '', role: 'admin' });
                return d;
              })}
            >
              {busy === 'invite' ? 'Inviting…' : 'Send invitation'}
            </button>
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-head">
          <div className="section-title">People</div>
          {canManage && (
            <div className="section-hint">Revoking someone ends their session immediately</div>
          )}
        </div>

        <div className="rows">
          {team.map((u) => (
            <div key={u.id} className={u.active ? 'row' : 'row dim'}>
              <div className="row-main">
                <strong>{u.name}{u.id === me ? ' (you)' : ''}</strong>
                <span className="row-sub">{u.email}</span>
                <span className="prov">
                  {u.last_login_at
                    ? `Last signed in ${new Date(u.last_login_at).toLocaleDateString('en-GB')}`
                    : 'Has not signed in yet'}
                </span>
              </div>

              <div className="row-side">
                {!u.active && <span className="badge revoked">revoked</span>}

                <span className={`badge ${u.role}`}>{u.role}</span>

                {u.active && canManage && u.role !== 'owner' && u.id !== me && (
                  confirming === u.id ? (
                    <>
                      <button
                        className="btn btn-sm"
                        disabled={busy === u.id}
                        onClick={() => run(u.id, async () => {
                          const d = await api.teamRevoke({ userId: u.id });
                          setConfirming(null);
                          return d;
                        })}
                      >
                        Confirm
                      </button>
                      <button className="btn-ghost" onClick={() => setConfirming(null)}>Cancel</button>
                    </>
                  ) : (
                    <button className="btn-ghost" onClick={() => setConfirming(u.id)}>Revoke</button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
