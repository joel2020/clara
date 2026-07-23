"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, syncEnabled } from "@/lib/db/supabase";

// Account login for Clara. The app is public, so a real Supabase Auth session is
// the gate: no session, no app and no paid API calls. When Supabase isn't
// configured (local dev without env), auth is simply disabled and everything
// runs open — production always has it, so the gate is always on there.

interface AuthContextValue {
  ready: boolean;
  /** True only when a real auth backend exists; false → gate is bypassed. */
  required: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const required = syncEnabled();
  const [ready, setReady] = useState(!required);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!required) return;
    const sb = supabase();
    if (!sb) {
      setReady(true);
      return;
    }
    let active = true;
    sb.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [required]);

  const signIn = async (email: string, password: string) => {
    const sb = supabase();
    if (!sb) return { error: "auth_unavailable" };
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    const sb = supabase();
    if (!sb) return { error: "auth_unavailable" };
    const { error } = await sb.auth.signUp({ email: email.trim(), password });
    return { error: error?.message ?? null };
  };

  const resendConfirmation = async (email: string) => {
    const sb = supabase();
    if (!sb) return { error: "auth_unavailable" };
    const { error } = await sb.auth.resend({ type: "signup", email: email.trim() });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    const sb = supabase();
    if (sb) await sb.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ ready, required, session, user: session?.user ?? null, signIn, signUp, resendConfirmation, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
