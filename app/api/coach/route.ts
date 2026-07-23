import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/allowlist";

// The teacher's roster. Admin-only: returns a summary row per real student so
// Joel can see who's practicing, who's slipping, and who to nudge — in one
// place. Reads the cloud tables with the service-role key when present (so it
// keeps working once strict per-user RLS is applied); until then it falls back
// to the anon key under the current permissive policy.

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Real accounts are auth-bound (profile_id = the auth user's UUID). Old
// sync-code profiles are text slugs — filter those legacy rows out.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!isAdmin(user?.email)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const key = serviceKey || anonKey;
  if (!url || !key) return Response.json({ error: "not_configured" }, { status: 503 });

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const [profilesRes, statsRes] = await Promise.all([
    sb.from("profiles").select("id,name,coach_language"),
    sb
      .from("player_stats")
      .select("profile_id,xp,stars,current_streak,longest_streak,total_attempts,total_passes,last_active_day,updated_at"),
  ]);

  const stats = new Map((statsRes.data ?? []).map((s) => [s.profile_id, s]));
  const today = new Date().toISOString().slice(0, 10);

  const students = (profilesRes.data ?? [])
    .filter((p) => UUID.test(p.id))
    .map((p) => {
      const s = stats.get(p.id);
      return {
        id: p.id,
        name: p.name ?? "—",
        xp: s?.xp ?? 0,
        stars: s?.stars ?? 0,
        streak: s?.current_streak ?? 0,
        longestStreak: s?.longest_streak ?? 0,
        attempts: s?.total_attempts ?? 0,
        passRate: s && s.total_attempts ? Math.round((s.total_passes / s.total_attempts) * 100) : 0,
        lastActiveDay: s?.last_active_day ?? null,
        activeToday: s?.last_active_day === today,
      };
    })
    .sort((a, b) => (b.lastActiveDay ?? "").localeCompare(a.lastActiveDay ?? ""));

  return Response.json({ students, cloudAnalytics: Boolean(serviceKey) });
}
