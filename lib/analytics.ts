"use client";

import { db } from "@/lib/db/dexie";
import { dayKey } from "@/lib/gamification";
import type { AnalyticsEvent } from "@/lib/db/types";

// Lightweight, privacy-respecting analytics. We were building blind — this logs
// the engagement signals that attempts don't already capture (opens, mode taps,
// lesson start/abandon) so we can see if the app is actually used and where a
// learner drops off. Local-first (IndexedDB); best-effort mirror to the cloud
// per user for a cross-device / instructor view. Props carry ids and numbers
// only — never free text or PII.

type Props = Record<string, string | number | boolean>;

/** Record an event. Never throws — analytics must not affect the learning flow. */
export function track(type: AnalyticsEvent["type"], props?: Props): void {
  if (typeof window === "undefined" || !db) return;
  const at = Date.now();
  const day = dayKey(new Date(at));
  const ev: AnalyticsEvent = { type, at, day, props };
  void db.events.add(ev).catch(() => {});
  void mirror(ev).catch(() => {});
}

/** Only fire an event once per calendar day (e.g. app_open). */
export function trackOncePerDay(type: AnalyticsEvent["type"], props?: Props): void {
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
