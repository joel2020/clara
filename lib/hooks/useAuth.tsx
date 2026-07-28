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
  /** Start the Google OAuth redirect; returns to /auth/callback. */
  signInWithGoogle: () => Promise<{ error: string | null }>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  /** Send a password-reset email; the link lands on /reset. */
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  /** Set a new password for the recovery session opened by the emailed link. */
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const required = syncEnabled();
  // Ready immediately when auth is not required OR when Supabase is not configured
  // at all — both are knowable synchronously from env, so deciding them here avoids
  // a setState inside the effect (and one wasted render on every load).
  const [ready, setReady] = useState(() => !required || supabase() === null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!required) return;
    const sb = supabase();
    // The unconfigured case already resolved `ready` in the initialiser above.
    if (!sb) return;
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

  /**
   * Google sign-in.
   *
   * Kept alongside email+password rather than replacing it: an OAuth round trip
   * can bounce out of the installed iOS PWA into Safari (the same reason magic
   * links were rejected), and password sign-in is the reliable fallback there.
   * The allowlist still decides who actually gets in — a Google account that
   * isn't allow-listed lands on the "no access" screen like any other.
   */
  const signInWithGoogle = async () => {
    const sb = supabase();
    if (!sb) return { error: "auth_unavailable" };
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        // Always show the chooser: these are shared/family devices, and silently
        // reusing whichever Google account is already signed in is confusing.
        queryParams: { prompt: "select_account" },
      },
    });
    return { error: error?.message ?? null };
  };

  const resendConfirmation = async (email: string) => {
    const sb = supabase();
    if (!sb) return { error: "auth_unavailable" };
    const { error } = await sb.auth.resend({ type: "signup", email: email.trim() });
    return { error: error?.message ?? null };
  };

  const resetPassword = async (email: string) => {
    const sb = supabase();
    if (!sb) return { error: "auth_unavailable" };
    // The emailed link returns here with a recovery token in the URL; AuthGate
    // intercepts /reset and shows the set-new-password screen.
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/reset` : undefined;
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const sb = supabase();
    if (!sb) return { error: "auth_unavailable" };
    const { error } = await sb.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    const sb = supabase();
    if (sb) await sb.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ ready, required, session, user: session?.user ?? null, signIn, signUp, signInWithGoogle, resendConfirmation, resetPassword, updatePassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
