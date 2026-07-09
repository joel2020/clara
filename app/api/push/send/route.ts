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
}

export async function GET(request: Request): Promise<Response> {
  // Vercel Cron sends `authorization: Bearer ${CRON_SECRET}` when configured.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!url || !anon || !pub || !priv) return Response.json({ error: "not_configured" }, { status: 503 });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@example.com", pub, priv);
  const sb = createClient(url, anon, { auth: { persistSession: false } });

  const { data, error } = await sb.from("push_subscriptions").select("endpoint,subscription,lang");
  if (error) return Response.json({ error: "storage_unavailable" }, { status: 503 });

  const rows = (data ?? []) as Row[];
  // Same pick for everyone today — varied day to day.
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  let sent = 0;
  let pruned = 0;

  await Promise.all(
    rows.map(async (row) => {
      const pool = row.lang === "en" ? MESSAGES.en : MESSAGES.es;
      const msg = pool[dayIndex % pool.length];
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

  return Response.json({ sent, pruned, total: rows.length });
}
