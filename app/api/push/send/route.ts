// The daily reminder sender, fired by Vercel Cron (see vercel.json — 23:00 UTC
// = 6 pm in Colombia). Loads every stored subscription and, for anyone who has
// not practiced today, sends the most specific true thing there is to say in
// the student's coaching language; dead subscriptions (410/404) are pruned so
// the table stays clean. Protected by CRON_SECRET when set.
//
// This route only gathers evidence. What the message says — and whether there
// is one at all — is decided by lib/comeback's selectNotification, so the copy
// can be held to a test.

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { selectNotification } from "@/lib/comeback";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Row {
  endpoint: string;
  subscription: webpush.PushSubscription;
  lang: string;
  profile_id: string | null;
}

/** The part of a stored daily session a reminder needs. */
interface SessionPayload {
  startedAt: number | null;
  activities?: Array<{ kind: string; status: string; title: { es: string; en: string } }>;
}

/** Still waiting for the learner, as opposed to done or skipped. */
const open = (status?: string) => status === "pending" || status === "active";

export async function GET(request: Request): Promise<Response> {
  // Vercel Cron sends `authorization: Bearer ${CRON_SECRET}`. Fail CLOSED: a
  // deployment without the secret must refuse to send, not become a public
  // send-to-every-student endpoint because of a missing env var.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Refuse, but say so loudly. Failing closed is right; failing closed and
    // SILENTLY would mean daily reminders simply stop one day with nothing in
    // any log to explain it — the kind of quiet death this app has been bitten
    // by before.
    console.error("[api/push/send] CRON_SECRET is not set — refusing to send. Reminders are OFF until it is configured.");
    return Response.json({ error: "cron_secret_not_configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Service role: push_subscriptions denies all client roles, and the cron sender
  // must read every subscription to deliver reminders.
  const anon = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  // VAPID_SUBJECT is how push services contact the sender; a placeholder can get
  // deliveries throttled, so its absence is a config error like the keys'.
  const subject = process.env.VAPID_SUBJECT;
  if (!url || !anon || !pub || !priv || !subject) {
    // Name the missing pieces (never their values) — "not_configured" alone
    // tells whoever is debugging this at 6pm nothing about which var is absent.
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !anon && "SUPABASE_SERVICE_ROLE_KEY/ANON_KEY",
      !pub && "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
      !priv && "VAPID_PRIVATE_KEY",
      !subject && "VAPID_SUBJECT",
    ].filter(Boolean);
    console.error(`[api/push/send] missing env: ${missing.join(", ")} — reminders not sent.`);
    return Response.json({ error: "not_configured", missing }, { status: 503 });
  }

  webpush.setVapidDetails(subject, pub, priv);
  const sb = createClient(url, anon, { auth: { persistSession: false } });

  const { data, error } = await sb.from("push_subscriptions").select("endpoint,subscription,lang,profile_id");
  if (error) return Response.json({ error: "storage_unavailable" }, { status: 503 });

  const rows = (data ?? []) as Row[];
  const now = Date.now();
  // The cron fires at 18:00 in Colombia, where the UTC and local dates agree,
  // so this matches the local day key the app stores.
  const today = new Date().toISOString().slice(0, 10);

  // Gather what each subscriber could actually be told: whether they practiced
  // today, what today's plan still has open, how much review is genuinely due,
  // and their name.
  const ids = [...new Set(rows.map((r) => r.profile_id).filter((x): x is string => Boolean(x)))];
  const lastActive = new Map<string, string | null>();
  const names = new Map<string, string>();
  const sessions = new Map<string, SessionPayload>();
  const dueReviews = new Map<string, number>();
  if (ids.length) {
    const [statRes, nameRes, sessionRes, dueRes] = await Promise.all([
      sb.from("player_stats").select("profile_id,last_active_day").in("profile_id", ids),
      sb.from("profiles").select("id,name").in("id", ids),
      sb.from("daily_sessions").select("profile_id,payload").eq("day", today).in("profile_id", ids),
      sb.from("progress").select("profile_id").in("profile_id", ids).lte("due_at", now),
    ]);
    for (const s of statRes.data ?? []) lastActive.set(s.profile_id, s.last_active_day);
    for (const p of nameRes.data ?? []) if (p.name) names.set(p.id, p.name);
    // A missing or unreadable session simply means one less specific thing to
    // say — never a reason to fall back to pressure.
    for (const s of sessionRes.data ?? []) sessions.set(s.profile_id, s.payload as SessionPayload);
    for (const p of dueRes.data ?? []) dueReviews.set(p.profile_id, (dueReviews.get(p.profile_id) ?? 0) + 1);
  }

  let sent = 0;
  let pruned = 0;
  let skipped = 0;

  await Promise.all(
    rows.map(async (row) => {
      const id = row.profile_id;
      const session = id ? sessions.get(id) : undefined;
      const speaking = session?.activities?.find((entry) => entry.kind === "speak");
      const msg = selectNotification({
        lang: row.lang === "en" ? "en" : "es",
        name: id ? names.get(id) ?? null : null,
        practicedToday: id ? lastActive.get(id) === today : false,
        unfinishedSpeaking: Boolean(session?.startedAt) && open(speaking?.status),
        dueReviews: id ? dueReviews.get(id) ?? 0 : 0,
        readyActivity: session?.activities?.find((entry) => open(entry.status))?.title ?? null,
      });
      if (!msg) {
        skipped++;
        return;
      }
      try {
        await webpush.sendNotification(
          row.subscription,
          JSON.stringify({ title: msg.title, body: msg.body, url: "/today" }),
          { TTL: 12 * 60 * 60 },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await sb.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
          pruned++;
        }
      }
    }),
  );

  return Response.json({ sent, pruned, skipped, total: rows.length });
}
