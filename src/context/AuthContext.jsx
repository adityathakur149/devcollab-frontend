import { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser, getProfile } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('devcollab_token'));
  const [loading, setLoading] = useState(true);

  // Load user profile on mount if we have a stored token
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const res = await getProfile(token);
          setUser(res.data);
        } catch (err) {
          console.error('[Auth] Failed to load profile:', err.message);
          // Token is invalid or expired — clear it
          localStorage.removeItem('devcollab_token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (email, password) => {
    const res = await loginUser(email, password);
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('devcollab_token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = async (username, email, password) => {
    const res = await registerUser(username, email, password);
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('devcollab_token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('devcollab_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
