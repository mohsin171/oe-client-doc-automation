// Browser history.
//
// Every screen change lived in React state, so back did nothing or left the
// application entirely, and a refresh dropped you on Clients wherever you had
// been. Both are things people do without thinking.
//
// Done with the History API rather than a router. The state here is three values,
// and a routing library would be more code than the thing it routes.

const TABS = ['clients', 'documents', 'templates', 'team', 'new'];

const SEGMENT = {
  clients: 'clients',
  documents: 'documents',
  templates: 'letters',
  team: 'team',
  new: 'new-client',
};

const FROM_SEGMENT = Object.fromEntries(
  Object.entries(SEGMENT).map(([tab, seg]) => [seg, tab])
);

// A place is a tab, optionally a client file, optionally a document within it.
export function toPath({ tab, matterId, documentId, editing }) {
  if (documentId) return `/documents/${documentId}`;
  if (matterId) return `/clients/${matterId}${editing ? '/edit' : ''}`;
  return `/${SEGMENT[tab] || 'clients'}`;
}

export function fromPath(pathname) {
  const parts = String(pathname || '/').split('/').filter(Boolean);
  if (parts.length === 0) return { tab: 'clients', matterId: null, documentId: null };

  const [first, second] = parts;

  if (first === 'documents' && second) {
    return { tab: 'documents', matterId: null, documentId: Number(second) };
  }
  if (first === 'clients' && second) {
    return {
      tab: 'clients',
      matterId: Number(second),
      documentId: null,
      editing: parts[2] === 'edit',
    };
  }

  const tab = FROM_SEGMENT[first];
  return {
    tab: TABS.includes(tab) ? tab : 'clients',
    matterId: null,
    documentId: null,
  };
}

export function samePlace(a, b) {
  return a.tab === b.tab
    && Number(a.matterId) === Number(b.matterId)
    && Number(a.documentId) === Number(b.documentId)
    && Boolean(a.editing) === Boolean(b.editing);
}
