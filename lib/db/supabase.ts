"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The Supabase client, created only when the app is configured for cloud sync.
// The app is local-first (IndexedDB); Supabase is an optional mirror that adds
// cross-device sync and the instructor's view of each student. When the env
// vars are absent, everything here no-ops and the app runs purely on Dexie.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      // Persist the signed-in session (in localStorage) and keep it fresh, so
      // the login gate survives reloads and the PWA relaunching.
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return client;
}

export function syncEnabled(): boolean {
  return Boolean(url && key);
}
