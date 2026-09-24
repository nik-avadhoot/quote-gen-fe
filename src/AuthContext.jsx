import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { hasSession, login as apiLogin, logout as apiLogout, refreshSession, subscribe } from "./lib/apiClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (hasSession()) {
        try {
          const p = await refreshSession();
          if (!cancelled) setProfile(p);
        } catch {
          if (!cancelled) setProfile(null);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => subscribe((session, p) => setProfile(session ? p : null)), []);

  const signIn = useCallback(async (email, password) => {
    const p = await apiLogin(email, password);
    setProfile(p);
    return p;
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout();
    setProfile(null);
  }, []);

  const value = {
    profile,
    loading,
    isActive: profile?.active !== false,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Development-only full-shell evidence. The production Gate never calls this
// provider; it exists so the Batch-first navigation can be exercised at the
// beta laptop width for exact capability profiles without credentials, API
// writes or invented governed records.
export function AuthFixtureProvider({ children, profile }) {
  if (!import.meta.env.DEV) return null;
  const value = {
    profile,
    loading: false,
    isActive: true,
    signIn: async () => profile,
    signOut: async () => {},
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
