import * as SecureStore from 'expo-secure-store';
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { apiRequest } from '../config/api';

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  locale: 'es' | 'en';
  theme: 'system' | 'light' | 'dark';
  isPremium: boolean;
};

type Session = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
};

export type RegisterInput = {
  email: string;
  password: string;
  username: string;
  displayName: string;
  locale: 'es' | 'en';
  timezone: string;
};

type AuthResponse = Session;
type RefreshResponse = Pick<Session, 'accessToken' | 'refreshToken' | 'expiresAt'>;

const STORAGE_KEY = 'florece.auth.session.v1';
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  const saveSession = async (nextSession: Session) => {
    setSession(nextSession);
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(nextSession));
  };

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!stored) return;
        const previous = JSON.parse(stored) as Session;
        const refreshed = await apiRequest<RefreshResponse>('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: previous.refreshToken }),
        });
        await saveSession({ ...previous, ...refreshed });
      } catch {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
      } finally {
        setIsReady(true);
      }
    };

    void restoreSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    const nextSession = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await saveSession(nextSession);
  };

  const register = async (input: RegisterInput) => {
    const nextSession = await apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    await saveSession(nextSession);
  };

  const signOut = async () => {
    const refreshToken = session?.refreshToken;
    setSession(null);
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    if (!refreshToken) return;
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
    } catch {
      // Removing the local session is enough when the device is offline.
    }
  };

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    accessToken: session?.accessToken ?? null,
    isAuthenticated: Boolean(session),
    isReady,
    signIn,
    register,
    signOut,
  }), [session, isReady]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
