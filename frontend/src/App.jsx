import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { request } from './api.js';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Brand from './components/Brand.jsx';

export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('wellcare_user')); } catch { return null; } });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('wellcare_token')));
  const navigate = useNavigate();
  useEffect(() => {
    if (!localStorage.getItem('wellcare_token')) { setLoading(false); return; }
    request('/auth/me').then(({ user: me }) => { setUser(me); localStorage.setItem('wellcare_user', JSON.stringify(me)); }).catch(() => { localStorage.removeItem('wellcare_token'); localStorage.removeItem('wellcare_user'); setUser(null); }).finally(() => setLoading(false));
  }, []);
  function onAuth(result) { localStorage.setItem('wellcare_token', result.token); localStorage.setItem('wellcare_user', JSON.stringify(result.user)); setUser(result.user); navigate('/app'); }
  function logout() { const token = localStorage.getItem('wellcare_token'); if (token) request('/auth/logout', { method: 'POST' }).catch(() => {}); localStorage.removeItem('wellcare_token'); localStorage.removeItem('wellcare_user'); setUser(null); navigate('/'); }
  if (loading) return <div className="loading"><Brand/><p>Loading your care space…</p></div>;
  return <Routes><Route path="/" element={user ? <Navigate to="/app" replace /> : <AuthPage onAuth={onAuth} />} /><Route path="/app/*" element={user ? <Dashboard user={user} onLogout={logout} /> : <Navigate to="/" replace />} /><Route path="*" element={<Navigate to={user ? '/app' : '/'} replace />} /></Routes>;
}
