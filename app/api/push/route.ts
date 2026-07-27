// Push subscription management. The client subscribes via the service worker
// and posts the subscription here; we store it in Supabase.
// The table is locked to no client access, so this route uses the service role. Env-gated twice: VAPID keys AND
// Supabase must be configured, otherwise the client hides the feature.

import { createClient } from "@supabase/supabase-js";

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
  profileId?: string | null;
  lang?: string;
}

export async function POST(request: Request): Promise<Response> {
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
      profile_id: body.profileId ?? null,
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
  await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return Response.json({ ok: true });
}
