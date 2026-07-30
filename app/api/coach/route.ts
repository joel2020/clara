import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/allowlist";
import type { TechnicalFailureCategory } from "@/lib/analytics-schema";

// The teacher's roster. Admin-only: returns a summary row per real student so
// Joel can see who's practicing, who's slipping, and who to nudge — in one
// place. Reads the cloud tables with the service-role key when present (so it
// keeps working once strict per-user RLS is applied); until then it falls back
// to the anon key under the current permissive policy.
//
// Every number here is defined once, in docs/learning-metrics.md, and computed
// here — server-side, from bounded columns and the closed analytics schema.
// Two invariants hold throughout:
//
//   1. A technical failure is never a learner mistake. `technical_failure`
//      events and `technical-skip` activities are reported as OUR problem and
//      are excluded from her rates and from weak-area ranking.
//   2. Nothing that could identify or quote a learner leaves this handler. The
//      SELECTs below name their columns precisely — `attempts.target` and
//      `attempts.heard` are never read — and no raw `props` bag is forwarded.

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Real accounts are auth-bound (profile_id = the auth user's UUID). Old
// sync-code profiles are text slugs — filter those legacy rows out.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 86_400_000;
/** Trailing local days every rate is computed over. */
const WINDOW_DAYS = 14;
/** Days without practice before a learner is flagged quiet. */
const QUIET_DAYS = 3;
/** Per-activity cap on counted practice time: beyond this it is a backgrounded tab. */
const ACTIVITY_CAP_MS = 10 * 60_000;
const MAX_WEAK_AREAS = 3;
const REVIEW_BACKLOG_ITEMS = 12;
const MASTERED_BOX = 5;

/** The event types the rollups read. Everything else stays untouched. */
const METRIC_TYPES = [
  "session_start",
  "session_complete",
  "session_abandon",
  "activity_complete",
  "speaking_attempted",
  "review_complete",
  "technical_failure",
];

/** Failure categories that mean "her work did not reach us". */
const SYNC_CATEGORIES = new Set<TechnicalFailureCategory>(["sync", "network", "storage"]);

const LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];
const PATHS = ["job", "general"];

type Props = Record<string, unknown>;

interface ProfileRow { id: string; name: string | null }
interface StatsRow {
  profile_id: string;
  xp: number | null;
  stars: number | null;
  current_streak: number | null;
  longest_streak: number | null;
  total_attempts: number | null;
  total_passes: number | null;
  last_active_day: string | null;
}
interface SettingsRow { profile_id: string; onboarding: Props | null }
interface ProgressRow {
  profile_id: string;
  category_id: string | null;
  phoneme: string | null;
  attempts: number | null;
  box: number | null;
  due_at: number | null;
}
interface AttemptRow {
  profile_id: string;
  category_id: string | null;
  phoneme: string | null;
  passed: boolean | null;
  at: number;
}
interface EventRow { profile_id: string; type: string; at: number; day: string | null; props: Props | null }

/** What happened on one learner's local day. */
interface DayFact {
  started: boolean;
  completed: boolean;
  /** Meaningful learning: a completed activity or a valid speaking attempt. */
  active: boolean;
  spoke: boolean;
  /** The speak activity ended in a technical skip. */
  speakSkipped: boolean;
  failed: boolean;
}

interface Facts {
  days: Map<string, DayFact>;
  speakingAttempts: number;
  reviewDue: number;
  reviewCompleted: number;
  practiceMs: number;
  interactions: number;
  technical: Map<string, number>;
  newestDay: string | null;
}

interface WeakArea {
  area: string;
  misses: number;
  attempts: number;
  dueItems: number;
  missRate: number;
}

const dayMs = (day: string): number => Date.parse(`${day}T00:00:00Z`);
const dayAdd = (day: string, n: number): string =>
  new Date(dayMs(day) + n * DAY_MS).toISOString().slice(0, 10);
const dayDiff = (a: string, b: string): number => Math.round((dayMs(a) - dayMs(b)) / DAY_MS);

/** A rate with an empty denominator is null, never a fake 0. */
const rate = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : null;

function numProp(props: Props, key: string): number | null {
  const value = props[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function strProp(props: Props, key: string): string | null {
  const value = props[key];
  return typeof value === "string" ? value : null;
}

function emptyDay(): DayFact {
  return { started: false, completed: false, active: false, spoke: false, speakSkipped: false, failed: false };
}
function emptyFacts(): Facts {
  return {
    days: new Map(),
    speakingAttempts: 0,
    reviewDue: 0,
    reviewCompleted: 0,
    practiceMs: 0,
    interactions: 0,
    technical: new Map(),
    newestDay: null,
  };
}

/**
 * Fold the window's events into per-learner, per-local-day facts.
 *
 * The learner's OWN local day (the `day` column her device wrote) is the
 * boundary for every rollup — a server timezone would move her midnight.
 */
function foldEvents(rows: EventRow[]): Map<string, Facts> {
  const byLearner = new Map<string, Facts>();
  for (const row of rows) {
    const day = row.day ?? "";
    if (!DAY.test(day)) continue; // a malformed day cannot be placed on a calendar
    let facts = byLearner.get(row.profile_id);
    if (!facts) byLearner.set(row.profile_id, (facts = emptyFacts()));
    let fact = facts.days.get(day);
    if (!fact) facts.days.set(day, (fact = emptyDay()));
    if (!facts.newestDay || day > facts.newestDay) facts.newestDay = day;
    const props = row.props ?? {};

    switch (row.type) {
      case "session_start":
        fact.started = true;
        break;
      case "session_complete":
        fact.completed = true;
        break;
      case "activity_complete": {
        const status = strProp(props, "activityStatus");
        if (status === "completed") {
          fact.active = true;
          facts.interactions += 1;
          facts.practiceMs += Math.min(numProp(props, "durationMs") ?? 0, ACTIVITY_CAP_MS);
        } else if (status === "technical-skip" && strProp(props, "activityKind") === "speak") {
          fact.speakSkipped = true;
        }
        break;
      }
      case "speaking_attempted":
        fact.spoke = true;
        fact.active = true;
        facts.speakingAttempts += 1;
        facts.interactions += 1;
        break;
      case "review_complete":
        facts.reviewDue += numProp(props, "dueCount") ?? 0;
        facts.reviewCompleted += numProp(props, "completedCount") ?? 0;
        break;
      case "technical_failure": {
        fact.failed = true;
        const category = strProp(props, "category") ?? "unknown";
        facts.technical.set(category, (facts.technical.get(category) ?? 0) + 1);
        facts.interactions += 1;
        break;
      }
      default:
        break;
    }
  }
  return byLearner;
}

/**
 * Rank the areas she is struggling with.
 *
 * Only VALID attempts (rows in `attempts` — a capture failure is never written
 * there) and DUE, not-yet-mastered progress feed this. `technical_failure`
 * events are deliberately not read: a dead microphone must never invent a weak
 * sound.
 */
function rankWeakAreas(attempts: AttemptRow[], progress: ProgressRow[], now: number): WeakArea[] {
  const areas = new Map<string, { misses: number; attempts: number; dueItems: number }>();
  const bucket = (key: string) => {
    let entry = areas.get(key);
    if (!entry) areas.set(key, (entry = { misses: 0, attempts: 0, dueItems: 0 }));
    return entry;
  };
  const label = (row: { phoneme: string | null; category_id: string | null }) =>
    row.phoneme || row.category_id || "";

  for (const attempt of attempts) {
    const key = label(attempt);
    if (!key) continue;
    const entry = bucket(key);
    entry.attempts += 1;
    if (attempt.passed === false) entry.misses += 1;
  }
  for (const row of progress) {
    const key = label(row);
    if (!key) continue;
    const practiced = (row.attempts ?? 0) > 0;
    const due = (row.due_at ?? Number.MAX_SAFE_INTEGER) <= now;
    if (practiced && due && (row.box ?? 0) < MASTERED_BOX) bucket(key).dueItems += 1;
  }

  return [...areas.entries()]
    .map(([area, entry]) => ({
      area,
      misses: entry.misses,
      attempts: entry.attempts,
      dueItems: entry.dueItems,
      missRate: entry.attempts > 0 ? entry.misses / entry.attempts : 0,
    }))
    .filter((entry) => entry.misses > 0 || entry.dueItems > 0)
    .sort(
      (a, b) =>
        score(b) - score(a) || b.misses - a.misses || a.area.localeCompare(b.area),
    )
    .slice(0, MAX_WEAK_AREAS)
    .map((entry) => ({ ...entry, missRate: Math.round(entry.missRate * 100) }));
}

/** Higher is weaker: how often she misses, nudged by how much is due. */
function score(entry: { missRate: number; dueItems: number }): number {
  return entry.missRate + 0.05 * Math.min(entry.dueItems, 5);
}

export async function GET(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!isAdmin(user?.email)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const key = serviceKey || anonKey;
  if (!url || !key) return Response.json({ error: "not_configured" }, { status: 503 });

  const sb = createClient(url, key, { auth: { persistSession: false } });
  // Client errors from the last 7 days, newest first. Included here because the
  // coach screen is the only place anyone actually looks — an error log nobody opens
  // is the same as no error log.
  const now = Date.now();
  const weekAgo = now - 7 * DAY_MS;
  const windowStart = now - WINDOW_DAYS * DAY_MS;
  const [profilesRes, statsRes, settingsRes, progressRes, attemptsRes, eventsRes, errorsRes] =
    await Promise.all([
      sb.from("profiles").select("id,name"),
      sb
        .from("player_stats")
        .select("profile_id,xp,stars,current_streak,longest_streak,total_attempts,total_passes,last_active_day"),
      sb.from("settings").select("profile_id,onboarding"),
      // Named columns only: `progress` and `attempts` also hold the words she
      // was aiming for and what the recognizer heard. Those never load here.
      sb.from("progress").select("profile_id,category_id,phoneme,attempts,box,due_at").limit(20_000),
      sb
        .from("attempts")
        .select("profile_id,category_id,phoneme,passed,at")
        .gte("at", windowStart)
        .limit(20_000),
      sb
        .from("events")
        .select("profile_id,type,at,day,props")
        .in("type", METRIC_TYPES)
        .gte("at", windowStart)
        .limit(20_000),
      sb
        .from("events")
        .select("at,props")
        .eq("type", "client_error")
        .gte("at", weekAgo)
        .order("at", { ascending: false })
        .limit(25),
    ]);

  const stats = new Map(((statsRes.data as StatsRow[] | null) ?? []).map((s) => [s.profile_id, s]));
  const settings = new Map(((settingsRes.data as SettingsRow[] | null) ?? []).map((s) => [s.profile_id, s]));
  const factsByLearner = foldEvents((eventsRes.data as EventRow[] | null) ?? []);

  const progressByLearner = new Map<string, ProgressRow[]>();
  for (const row of (progressRes.data as ProgressRow[] | null) ?? []) {
    const list = progressByLearner.get(row.profile_id);
    if (list) list.push(row);
    else progressByLearner.set(row.profile_id, [row]);
  }
  const attemptsByLearner = new Map<string, AttemptRow[]>();
  for (const row of (attemptsRes.data as AttemptRow[] | null) ?? []) {
    const list = attemptsByLearner.get(row.profile_id);
    if (list) list.push(row);
    else attemptsByLearner.set(row.profile_id, [row]);
  }

  const today = new Date(now).toISOString().slice(0, 10);
  // Cohort totals, accumulated as each learner is summarized so the definitions
  // in docs/learning-metrics.md have exactly one implementation.
  const cohort = {
    activeToday: 0,
    startedDays: 0,
    completedDays: 0,
    activeDays: 0,
    nextDayEligible: 0,
    nextDayReturned: 0,
    sevenDayEligible: 0,
    sevenDayReturned: 0,
    practiceMs: 0,
    speakingEligible: 0,
    speakingDays: 0,
    reviewDue: 0,
    reviewCompleted: 0,
    failures: 0,
    interactions: 0,
  };

  const students = ((profilesRes.data as ProfileRow[] | null) ?? [])
    .filter((p) => UUID.test(p.id))
    .map((p) => {
      const s = stats.get(p.id);
      const facts = factsByLearner.get(p.id) ?? emptyFacts();
      const onboarding = settings.get(p.id)?.onboarding ?? {};
      const progress = progressByLearner.get(p.id) ?? [];

      // ── session, activity, and return days ──────────────────────────────
      const activeDays = [...facts.days.entries()].filter(([, f]) => f.active).map(([day]) => day).sort();
      const activeSet = new Set(activeDays);
      let startedDays = 0;
      let completedDays = 0;
      let speakingEligible = 0;
      let speakingDays = 0;
      for (const [, fact] of facts.days) {
        if (fact.started) {
          // A day the app broke on is not an abandoned session: it leaves the
          // completion denominator instead of counting against her.
          if (fact.completed) {
            startedDays += 1;
            completedDays += 1;
          } else if (!fact.failed) {
            startedDays += 1;
          }
          // Same rule for speaking: a technical skip with no valid attempt is
          // our failure, not her silence.
          if (!(fact.speakSkipped && !fact.spoke)) {
            speakingEligible += 1;
            if (fact.spoke) speakingDays += 1;
          }
        }
      }
      let nextDayEligible = 0;
      let nextDayReturned = 0;
      let sevenDayEligible = 0;
      let sevenDayReturned = 0;
      for (const day of activeDays) {
        if (dayDiff(today, day) >= 1) {
          nextDayEligible += 1;
          if (activeSet.has(dayAdd(day, 1))) nextDayReturned += 1;
        }
        if (dayDiff(today, day) >= 7) {
          sevenDayEligible += 1;
          for (let ahead = 1; ahead <= 7; ahead++) {
            if (activeSet.has(dayAdd(day, ahead))) {
              sevenDayReturned += 1;
              break;
            }
          }
        }
      }

      // ── review need, technical trouble, sync lag ────────────────────────
      const dueItems = progress.filter(
        (row) =>
          (row.attempts ?? 0) > 0 &&
          (row.due_at ?? Number.MAX_SAFE_INTEGER) <= now &&
          (row.box ?? 0) < MASTERED_BOX,
      ).length;
      const categories = [...facts.technical.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
      const syncFailures = categories
        .filter((entry) => SYNC_CATEGORIES.has(entry.category as TechnicalFailureCategory))
        .reduce((total, entry) => total + entry.count, 0);
      const otherFailures = categories.reduce((total, entry) => total + entry.count, 0) - syncFailures;
      const lastActiveDay = s?.last_active_day ?? null;
      // The outbox retries entirely on-device (lib/sync/outbox.ts), so the only
      // server-visible shadow of a stuck queue is practice we were told about
      // (her day counter) whose events never arrived.
      const syncLagDays =
        lastActiveDay && DAY.test(lastActiveDay) && facts.newestDay
          ? Math.max(0, dayDiff(lastActiveDay, facts.newestDay))
          : null;

      const daysSince = lastActiveDay && DAY.test(lastActiveDay) ? Math.max(0, dayDiff(today, lastActiveDay)) : null;
      const completionRate = rate(completedDays, startedDays);
      const warnings: string[] = [];
      if (lastActiveDay === null) warnings.push("never-practiced");
      else if ((daysSince ?? 0) >= QUIET_DAYS) warnings.push("quiet");
      if (startedDays >= 2 && completionRate !== null && completionRate < 50) warnings.push("session-drop");
      if (speakingEligible >= 1 && facts.speakingAttempts === 0) warnings.push("no-speaking");
      if (dueItems >= REVIEW_BACKLOG_ITEMS) warnings.push("review-backlog");
      if ((syncLagDays ?? 0) >= 2 || syncFailures > 0) warnings.push("sync-lag");
      if (otherFailures >= 3) warnings.push("technical-trouble");

      // One definition of "active today" for the row badge and the cohort count:
      // her own day counter, or a meaningful event today.
      const activeToday = lastActiveDay === today || activeSet.has(today);
      cohort.activeToday += activeToday ? 1 : 0;
      cohort.startedDays += startedDays;
      cohort.completedDays += completedDays;
      cohort.activeDays += activeDays.length;
      cohort.nextDayEligible += nextDayEligible;
      cohort.nextDayReturned += nextDayReturned;
      cohort.sevenDayEligible += sevenDayEligible;
      cohort.sevenDayReturned += sevenDayReturned;
      cohort.practiceMs += facts.practiceMs;
      cohort.speakingEligible += speakingEligible;
      cohort.speakingDays += speakingDays;
      cohort.reviewDue += facts.reviewDue;
      cohort.reviewCompleted += facts.reviewCompleted;
      cohort.failures += categories.reduce((total, entry) => total + entry.count, 0);
      cohort.interactions += facts.interactions;

      const level = strProp(onboarding, "level");
      const path = strProp(onboarding, "path");
      return {
        id: p.id,
        name: p.name ?? "—",
        xp: s?.xp ?? 0,
        stars: s?.stars ?? 0,
        streak: s?.current_streak ?? 0,
        longestStreak: s?.longest_streak ?? 0,
        attempts: s?.total_attempts ?? 0,
        passRate: s && s.total_attempts ? Math.round(((s.total_passes ?? 0) / s.total_attempts) * 100) : 0,
        lastActiveDay,
        activeToday,
        daysSince,
        level: level && LEVELS.includes(level) ? level : null,
        path: path && PATHS.includes(path) ? path : "general",
        sessions: {
          startedDays,
          completedDays,
          completionRate,
          practiceMinutes: Math.round(facts.practiceMs / 60_000),
        },
        speaking: {
          attempts: facts.speakingAttempts,
          days: speakingDays,
          participationRate: rate(speakingDays, speakingEligible),
        },
        weakAreas: rankWeakAreas(attemptsByLearner.get(p.id) ?? [], progress, now),
        review: {
          dueItems,
          due: facts.reviewDue,
          completed: facts.reviewCompleted,
          completionRate: rate(facts.reviewCompleted, facts.reviewDue),
        },
        technical: { failures: syncFailures + otherFailures, categories },
        sync: { lagDays: syncLagDays, failures: syncFailures },
        warnings,
      };
    })
    .sort((a, b) => (b.lastActiveDay ?? "").localeCompare(a.lastActiveDay ?? ""));

  const errors = ((errorsRes.data as { at: number; props: Props | null }[] | null) ?? []).map((e) => {
    const props = (e.props ?? {}) as Record<string, string>;
    return {
      at: Number(e.at),
      source: props.source ?? "",
      message: props.message ?? "",
      path: props.path ?? "",
      frame: props.frame ?? "",
    };
  });

  const metrics = {
    windowDays: WINDOW_DAYS,
    learners: students.length,
    dailyActiveLearners: cohort.activeToday,
    sessionCompletionRate: rate(cohort.completedDays, cohort.startedDays),
    nextDayReturnRate: rate(cohort.nextDayReturned, cohort.nextDayEligible),
    sevenDayReturnRate: rate(cohort.sevenDayReturned, cohort.sevenDayEligible),
    meaningfulPracticeMinutes:
      cohort.activeDays > 0 ? Math.round(cohort.practiceMs / cohort.activeDays / 60_000) : null,
    speakingParticipationRate: rate(cohort.speakingDays, cohort.speakingEligible),
    reviewCompletionRate: rate(cohort.reviewCompleted, cohort.reviewDue),
    technicalFailureRate: rate(cohort.failures, cohort.interactions),
  };

  return Response.json({ students, metrics, errors, cloudAnalytics: Boolean(serviceKey) });
}
