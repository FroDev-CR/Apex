const API_URL = import.meta.env.VITE_API_URL || '';

async function fetchApi(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const config = {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  };
  const response = await fetch(url, config);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// ─── QuickBooks Online ──────────────────────────────────────────────────────
export const qboApi = {
  status: () => fetchApi('/api/qbo/status'),
  sync: () => fetchApi('/api/qbo/sync', { method: 'POST' }),
  disconnect: () => fetchApi('/api/qbo/disconnect', { method: 'POST' }),
  // Connect redirects the browser — open directly
  getConnectUrl: () => `${API_URL}/api/qbo/connect`
};

// ─── Invoices ───────────────────────────────────────────────────────────────
export const invoicesApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/api/invoices${query ? `?${query}` : ''}`);
  },
  get: (id) => fetchApi(`/api/invoices/${id}`),
  assignCollaborator: (id, collaboratorId) =>
    fetchApi(`/api/invoices/${id}/collaborator`, {
      method: 'PATCH',
      body: JSON.stringify({ collaboratorId })
    }),
  recalculate: () => fetchApi('/api/invoices/recalculate', { method: 'POST' })
};

// ─── Reports ────────────────────────────────────────────────────────────────
export const reportsApi = {
  overview: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/api/reports/overview${query ? `?${query}` : ''}`);
  },
  salary: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/api/reports/salary${query ? `?${query}` : ''}`);
  },
  receivables: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/api/reports/receivables${query ? `?${query}` : ''}`);
  },
  revenue: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/api/reports/revenue${query ? `?${query}` : ''}`);
  },
  margin: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/api/reports/margin${query ? `?${query}` : ''}`);
  }
};

// ─── Collaborators ──────────────────────────────────────────────────────────
export const collaboratorsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/api/collaborators${query ? `?${query}` : ''}`);
  },
  get: (id) => fetchApi(`/api/collaborators/${id}`),
  create: (data) => fetchApi('/api/collaborators', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetchApi(`/api/collaborators/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => fetchApi(`/api/collaborators/${id}`, { method: 'DELETE' })
};
