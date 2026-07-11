import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface UserPreferences {
  theme: 'light' | 'dark';
  currency: string;
  notifications_enabled: boolean;
}

interface User {
  id: number;
  email: string;
  created_at: string;
  preferences?: UserPreferences;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  themeMode: 'light' | 'dark';
  setThemeMode: (mode: 'light' | 'dark') => void;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUserPreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  // Synchronize theme with local browser and preferences
  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  // Load user data on startup if token exists
  useEffect(() => {
    const initializeAuth = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
          
          // Load preferences theme
          const prefsRes = await api.get('/settings/preferences');
          if (prefsRes.data && prefsRes.data.theme) {
            setThemeMode(prefsRes.data.theme);
          }
        } catch (err) {
          console.error("Auth initialization failed:", err);
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, [token]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const res = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const accessToken = res.data.access_token;
      localStorage.setItem('token', accessToken);
      setToken(accessToken);

      // Fetch user profile immediately
      const userRes = await api.get('/auth/me');
      setUser(userRes.data);

      // Load theme preference
      const prefsRes = await api.get('/settings/preferences');
      if (prefsRes.data && prefsRes.data.theme) {
        setThemeMode(prefsRes.data.theme);
      }
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    try {
      // 1. Register User
      await api.post('/auth/register', { email, password });
      
      // 2. Log in automatically after registration
      await login(email, password);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setThemeMode('light');
  };

  const updateUserPreferences = async (prefs: Partial<UserPreferences>) => {
    try {
      const res = await api.put('/settings/preferences', prefs);
      if (res.data && res.data.theme) {
        setThemeMode(res.data.theme);
      }
      if (user) {
        setUser({
          ...user,
          preferences: {
            ...user.preferences,
            ...res.data
          }
        });
      }
    } catch (err) {
      console.error("Failed to update preferences:", err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      token,
      themeMode,
      setThemeMode,
      login,
      signUp,
      logout,
      updateUserPreferences
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
