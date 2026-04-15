const API_URL = import.meta.env.VITE_API_URL || '';

// ─── Core fetch with auto-retry on network/cold-start errors ───────────────
// Render free tier spins down after inactivity. First request after sleep
// returns no headers (browser shows CORS error). We retry up to 3 times
// with increasing delays so the user never has to manually reload.
async function fetchApi(endpoint, options = {}, attempt = 1) {
  const MAX_ATTEMPTS = 3;
  const url = `${API_URL}${endpoint}`;
  const config = {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }
    return response.json();
  } catch (err) {
    // Network errors (TypeError) = server is waking up. Retry with backoff.
    const isNetworkError = err instanceof TypeError;
    if (isNetworkError && attempt < MAX_ATTEMPTS) {
      const delay = attempt * 4000; // 4s, 8s
      console.warn(`⚠️ Server cold start — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${delay / 1000}s`);
      await new Promise(r => setTimeout(r, delay));
      return fetchApi(endpoint, options, attempt + 1);
    }
    throw err;
  }
}

// ─── Keep-alive: ping every 4 min to prevent Render from sleeping ──────────
// Only runs when the tab is visible and API_URL is set (i.e. production).
if (API_URL) {
  const ping = () => {
    if (document.visibilityState === 'visible') {
      fetch(`${API_URL}/api/health`).catch(() => {});
    }
  };
  // Initial ping on load (wakes server early, before user interacts)
  setTimeout(ping, 1000);
  // Keep-alive every 4 minutes
  setInterval(ping, 4 * 60 * 1000);
}

// ─── QuickBooks Online ──────────────────────────────────────────────────────
export const qboApi = {
  status: () => fetchApi('/api/qbo/status'),
  sync: () => fetchApi('/api/qbo/sync', { method: 'POST' }),
  disconnect: () => fetchApi('/api/qbo/disconnect', { method: 'POST' }),
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
  },
  export: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/api/reports/export${query ? `?${query}` : ''}`);
  }
};

// ─── External Payments ──────────────────────────────────────────────────────
export const paymentsApi = {
  list:   ()       => fetchApi('/api/payments'),
  create: (data)   => fetchApi('/api/payments', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id)     => fetchApi(`/api/payments/${id}`, { method: 'DELETE' }),
};

// ─── App Settings ───────────────────────────────────────────────────────────
export const settingsApi = {
  get:   ()     => fetchApi('/api/settings'),
  patch: (data) => fetchApi('/api/settings', { method: 'PATCH', body: JSON.stringify(data) }),
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
