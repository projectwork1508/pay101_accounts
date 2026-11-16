import { createContext, useContext, useState, useEffect } from 'react';
import accountsAPI from '../api/accounts_api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('accountsUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = accountsAPI.getToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const res = await accountsAPI.verifyToken();
        if (res.success) {
          const userData = { email: res.email, full_name: res.name, role: res.role };
          setUser(userData);
          localStorage.setItem('accountsUser', JSON.stringify(userData));
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const res = await accountsAPI.login(email, password);
    if (res.success && res.user) {
      setUser(res.user);
      localStorage.setItem('accountsUser', JSON.stringify(res.user));
    }
    return res;
  };

  const logout = () => {
    accountsAPI.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
