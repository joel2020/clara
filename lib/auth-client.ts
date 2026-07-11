"use client";

import { supabase } from "@/lib/db/supabase";

// Attaches the signed-in user's access token to calls to the paid API routes so
// the server can authorize them. Returns {} when there's no session or no auth
// backend, which is fine for local dev (the routes only require auth in prod).

export async function authHeaders(): Promise<Record<string, string>> {
  const sb = supabase();
  if (!sb) return {};
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
