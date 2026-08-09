// Push subscription management. The client subscribes via the service worker
// and posts the subscription here; we store it in Supabase.
// The table is locked to no client access, so this route uses the service role. Env-gated twice: VAPID keys AND
// Supabase must be configured, otherwise the client hides the feature.
//
// Guarded like the paid routes: the table denies client roles, so this route is
// the only writer — an unauthenticated writer here would reopen the exact door
// the RLS lock closed. The subscription is bound to the SESSION's user id, never
// a caller-chosen profile id (which would let anyone receive another student's
// personalized reminders).

import { createClient } from "@supabase/supabase-js";
import { guardApi } from "../../../lib/api-guard.ts";
import { getAuthedUser, requireAllowedUser } from "../../../lib/auth-server.ts";

export const runtime = "nodejs";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Service role, not the anon key. push_subscriptions is locked to no client
  // access (its rows hold each device's push endpoint and crypto keys), so this
  // trusted server route is the only thing that may read or write it. Falls back to
  // the anon key so a deployment without the service role still reports
  // enabled:false rather than throwing — but writes will correctly be refused.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function pushReady(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && supa());
}

export async function GET(): Promise<Response> {
  return Response.json({ enabled: pushReady() });
}

interface SubscribeBody {
  subscription?: { endpoint?: string };
  lang?: string;
}

export async function POST(request: Request): Promise<Response> {
  const blocked = guardApi(request);
  if (blocked) return blocked;
  const unauth = await requireAllowedUser(request);
  if (unauth) return unauth;
  const user = await getAuthedUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const sb = supa();
  if (!pushReady() || !sb) return Response.json({ error: "not_configured" }, { status: 503 });

  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const endpoint = body.subscription?.endpoint;
  if (!endpoint || typeof endpoint !== "string") {
    return Response.json({ error: "Missing subscription." }, { status: 400 });
  }

  const { error } = await sb.from("push_subscriptions").upsert(
    {
      endpoint,
      subscription: body.subscription,
      profile_id: user.id,
      lang: body.lang === "en" ? "en" : "es",
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    // Most likely: the table hasn't been created yet.
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request): Promise<Response> {
  const blocked = guardApi(request);
  if (blocked) return blocked;
  const unauth = await requireAllowedUser(request);
  if (unauth) return unauth;
  const user = await getAuthedUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const sb = supa();
  if (!sb) return Response.json({ error: "not_configured" }, { status: 503 });
  let endpoint: unknown;
  try {
    ({ endpoint } = (await request.json()) as { endpoint?: unknown });
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  if (typeof endpoint !== "string" || !endpoint) {
    return Response.json({ error: "Missing endpoint." }, { status: 400 });
  }
  // The service-role client bypasses RLS, so both endpoint and owner predicates
  // are mandatory: one student must never delete another student's row.
  await sb.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("profile_id", user.id);
  return Response.json({ ok: true });
}
