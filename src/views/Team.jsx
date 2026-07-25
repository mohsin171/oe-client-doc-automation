import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const ROLE_NOTE = {
  owner: 'Full access. Manages templates and the team.',
  approver: 'Can draft and can sign off documents.',
  drafter: 'Can draft and prepare. Cannot sign off.',
};

export default function Team() {
  const [state, setState] = useState({ loading: true, team: [] });
  const [invite, setInvite] = useState({ name: '', email: '', role: 'drafter' });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null);

  async function load() {
    try {
      const d = await api.team();
      setState({ loading: false, ...d });
    } catch (e) {
      setState({ loading: false, error: e.message, team: [] });
    }
  }

  useEffect(() => { load(); }, []);

  async function doInvite() {
    setBusy('invite');
    setError(null);
    try {
      const d = await api.teamInvite(invite);
      setState((s) => ({ ...s, team: d.team }));
      setInvite({ name: '', email: '', role: 'drafter' });
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  async function changeRole(userId, role) {
    setBusy(userId);
    setError(null);
    try {
      const d = await api.teamRole({ userId, role });
      setState((s) => ({ ...s, team: d.team }));
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  async function revoke(userId) {
    setBusy(userId);
    setError(null);
    try {
      const d = await api.teamRevoke({ userId });
      setState((s) => ({ ...s, team: d.team }));
      setConfirming(null);
    } catch (e) { setError(e.message); }
    setBusy(null);
  }

  if (state.loading) return <p className="muted">Loading…</p>;
  if (state.error) return <p className="err">{state.error}</p>;

  const { team = [], canManage, me } = state;

  return (
    <div>
      <h2 className="view-title">Team</h2>
      <p className="muted small">
        Access is invite only. Sign-off authority is enforced by the system, not
        by convention, so a drafter cannot approve a document even if they try.
      </p>

      {error && <p className="err">{error}</p>}

      {canManage && (
        <div className="card">
          <div className="card-head"><h3>Invite someone</h3></div>
          <div className="invite-grid">
            <label className="gap-input">
              <span>Name</span>
              <input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
            </label>
            <label className="gap-input">
              <span>Work email</span>
              <input value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            </label>
            <label className="gap-input">
              <span>Role</span>
              <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                <option value="drafter">Drafter</option>
                <option value="approver">Approver</option>
              </select>
            </label>
          </div>
          <p className="hint">{ROLE_NOTE[invite.role]}</p>
          <button
            className="btn-primary"
            disabled={busy === 'invite' || !invite.name || !invite.email.includes('@')}
            onClick={doInvite}
          >
            {busy === 'invite' ? 'Inviting…' : 'Send invitation'}
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3>People</h3></div>
        <div className="list">
          {team.map((u) => (
            <div key={u.id} className={`list-row static ${u.active ? '' : 'revoked'}`}>
              <div className="list-main">
                <strong>{u.name}{u.id === me ? ' (you)' : ''}</strong>
                <span className="muted small">{u.email}</span>
                <span className="hint">
                  {u.last_login_at
                    ? `Last signed in ${new Date(u.last_login_at).toLocaleDateString('en-GB')}`
                    : 'Has not signed in yet'}
                </span>
              </div>

              <div className="list-side">
                {!u.active && <span className="tag">revoked</span>}

                {u.active && canManage && u.role !== 'owner' && u.id !== me ? (
                  <select
                    className="role-select"
                    value={u.role}
                    disabled={busy === u.id}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                  >
                    <option value="drafter">Drafter</option>
                    <option value="approver">Approver</option>
                  </select>
                ) : (
                  <span className={`tag tag-${u.role === 'owner' ? 'approved' : 'active'}`}>{u.role}</span>
                )}

                {u.active && canManage && u.role !== 'owner' && u.id !== me && (
                  confirming === u.id ? (
                    <>
                      <button className="btn-tiny" disabled={busy === u.id} onClick={() => revoke(u.id)}>
                        Confirm
                      </button>
                      <button className="btn-tiny ghost" onClick={() => setConfirming(null)}>Cancel</button>
                    </>
                  ) : (
                    <button className="btn-tiny ghost" onClick={() => setConfirming(u.id)}>Revoke</button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>

        {canManage && (
          <p className="hint" style={{ marginTop: 14 }}>
            Revoking someone ends their current session immediately rather than
            waiting for it to expire.
          </p>
        )}
      </div>
    </div>
  );
}
