import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { accessFlags } from "./allowlist.ts";

// Server-side session checks. The client sends its
// Supabase access token as `Authorization: Bearer <jwt>`; we validate it against
// the project and return the user, or null. Legacy non-paid local routes may
// bypass missing auth; paid routes require a verified UUID and fail closed.

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
 * Guard for an authenticated route. Clara's family-and-friends beta is open to
 * any signed-in Google account; admin capabilities remain separately gated.
 * Returns null to proceed.
 */
export async function requireUser(request: Request): Promise<Response | null> {
  if (!authRequired()) {
    // No auth backend configured. In dev that means "auth disabled" on purpose;
    // in production it means a broken deploy (missing env vars) — fail CLOSED
    // rather than silently turning every paid route public.
    if (process.env.NODE_ENV === "production") {
      return new Response(JSON.stringify({ error: "auth_not_configured" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    return null;
  }
  const user = await getAuthedUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}

/** Guard for routes restricted to invited learners and administrators. */
export async function requireAllowedUser(request: Request): Promise<Response | null> {
  // Preserve the legacy local-dev bypass for non-paid routes such as push.
  // Paid routes call requireAllowedUserIdentity and therefore still require a
  // server-verified UUID before durable quota consumption.
  if (!authRequired() && process.env.NODE_ENV !== "production") return null;
  const result = await requireAllowedUserIdentity(request);
  return "response" in result ? result.response : null;
}

export type AllowedUserResult = { user: User } | { response: Response };

/** Authenticate and authorize once, returning the server-verified identity. */
export async function requireAllowedUserIdentity(request: Request): Promise<AllowedUserResult> {
  if (!authRequired()) {
    // Paid routes need a real UUID for durable quotas even in development. A
    // missing auth backend therefore cannot produce an allowed identity here.
    return {
      response: new Response(JSON.stringify({ error: "auth_not_configured" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    };
  }

  const user = await getAuthedUser(request);
  if (!user) {
    return {
      response: new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    };
  }
  if (!accessFlags(user).allowed) {
    return {
      response: new Response(JSON.stringify({ error: "not_allowed" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    };
  }
  return { user };
}
