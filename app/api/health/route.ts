// Production configuration check, for the teacher only.
//
// Every integration in this app is env-gated and degrades quietly by design —
// which is right for a learner mid-practice, but it means a missing key looks
// exactly like a feature nobody used. There was no way to answer "is production
// actually wired up?" without reading Vercel's dashboard and guessing.
//
// This reports whether each piece is CONFIGURED. It never returns a key, a
// prefix, or a length — only booleans — so it cannot leak a secret even if the
// admin check were somehow bypassed.

import { getAuthedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/allowlist";

export const runtime = "nodejs";

const has = (v: string | undefined | null): boolean => Boolean(v && v.trim());

export async function GET(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!isAdmin(user?.email)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const azureChat =
    has(process.env.AZURE_OPENAI_ENDPOINT) &&
    has(process.env.AZURE_OPENAI_API_KEY) &&
    has(process.env.AZURE_OPENAI_DEPLOYMENT);

  const checks = {
    // Auth + data
    supabaseUrl: has(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: has(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRole: has(process.env.SUPABASE_SERVICE_ROLE_KEY),
    // Conversation brain: Azure preferred, OpenAI fallback
    azureChat,
    openaiKey: has(process.env.OPENAI_API_KEY),
    chatAvailable: azureChat || has(process.env.OPENAI_API_KEY),
    // Speech
    elevenLabs: has(process.env.ELEVENLABS_API_KEY),
    azureSpeech: has(process.env.AZURE_SPEECH_KEY) && has(process.env.AZURE_SPEECH_REGION),
    // Reminders — all four are required for the daily cron to send
    vapidPublic: has(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    vapidPrivate: has(process.env.VAPID_PRIVATE_KEY),
    vapidSubject: has(process.env.VAPID_SUBJECT),
    cronSecret: has(process.env.CRON_SECRET),
    // Optional sign-in method
    googleAuthEnabled: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true",
  };

  // The things a student would actually notice if they were missing.
  const critical: (keyof typeof checks)[] = [
    "supabaseUrl",
    "supabaseAnonKey",
    "supabaseServiceRole",
    "chatAvailable",
    "elevenLabs",
    "azureSpeech",
  ];
  const remindersKeys: (keyof typeof checks)[] = [
    "vapidPublic",
    "vapidPrivate",
    "vapidSubject",
    "cronSecret",
  ];

  const missingCritical = critical.filter((k) => !checks[k]);
  const missingReminders = remindersKeys.filter((k) => !checks[k]);

  return Response.json({
    ok: missingCritical.length === 0,
    remindersReady: missingReminders.length === 0,
    missingCritical,
    missingReminders,
    checks,
  });
}
