import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wellcare_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export async function request(path, config) {
  try { const { data } = await api.request({ url: path, ...config }); return data; }
  catch (error) {
    if (!error.response) throw new Error(`The browser could not access WELLCARE API at ${api.defaults.baseURL}. Confirm the backend is running with "npm run dev:backend"; if it is running, check CLIENT_ORIGIN for a CORS origin mismatch.`);
    throw new Error(error.response.data?.error || `WELLCARE API returned an error (${error.response.status}). Check the API terminal for details.`);
  }
}

export async function checkApiHealth() {
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1').replace(/\/api\/v1\/?$/, '');
  try {
    const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(4000) });
    const data = await response.json();
    return { ok: response.ok && data.database === 'connected', api: 'online', database: data.database || 'unknown', message: data.message || '' };
  } catch {
    return { ok: false, api: 'offline', database: 'unknown', message: `Could not access API at ${base}. The backend may be stopped, or the browser may be blocking this frontend origin (CORS).` };
  }
}
