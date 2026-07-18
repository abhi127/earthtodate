import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

const VALID_USER = 'admin';
const VALID_PASS = 'admin123';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = sessionStorage.getItem('geosyze_auth');
    if (auth === 'true') setUser({ username: VALID_USER });
    setLoading(false);
  }, []);

  function login(username, password) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (username === VALID_USER && password === VALID_PASS) {
          sessionStorage.setItem('geosyze_auth', 'true');
          setUser({ username });
          navigate('/', { replace: true });
          resolve();
        } else {
          reject(new Error('Invalid username or password'));
        }
      }, 1000);
    });
  }

  function logout() {
    sessionStorage.removeItem('geosyze_auth');
    setUser(null);
    navigate('/login', { replace: true });
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
