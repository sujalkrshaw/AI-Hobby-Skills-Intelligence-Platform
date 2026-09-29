const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function authHeaders(extra = {}) {
  const token = localStorage.getItem('token');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = authHeaders({
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  });

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const d = await res.json();
      if (typeof d.detail === 'string') msg = d.detail;
      else if (Array.isArray(d.detail)) msg = d.detail.map(x => x.msg || JSON.stringify(x)).join('; ');
    } catch {}
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

export async function login(email, password) {
  const d = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem('token', d.access_token);
  return d;
}

export async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);
  return api('/api/files/upload', { method: 'POST', body: form });
}
