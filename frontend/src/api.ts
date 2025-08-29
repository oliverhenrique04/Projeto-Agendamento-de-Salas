const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export async function api(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem('token');

  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = data?.error || JSON.stringify(data);
      // detalha campos inválidos, se vier do backend
      if ((data as any)?.details?.fieldErrors) {
        msg += ' · ' + Object.entries((data as any).details.fieldErrors)
          .map(([k, v]: any) => `${k}: ${v.join(', ')}`).join(' · ');
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  if (res.status === 204) return null;
  return res.json();
}
export function isLoggedIn() {
  const token = localStorage.getItem('token');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}