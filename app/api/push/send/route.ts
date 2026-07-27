// The daily reminder sender, fired by Vercel Cron (see vercel.json — 23:00 UTC
// = 6 pm in Colombia). Loads every stored subscription and sends a warm, short
// nudge in the student's coaching language; dead subscriptions (410/404) are
// pruned so the table stays clean. Protected by CRON_SECRET when set.

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";
export const maxDuration = 60;

const MESSAGES = {
  es: [
    { title: "¡Lumi te espera! ⭐", body: "Tu sesión de hoy toma 15 minuticos. ¡Vamos!" },
    { title: "Tu racha te necesita 🔥", body: "Un ratico de práctica y sigue viva." },
    { title: "¿Hablamos inglés hoy?", body: "Joel tiene una conversación lista para ti." },
    { title: "Tu cofre diario está listo 🎁", body: "Ábrelo y gana estrellas gratis." },
  ],
  en: [
    { title: "Lumi is waiting! ⭐", body: "Today's session takes 15 little minutes. Let's go!" },
    { title: "Your streak needs you 🔥", body: "A quick practice keeps it alive." },
    { title: "English today?", body: "Joel has a conversation ready for you." },
    { title: "Your daily chest is ready 🎁", body: "Open it for free stars." },
  ],
};

interface Row {
  endpoint: string;
  subscription: webpush.PushSubscription;
  lang: string;
  profile_id: string | null;
}

// A personalized, streak-aware nudge. Returns null when the learner already
// practiced today (don't nag). Uses their name + streak so it feels personal.
function buildMessage(
  lang: "es" | "en",
  name: string | null,
  streak: number,
  practicedToday: boolean,
  dayIndex: number,
): { title: string; body: string } | null {
  if (practicedToday) return null;
  const who = name ? name.split(" ")[0] : null;
  const hi = who ? `${who}, ` : "";
  if (streak >= 2) {
    return lang === "en"
      ? { title: `Your ${streak}-day streak 🔥`, body: `${hi}keep it alive — a few minutes is all it takes.` }
      : { title: `Tu racha de ${streak} días 🔥`, body: `${hi}no la dejes caer — con unos minuticos basta.` };
  }
  const pool = lang === "en" ? MESSAGES.en : MESSAGES.es;
  const m = pool[dayIndex % pool.length];
  return who ? { title: m.title, body: `${who}, ${m.body}` } : m;
}

export async function GET(request: Request): Promise<Response> {
  // Vercel Cron sends `authorization: Bearer ${CRON_SECRET}` when configured.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Service role: push_subscriptions denies all client roles, and the cron sender
  // must read every subscription to deliver reminders.
  const anon = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!url || !anon || !pub || !priv) return Response.json({ error: "not_configured" }, { status: 503 });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@example.com", pub, priv);
  const sb = createClient(url, anon, { auth: { persistSession: false } });

  const { data, error } = await sb.from("push_subscriptions").select("endpoint,subscription,lang,profile_id");
  if (error) return Response.json({ error: "storage_unavailable" }, { status: 503 });

  const rows = (data ?? []) as Row[];
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const today = new Date().toISOString().slice(0, 10);

  // Pull each subscriber's streak + last-active + name so the nudge is personal
  // and we can skip anyone who already practiced today.
  const ids = [...new Set(rows.map((r) => r.profile_id).filter((x): x is string => Boolean(x)))];
  const stats = new Map<string, { streak: number; lastActive: string | null }>();
  const names = new Map<string, string>();
  if (ids.length) {
    const [statRes, nameRes] = await Promise.all([
      sb.from("player_stats").select("profile_id,current_streak,last_active_day").in("profile_id", ids),
      sb.from("profiles").select("id,name").in("id", ids),
    ]);
    for (const s of statRes.data ?? []) stats.set(s.profile_id, { streak: s.current_streak ?? 0, lastActive: s.last_active_day });
    for (const p of nameRes.data ?? []) if (p.name) names.set(p.id, p.name);
  }

  let sent = 0;
  let pruned = 0;
  let skipped = 0;

  await Promise.all(
    rows.map(async (row) => {
      const st = row.profile_id ? stats.get(row.profile_id) : undefined;
      const name = row.profile_id ? names.get(row.profile_id) ?? null : null;
      const msg = buildMessage(
        row.lang === "en" ? "en" : "es",
        name,
        st?.streak ?? 0,
        st?.lastActive === today,
        dayIndex,
      );
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
