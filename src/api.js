async function req(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (_) { data = { error: text }; }
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.code = data.code;
    if (res.status === 401 && data.code === 'unauthenticated') {
      window.dispatchEvent(new Event('oe-unauthenticated'));
    }
    try { err.detail = JSON.parse(data.error); } catch (_) { err.detail = null; }
    throw err;
  }
  return data;
}

export const api = {
  health: () => req('/api/health'),

  session: () => req('/api/auth'),
  requestCode: (body) => req('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'request_code', ...body }) }),
  verifyCode: (body) => req('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'verify_code', ...body }) }),
  logout: () => req('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'logout' }) }),
  team: () => req('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'team_list' }) }),
  teamInvite: (body) => req('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'team_invite', ...body }) }),
  teamRole: (body) => req('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'team_role', ...body }) }),
  teamRevoke: (body) => req('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'team_revoke', ...body }) }),

  listMatters: () => req('/api/matters'),
  getMatter: (id, view) => req(`/api/matters?id=${id}${view ? `&view=${view}` : ''}`),
  createMatter: (body) => req('/api/matters', { method: 'POST', body: JSON.stringify({ action: 'create', ...body }) }),
  saveFields: (body) => req('/api/matters', { method: 'POST', body: JSON.stringify({ action: 'fields', ...body }) }),

  listTemplates: () => req('/api/templates'),
  analyseTemplate: (body) => req('/api/templates', { method: 'POST', body: JSON.stringify({ action: 'analyse', ...body }) }),
  saveTemplate: (body) => req('/api/templates', { method: 'POST', body: JSON.stringify({ action: 'save', ...body }) }),

  listDocuments: (matterId) => req(`/api/documents?matterId=${matterId}`),
  getDocument: (id) => req(`/api/documents?id=${id}`),
  generate: (body) => req('/api/documents', { method: 'POST', body: JSON.stringify({ action: 'generate', ...body }) }),
  regenerate: (body) => req('/api/documents', { method: 'POST', body: JSON.stringify({ action: 'regenerate', ...body }) }),
  editBlock: (body) => req('/api/documents', { method: 'POST', body: JSON.stringify({ action: 'edit_block', ...body }) }),
  flag: (body) => req('/api/documents', { method: 'POST', body: JSON.stringify({ action: 'flag', ...body }) }),
  approve: (body) => req('/api/documents', { method: 'POST', body: JSON.stringify({ action: 'approve', ...body }) }),
  issue: (body) => req('/api/documents', { method: 'POST', body: JSON.stringify({ action: 'issue', ...body }) }),

  downloadUrl: (documentId) => `/api/output?documentId=${documentId}`,
};
