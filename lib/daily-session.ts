import type { AttemptEvidence, ItemProgress, Lesson } from "./db/types.ts";
import type { LearningPath } from "./paths.ts";
import type { Level } from "./placement.ts";
import type { Scenario } from "./content/scenarios.ts";

export type AssistanceLevel = "spanish-full" | "spanish-selective" | "english-default";
export type DailyActivityKind = "retrieve" | "learn" | "listen" | "speak" | "situation" | "reflect";
export type ActivityStatus = "pending" | "active" | "completed" | "technical-skip";

export interface DailyActivity {
  id: string;
  kind: DailyActivityKind;
  title: { es: string; en: string };
  targetIds: string[];
  sourceId: string;
  reason: "review-due" | "weak-sound" | "weak-vocabulary" | "recent-mistake" | "level-next" | "path-goal" | "transfer";
  estimatedMinutes: number;
  status: ActivityStatus;
  completedAt?: number;
}

export interface DailySession {
  id: string;
  version: 1;
  profileId: string;
  day: string;
  objective: { es: string; en: string };
  outcome: { es: string; en: string };
  assistance: AssistanceLevel;
  activities: DailyActivity[];
  currentActivityId: string | null;
  rewardClaimed: boolean;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/** The composer input deliberately holds evidence outside persisted Attempt history. */
export interface DailySessionInput {
  profileId: string;
  day: string;
  now: number;
  level: Level;
  path: LearningPath;
  lessons: Lesson[];
  scenarios: Scenario[];
  progress: ItemProgress[];
  attempts?: Array<Omit<AttemptEvidence, "at"> & { at?: number }>;
  /** Lessons relevant to the learner's stated path, in descending relevance. */
  pathLessonIds?: string[];
  /** Recent practice already completed today; higher values de-prioritize repeats. */
  recentMinutes?: number;
}

type Candidate = ItemProgress & { pathRelevant: boolean };

const TITLES: Record<DailyActivityKind, { es: string; en: string }> = {
  retrieve: { es: "Recupera lo que toca hoy", en: "Retrieve what is due today" },
  learn: { es: "Aprende el siguiente paso", en: "Learn the next step" },
  listen: { es: "Escucha el contraste", en: "Hear the contrast" },
  speak: { es: "Di una respuesta clara", en: "Say a clear response" },
  situation: { es: "Úsalo en una situación", en: "Use it in a situation" },
  reflect: { es: "Cierra con una reflexión", en: "Finish with a reflection" },
};
const MINUTES: Record<DailyActivityKind, number> = { retrieve: 3, learn: 4, listen: 2, speak: 2, situation: 3, reflect: 1 };

function compareCandidates(now: number, fatigue: number) {
  return (a: Candidate, b: Candidate) => {
    const dueA = a.dueAt <= now, dueB = b.dueAt <= now;
    if (dueA !== dueB) return dueA ? -1 : 1; // due urgency
    if (dueA && a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
    if (a.pathRelevant !== b.pathRelevant) return a.pathRelevant ? -1 : 1; // path relevance
    const weakness = (candidate: Candidate) => (candidate.attempts - candidate.passes) / Math.max(candidate.attempts, 1) + (5 - candidate.box) / 10;
    if (weakness(a) !== weakness(b)) return weakness(b) - weakness(a); // weakness confidence
    if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt; // recency
    // A short recent session should not erase a stable curriculum tie-break,
    // while a long one should increasingly favour the less-repeated item.
    const fatiguePenalty = (candidate: Candidate) => Math.floor((fatigue * candidate.attempts) / 15);
    if (fatiguePenalty(a) !== fatiguePenalty(b)) return fatiguePenalty(a) - fatiguePenalty(b); // fatigue
    return a.itemId.localeCompare(b.itemId);
  };
}

function assistanceFor(level: Level): AssistanceLevel {
  if (level === "A0" || level === "A1") return "spanish-full";
  if (level === "A2" || level === "B1") return "spanish-selective";
  return "english-default";
}
function activity(kind: DailyActivityKind, sourceId: string, targetIds: string[], reason: DailyActivity["reason"]): DailyActivity {
  return { id: kind, kind, title: TITLES[kind], targetIds, sourceId, reason, estimatedMinutes: MINUTES[kind], status: "pending" };
}

/** Compose a stable, evidence-ranked daily loop without reading time or storage. */
export function composeDailySession(input: DailySessionInput): DailySession {
  const lessonsByItem = new Map<string, Lesson>();
  for (const lesson of input.lessons) for (const item of lesson.items) lessonsByItem.set(item.id, lesson);
  const relevant = new Set(input.pathLessonIds ?? []);
  const candidates = input.progress.filter((progress) => lessonsByItem.has(progress.itemId))
    .map((progress) => ({ ...progress, pathRelevant: relevant.has(progress.lessonId) }))
    .sort(compareCandidates(input.now, input.recentMinutes ?? 0));
  const primary = candidates[0];
  const due = candidates.find((candidate) => candidate.dueAt <= input.now);
  const validMiss = (input.attempts ?? []).filter((attempt) => attempt.evidence === "valid" && !attempt.passed)
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
  const nextLesson = [...input.lessons].sort((a, b) => Number(relevant.has(b.id)) - Number(relevant.has(a.id)) || a.order - b.order || a.id.localeCompare(b.id))[0];
  const fallbackId = nextLesson?.items[0]?.id ?? "";
  const target = (candidate?: Candidate) => candidate?.itemId || fallbackId;
  const source = (candidate?: Candidate) => candidate?.lessonId || nextLesson?.id || "curriculum";
  const scenario = input.scenarios[0];
  const sparse = input.progress.every((progress) => progress.attempts === 0);
  const activities = [
    activity("retrieve", source(due), [target(due)], due ? "review-due" : "level-next"),
    activity("learn", nextLesson?.id ?? "curriculum", [fallbackId], "level-next"),
    activity("listen", source(primary), [target(primary)], sparse ? "level-next" : "weak-sound"),
    activity("speak", validMiss ? "attempt-history" : source(primary), [validMiss?.itemId ?? target(primary)], sparse ? "level-next" : validMiss ? "recent-mistake" : "level-next"),
    activity("situation", scenario?.id ?? "situation", [scenario?.id ?? ""].filter(Boolean), input.path === "job" ? "path-goal" : "transfer"),
    activity("reflect", "session", [], "transfer"),
  ];
  const budgeted = activities.reduce<DailyActivity[]>((kept, entry) => {
    const used = kept.reduce((total, item) => total + item.estimatedMinutes, 0);
    return used + entry.estimatedMinutes <= 15 ? [...kept, entry] : kept;
  }, []);
  return {
    id: `daily:${input.profileId}:${input.day}`, version: 1, profileId: input.profileId, day: input.day,
    objective: { es: "Practica lo que más te ayudará hoy.", en: "Practice what will help you most today." },
    outcome: { es: "Terminarás con una frase útil y clara.", en: "You will finish with one useful, clear phrase." },
    assistance: assistanceFor(input.level), activities: budgeted, currentActivityId: budgeted[0]?.id ?? null,
    rewardClaimed: false, startedAt: null, completedAt: null, createdAt: input.now, updatedAt: input.now,
  };
}

export function sessionProgress(session: DailySession): { completed: number; total: number; percentage: number } {
  const completed = session.activities.filter((entry) => entry.status === "completed").length;
  const total = session.activities.length;
  return { completed, total, percentage: total ? Math.round((completed / total) * 100) : 0 };
}
export function nextActivity(session: DailySession): DailyActivity | null {
  return session.activities.find((entry) => entry.status === "pending" || entry.status === "active") ?? null;
}
