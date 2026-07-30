"use client";

import { db } from "@/lib/db/dexie";
import { dayKey } from "@/lib/gamification";
import { validateEvent } from "@/lib/analytics-schema";
import type { AnalyticsEventType } from "@/lib/analytics-schema";
import type { AnalyticsEvent } from "@/lib/db/types";
import type { DailyActivity, DailySession } from "@/lib/daily-session";

// Lightweight, privacy-respecting analytics. We were building blind — this logs
// the engagement signals that attempts don't already capture (opens, mode taps,
// lesson start/abandon, the daily loop) so we can see if the app is actually
// used and where a learner drops off. Local-first (IndexedDB); best-effort
// mirror to the cloud per user for a cross-device / instructor view.
//
// What may be recorded is not a convention here, it is enforced:
// lib/analytics-schema.ts holds the closed list of event types, the properties
// each one may carry, and the failure categories — and `track` validates
// against it before the local write and before the cloud mirror, so a
// transcript or an email address cannot reach either store.

type Props = Record<string, string | number | boolean>;

/** Record an event. Never throws — analytics must not affect the learning flow. */
export function track(type: AnalyticsEventType, props?: Props): void {
  if (typeof window === "undefined" || !db) return;
  let validated;
  try {
    validated = validateEvent({ type, props });
  } catch {
    // An event that violates the schema is dropped entirely rather than written
    // in a weaker form: a rejected required property means we do not actually
    // know what happened, and half a fact is worse than none.
    return;
  }
  const at = Date.now();
  const day = dayKey(new Date(at));
  const ev: AnalyticsEvent = { type, at, day, props: validated.props };
  void db.events.add(ev).catch(() => {});
  void mirror(ev).catch(() => {});
}

/** Only fire an event once per calendar day (e.g. app_open). */
export function trackOncePerDay(type: AnalyticsEventType, props?: Props): void {
  if (typeof window === "undefined") return;
  const key = `clara.ev.${type}`;
  const today = dayKey();
  try {
    if (localStorage.getItem(key) === today) return;
    localStorage.setItem(key, today);
  } catch {
    /* private mode — fall through and just log it */
  }
  track(type, props);
}

export type DailySessionAnalyticsAction =
  | "start"
  | "resume"
  | "checkpoint"
  | "complete";

/**
 * Track the daily-loop lifecycle with controlled enums and counts only.
 * Objective, outcome, learner speech, transcripts, and other free text never
 * enter the analytics payload.
 *
 * Each action records under its own event type (session_start, session_resume,
 * activity_complete, session_complete) so a completion rate can be computed
 * without inferring it from a generic mode tap.
 */
export function trackDailySession(
  action: DailySessionAnalyticsAction,
  session: DailySession,
  activity?: Pick<DailyActivity, "kind" | "status">,
): void {
  const counts = {
    completedActivities: session.activities.filter(
      (entry) =>
        entry.status === "completed" || entry.status === "technical-skip",
    ).length,
    totalActivities: session.activities.length,
  };
  if (action === "complete") {
    track("session_complete", { ...counts, rewardClaimed: session.rewardClaimed });
    return;
  }
  if (action === "checkpoint") {
    // A checkpoint we cannot attribute to an activity still proves the learner
    // is mid-session, so it records as a resume rather than being lost.
    if (activity) {
      track("activity_complete", {
        ...counts,
        activityKind: activity.kind,
        activityStatus: activity.status,
      });
    } else {
      track("session_resume", counts);
    }
    return;
  }
  track(action === "start" ? "session_start" : "session_resume", counts);
}

// Best-effort cloud mirror. No-ops silently if Supabase isn't configured, the
// user isn't signed in, or the `events` table doesn't exist yet (see
// supabase/events.sql). Uses the authenticated client so it's owned by the user
// under RLS.
async function mirror(ev: AnalyticsEvent): Promise<void> {
  const { supabase } = await import("@/lib/db/supabase");
  const { repo } = await import("@/lib/db");
  const sb = supabase();
  if (!sb) return;
  const settings = await repo.getSettings();
  if (!settings.profileId) return;
  await sb.from("events").insert({
    profile_id: settings.profileId,
    type: ev.type,
    at: ev.at,
    day: ev.day,
    props: ev.props ?? {},
  });
}

/**
 * Report an uncaught client error.
 *
 * Every bug found in this app so far was found by reading source, not by being
 * told — which means anything not read stayed broken. This routes failures into the
 * events table so they surface in the coach cockpit.
 *
 * Props carry ids and numbers only, so the message is truncated and the stack is
 * reduced to its first frame: enough to locate the fault, not enough to leak what a
 * student typed or said.
 */
export function reportError(source: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const firstFrame =
    err instanceof Error && err.stack
      ? (err.stack.split("\n")[1] ?? "").trim().slice(0, 120)
      : "";
  track("client_error", {
    source,
    message: message.slice(0, 200),
    frame: firstFrame,
    path: typeof window === "undefined" ? "" : window.location.pathname,
  });
}

let installed = false;

/**
 * Install global handlers once. Deliberately passive: it never swallows an error or
 * changes behaviour, it only records. An error reporter that alters the failure it
 * is reporting is worse than none.
 */
export function installErrorReporting(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => reportError("window.error", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => reportError("unhandledrejection", e.reason));
}
