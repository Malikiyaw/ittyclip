"use client";

import { create } from "zustand";

const SESSION_KEY = "ittyclip.session";

export interface AuthSession {
  email: string;
  name: string;
}

interface AuthState {
  session: AuthSession | null;
  hydrated: boolean;
  login: (email: string, name?: string) => void;
  signup: (email: string, name: string) => void;
  logout: () => void;
}

function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed || typeof parsed.email !== "string") return null;
    return { email: parsed.email, name: parsed.name || parsed.email };
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>()((set) => ({
  session: null,
  hydrated: false,
  login: (email, name) => {
    const session: AuthSession = { email, name: name || email };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    set({ session, hydrated: true });
  },
  signup: (email, name) => {
    const session: AuthSession = { email, name: name || email };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    set({ session, hydrated: true });
  },
  logout: () => {
    window.localStorage.removeItem(SESSION_KEY);
    set({ session: null, hydrated: true });
  },
}));

export function hydrateAuth(): void {
  const s = useAuth.getState();
  if (s.hydrated) return;
  setAuthSession(readSession());
}

export function setAuthSession(session: AuthSession | null): void {
  useAuth.setState({ session, hydrated: true });
}

export function isSignedIn(): boolean {
  return useAuth.getState().session !== null;
}
