// The closed analytics schema.
//
// Analytics exist to tell us whether learning is happening — not to record what
// a learner said. Every event type, every property name, and every technical
// failure category is on an allowlist in this file, and lib/analytics.ts runs
// `validateEvent` before the IndexedDB write and before the Supabase mirror, so
// anything outside the allowlist reaches neither store.
//
// Three rules do the real work:
//
//   1. Property names that could carry learner content — transcript, heard,
//      audio, voice, email, name and friends — are rejected outright, on every
//      event type, before anything else is checked.
//   2. Values are counts, durations, bounded enums, short ids, and flags. There
//      is no representable "text" kind, so there is nowhere to put a sentence.
//      The one exception is `client_error`, whose truncated developer
//      diagnostics predate this schema and are documented below.
//   3. An invalid REQUIRED property rejects the whole event before any write.
//      An invalid OPTIONAL property is dropped and the event still records:
//      losing a nice-to-have field must never cost us the signal itself.
//
// Pure module — no imports, no browser APIs, runnable under plain node.

/** Values an event property may hold once validated. */
export type AnalyticsProps = Record<string, string | number | boolean>;

/**
 * Categorized technical failures. A failure the learner did not cause must be
 * excluded from her scores, so the category has to be a fixed enum we can
 * branch on — never a free-text reason string.
 */
export const TECHNICAL_FAILURE_CATEGORIES = [
  "speech-recognition",
  "microphone-permission",
  "audio-playback",
  "network",
  "sync",
  "api",
  "storage",
] as const;

export type TechnicalFailureCategory =
  (typeof TECHNICAL_FAILURE_CATEGORIES)[number];

/** Mirrors DailyActivityKind / ActivityStatus in lib/daily-session.ts. */
const ACTIVITY_KINDS = [
  "retrieve",
  "learn",
  "listen",
  "speak",
  "situation",
  "reflect",
] as const;
const ACTIVITY_STATUSES = [
  "pending",
  "active",
  "completed",
  "technical-skip",
] as const;

/** App surfaces a `mode_open` may name. */
const MODES = ["call", "talk", "radio", "practice", "exam", "review"] as const;

/**
 * Property names that could smuggle learner speech or identity into analytics.
 * Matched as case-insensitive substrings, so `studentName` and `rawTranscript`
 * are rejected as surely as `name` and `transcript`.
 */
export const DENIED_PROP_NAMES = [
  "transcript",
  "heard",
  "audio",
  "voice",
  "email",
  "name",
  "text",
  "speech",
  "spoken",
  "said",
  "utterance",
  "sentence",
  "phrase",
  "answer",
  "reply",
  "comment",
  "note",
  "content",
  "recording",
  "raw",
] as const;

/**
 * How a property value is bounded.
 *
 * `diagnostic` is the single legacy exception: `client_error` carries a
 * truncated exception message, one stack frame, and a pathname so production
 * faults are visible in the coach cockpit. Those are developer strings about
 * our code, never learner content, and they are hard-capped here. No other
 * event type may use it.
 */
type PropRule =
  | { kind: "enum"; values: readonly string[] }
  | { kind: "count" }
  | { kind: "duration" }
  | { kind: "id" }
  | { kind: "flag" }
  | { kind: "diagnostic"; max: number };

interface EventSchema {
  required: Record<string, PropRule>;
  optional: Record<string, PropRule>;
}

const count: PropRule = { kind: "count" };
const duration: PropRule = { kind: "duration" };
const id: PropRule = { kind: "id" };
const flag: PropRule = { kind: "flag" };
const enumOf = (values: readonly string[]): PropRule => ({ kind: "enum", values });

/** Ids are opaque handles: no spaces, no punctuation, no room for a sentence. */
const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;

export type AnalyticsEventType =
  | "app_open"
  | "mode_open"
  | "lesson_start"
  | "lesson_complete"
  | "lesson_abandon"
  | "client_error"
  | "session_start"
  | "session_resume"
  | "session_complete"
  | "session_abandon"
  | "activity_complete"
  | "speaking_attempted"
  | "review_complete"
  | "return_next_day"
  | "return_seven_day"
  | "technical_failure";

/**
 * The closed event catalogue. The first group predates the daily loop and still
 * has live producers and consumers (lib/insights.ts reads app_open,
 * lesson_start, lesson_complete and mode_open; app/api/coach/route.ts reads
 * client_error) — those stay instrumented exactly as they were. Typing this as
 * a total record means a new event type cannot be added to the union without a
 * schema to bound it.
 */
export const EVENT_SCHEMAS: Record<AnalyticsEventType, EventSchema> = {
  app_open: { required: {}, optional: {} },
  mode_open: { required: { mode: enumOf(MODES) }, optional: {} },
  lesson_start: { required: { lesson: id }, optional: {} },
  lesson_complete: { required: { lesson: id }, optional: {} },
  lesson_abandon: { required: { lesson: id }, optional: {} },
  client_error: {
    required: { source: id },
    optional: {
      message: { kind: "diagnostic", max: 200 },
      frame: { kind: "diagnostic", max: 120 },
      path: { kind: "diagnostic", max: 120 },
    },
  },

  // Daily learning loop.
  session_start: {
    required: { completedActivities: count, totalActivities: count },
    optional: {},
  },
  session_resume: {
    required: { completedActivities: count, totalActivities: count },
    optional: {},
  },
  session_complete: {
    required: { completedActivities: count, totalActivities: count },
    optional: { rewardClaimed: flag, durationMs: duration },
  },
  session_abandon: {
    required: { completedActivities: count, totalActivities: count },
    optional: { lastActivityKind: enumOf(ACTIVITY_KINDS) },
  },
  activity_complete: {
    required: {
      activityKind: enumOf(ACTIVITY_KINDS),
      activityStatus: enumOf(ACTIVITY_STATUSES),
    },
    optional: {
      completedActivities: count,
      totalActivities: count,
      durationMs: duration,
    },
  },
  speaking_attempted: {
    required: { passed: flag, score: count },
    optional: {
      itemId: id,
      lessonId: id,
      categoryId: id,
      attempts: count,
      durationMs: duration,
    },
  },
  review_complete: {
    required: { dueCount: count, completedCount: count },
    optional: { correctCount: count, durationMs: duration },
  },
  // Return markers: recorded on the day the learner comes back, carrying the
  // size of the gap she closed.
  return_next_day: { required: { gapDays: count }, optional: { streak: count } },
  return_seven_day: { required: { gapDays: count }, optional: { streak: count } },
  technical_failure: {
    required: { category: enumOf(TECHNICAL_FAILURE_CATEGORIES) },
    optional: {
      activityKind: enumOf(ACTIVITY_KINDS),
      retried: flag,
      durationMs: duration,
    },
  },
};

export const ANALYTICS_EVENT_TYPES = Object.keys(
  EVENT_SCHEMAS,
) as AnalyticsEventType[];

/** True when a property name could carry learner speech or identity. */
export function isDeniedPropName(key: string): boolean {
  const lower = key.toLowerCase();
  return DENIED_PROP_NAMES.some((denied) => lower.includes(denied));
}

/** Returns the bounded value, or undefined when the input does not fit the rule. */
function bound(rule: PropRule, value: unknown): string | number | boolean | undefined {
  switch (rule.kind) {
    case "enum":
      return typeof value === "string" && rule.values.includes(value) ? value : undefined;
    case "count":
      return typeof value === "number" && Number.isInteger(value) && value >= 0
        ? value
        : undefined;
    case "duration":
      return typeof value === "number" && Number.isFinite(value) && value >= 0
        ? value
        : undefined;
    case "id":
      return typeof value === "string" && ID_PATTERN.test(value) ? value : undefined;
    case "flag":
      return typeof value === "boolean" ? value : undefined;
    case "diagnostic":
      return typeof value === "string" ? value.slice(0, rule.max) : undefined;
  }
}

/**
 * Validate and sanitize an event before it is written anywhere.
 *
 * Throws on an unknown event type, a denied property name, or a missing or
 * invalid required property. Unknown and invalid optional properties are
 * dropped from the returned props.
 */
export function validateEvent(event: {
  type: string;
  props?: Record<string, unknown>;
}): { type: AnalyticsEventType; props: AnalyticsProps } {
  // Own-property lookup only: "toString" is not an event type.
  if (!Object.hasOwn(EVENT_SCHEMAS, event.type)) {
    throw new Error(`analytics: unknown event type "${event.type}"`);
  }
  const schema = EVENT_SCHEMAS[event.type as AnalyticsEventType];

  const input = event.props ?? {};

  // Privacy first: a denied name is refused before we look at any value, so a
  // transcript cannot ride along on an otherwise valid event.
  for (const key of Object.keys(input)) {
    if (isDeniedPropName(key)) {
      throw new Error(
        `analytics: property "${key}" may carry learner content and is not allowed`,
      );
    }
  }

  const props: AnalyticsProps = {};
  for (const [key, rule] of Object.entries(schema.required)) {
    const value = bound(rule, input[key]);
    if (value === undefined) {
      throw new Error(
        `analytics: event "${event.type}" requires a valid "${key}"`,
      );
    }
    props[key] = value;
  }
  for (const [key, rule] of Object.entries(schema.optional)) {
    if (!(key in input)) continue;
    const value = bound(rule, input[key]);
    if (value !== undefined) props[key] = value;
  }
  return { type: event.type as AnalyticsEventType, props };
}
