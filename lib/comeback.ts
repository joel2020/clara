// Coming back after a missed day, and being invited back at all.
//
// Two decisions live here, both pure so the copy itself can be held to a test:
//   1. What a comeback session is — the ordinary composer, a shorter budget,
//      review first, no new material.
//   2. What a reminder is allowed to say — one concrete thing the learner can
//      do, or nothing.
// Neither one may use shame, threats, or loss-aversion, and neither touches
// streaks, progress, or rewards: a gap is a gap, not a penalty.

import {
  composeDailySession,
  type DailyActivity,
  type DailySession,
  type DailySessionInput,
} from "./daily-session.ts";

/** Short enough to say yes to after a gap, long enough to be worth opening —
 *  against the ordinary session's 15. */
const RECOVERY_BUDGET_MINUTES = 8;

export interface ComebackSessionInput extends DailySessionInput {
  /** Local day key (YYYY-MM-DD) of the last practice, or null if never. */
  lastActiveDay: string | null;
}

/**
 * Whole local days skipped before `day`. Practicing yesterday or today is 0,
 * and so is a first-ever session: a new learner is not a returning one.
 */
export function missedLocalDays(lastActiveDay: string | null, day: string): number {
  if (!lastActiveDay) return 0;
  const [ly, lm, ld] = lastActiveDay.split("-").map(Number);
  const [dy, dm, dd] = day.split("-").map(Number);
  const gap = Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(ly, lm - 1, ld)) / 86_400_000);
  return gap > 1 ? gap - 1 : 0;
}

const RECOVERY_OBJECTIVE = {
  es: "Qué bueno verte. Empezamos con un repaso corto.",
  en: "Good to see you. We start with one short review.",
};
const RECOVERY_OUTCOME = {
  es: "Saldrás con una frase repasada y lista para usar.",
  en: "You will leave with one phrase reviewed and ready to use.",
};

/**
 * The same plan the learner would get anyway, trimmed for a return. Reuses the
 * composer so ranking, evidence, and assistance stay in one place; only the
 * budget and the framing change.
 */
export function composeComebackSession(input: ComebackSessionInput): DailySession {
  const session = composeDailySession(input);
  if (missedLocalDays(input.lastActiveDay, input.day) < 1) return session;
  // Review leads and new material waits: catching up is easier when the session
  // asks for something already met. The composer already put the most important
  // review first, so keeping its order keeps that single priority.
  const activities = session.activities
    .filter((entry) => entry.kind !== "learn")
    .reduce<DailyActivity[]>((kept, entry) => {
      const used = kept.reduce((total, item) => total + item.estimatedMinutes, 0);
      return used + entry.estimatedMinutes <= RECOVERY_BUDGET_MINUTES ? [...kept, entry] : kept;
    }, []);
  return {
    ...session,
    objective: RECOVERY_OBJECTIVE,
    outcome: RECOVERY_OUTCOME,
    activities,
    currentActivityId: activities[0]?.id ?? null,
  };
}

export interface ReminderContext {
  lang: "es" | "en";
  /** First name, when known, purely to make the message sound addressed. */
  name: string | null;
  /** Practiced already today — there is nothing to remind about. */
  practicedToday: boolean;
  /** Today's session was started and its speaking activity is still open. */
  unfinishedSpeaking: boolean;
  /** Items whose review date has arrived. */
  dueReviews: number;
  /** The next activity already waiting in today's plan. */
  readyActivity: { es: string; en: string } | null;
}

export interface ReminderMessage {
  title: string;
  body: string;
}

/**
 * Pick the most specific true thing to say, or say nothing. Ranked by how
 * concrete the invitation is: unfinished speaking, then review that is actually
 * due, then the activity already waiting. Never mentions streaks — a reminder
 * that trades on losing something is pressure, not help.
 */
export function selectNotification(context: ReminderContext): ReminderMessage | null {
  if (context.practicedToday) return null;
  const es = context.lang === "es";
  const message = pick(context, es);
  const who = context.name?.trim().split(" ")[0];
  if (!who) return message;
  return { ...message, body: `${who}, ${message.body.charAt(0).toLowerCase()}${message.body.slice(1)}` };
}

function pick(context: ReminderContext, es: boolean): ReminderMessage {
  if (context.unfinishedSpeaking) {
    return es
      ? { title: "Te quedó una respuesta hablada", body: "Dos minutos y cierras la sesión de hoy." }
      : { title: "One speaking answer is still open", body: "Two minutes finishes today's session." };
  }
  if (context.dueReviews > 0) {
    const n = context.dueReviews;
    return es
      ? { title: n === 1 ? "Tienes 1 repaso listo" : `Tienes ${n} repasos listos`, body: "Cinco minutos alcanzan para verlos." }
      : { title: n === 1 ? "1 review is ready" : `${n} reviews are ready`, body: "Five minutes is enough to see them." };
  }
  if (context.readyActivity) {
    return es
      ? { title: "Tu sesión de hoy está lista", body: `Empieza por: ${context.readyActivity.es}.` }
      : { title: "Today's session is ready", body: `Start with: ${context.readyActivity.en}.` };
  }
  // Nothing specific is known — still concrete about the size of the ask, and
  // entirely an invitation.
  return es
    ? { title: "Cinco minutos de práctica", body: "Empieza una sesión corta cuando te quede bien." }
    : { title: "Five minutes of practice", body: "Start a short session whenever it suits you." };
}
