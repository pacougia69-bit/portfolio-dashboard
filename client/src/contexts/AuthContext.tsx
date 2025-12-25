import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isPinSet: boolean;
  login: (pin: string) => boolean;
  logout: () => void;
  setPin: (pin: string) => void;
  changePin: (oldPin: string, newPin: string) => boolean;
  resetPin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PIN_STORAGE_KEY = 'portfolio_pin_hash';
const AUTH_SESSION_KEY = 'portfolio_auth_session';

// Simple hash function for PIN (not cryptographically secure, but sufficient for local storage)
function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPinSet, setIsPinSet] = useState(false);

  useEffect(() => {
    // Check if PIN is set
    const storedPin = localStorage.getItem(PIN_STORAGE_KEY);
    setIsPinSet(!!storedPin);

    // Check session (valid for current browser session)
    const session = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (session === 'true' && storedPin) {
      setIsAuthenticated(true);
    }
  }, []);

  const login = (pin: string): boolean => {
    const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
    if (!storedHash) return false;

    const inputHash = hashPin(pin);
    if (inputHash === storedHash) {
      setIsAuthenticated(true);
      sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  };

  const setPin = (pin: string) => {
    const hash = hashPin(pin);
    localStorage.setItem(PIN_STORAGE_KEY, hash);
    setIsPinSet(true);
    setIsAuthenticated(true);
    sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
  };

  const changePin = (oldPin: string, newPin: string): boolean => {
    const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
    if (!storedHash) return false;

    const oldHash = hashPin(oldPin);
    if (oldHash !== storedHash) return false;

    const newHash = hashPin(newPin);
    localStorage.setItem(PIN_STORAGE_KEY, newHash);
    return true;
  };

  const resetPin = () => {
    localStorage.removeItem(PIN_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    setIsPinSet(false);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isPinSet,
      login,
      logout,
      setPin,
      changePin,
      resetPin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
