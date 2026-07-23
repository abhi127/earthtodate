import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

const API_URL = '/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const navigate = useNavigate();

  // Check saved session on mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem('accessToken');
    const savedRefresh = sessionStorage.getItem('refreshToken');
    if (savedToken && savedRefresh) {
      setAccessToken(savedToken);
      try {
        const payload = JSON.parse(atob(savedToken.split('.')[1]));
        setUser({ id: payload.sub, username: payload.username, role: payload.role });
      } catch {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
      }
    }
    setLoading(false);
  }, []);

  async function login(username, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(Array.isArray(err.message) ? err.message[0] : err.message);
    }

    const data = await res.json();
    sessionStorage.setItem('accessToken', data.accessToken);
    sessionStorage.setItem('refreshToken', data.refreshToken);
    setAccessToken(data.accessToken);
    setUser(data.user);
    navigate('/', { replace: true });
  }

  async function logout() {
    const rt = sessionStorage.getItem('refreshToken');
    if (rt) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
      } catch { /* ignore */ }
    }
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    setAccessToken(null);
    setUser(null);
    navigate('/login', { replace: true });
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, accessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
