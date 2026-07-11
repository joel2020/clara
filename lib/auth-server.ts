import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

// Server-side session check for the paid API routes. The client sends its
// Supabase access token as `Authorization: Bearer <jwt>`; we validate it against
// the project and return the user, or null. When Supabase isn't configured
// (local dev), auth is treated as disabled so routes stay usable.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when an auth backend exists and routes must require a signed-in user. */
export function authRequired(): boolean {
  return Boolean(url && anon);
}

export async function getAuthedUser(request: Request): Promise<User | null> {
  if (!url || !anon) return null;
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  try {
    const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.getUser(token);
    if (error) return null;
    return data.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Guard for a paid route: returns a 401 Response when auth is required but the
 * request has no valid session, or null to proceed.
 */
export async function requireUser(request: Request): Promise<Response | null> {
  if (!authRequired()) return null;
  const user = await getAuthedUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}
