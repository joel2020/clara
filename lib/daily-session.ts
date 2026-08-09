import type { Attempt, AttemptEvidence, ItemProgress, Lesson, PracticeItem } from "./db/types.ts";
import type { LearningPath } from "./paths.ts";
import type { Level } from "./placement.ts";
import type { Scenario } from "./content/scenarios.ts";
import { LESSONS as BUILT_IN_LESSONS } from "./content/lessons.ts";
import { derivePersonalWeaknesses } from "./speech/pronunciation-diagnosis.ts";
import {
  LATAM_PRONUNCIATION_PRIOR,
  PRONUNCIATION_TARGET_METADATA,
  type LatamPronunciationFeature,
} from "./speech/latam-prior.ts";
import {
  createDailyPronunciationGameState,
  type DailyPronunciationGameState,
} from "./speech/daily-pronunciation-game.ts";

export type AssistanceLevel = "spanish-full" | "spanish-selective" | "english-default";
export type DailyActivityKind = "retrieve" | "learn" | "listen" | "speak" | "situation" | "reflect";
export type ActivityStatus = "pending" | "active" | "completed" | "technical-skip";
export type PronunciationGameKind = "sound-sprint" | "beat-the-twin" | "echo-chain" | "call-rescue";
export type PronunciationSelectionSource = "recent-valid-miss" | "due-item" | "personal-weakness" | "latam-prior" | "curriculum-fallback";

export interface DailyPronunciationTarget extends PracticeItem {
  lessonId?: string;
  /** Display-only rhythm guide; recognition always receives `text`. */
  stressMarkedText?: string;
  /** Call Rescue grades this authored word inside the scripted phrase. */
  targetWord?: string;
}

export interface DailyPronunciationStage {
  kind: "echo-chunk" | "call-keyword" | "call-clarification" | "call-confirmation";
  text: string;
  stressMarkedText?: string;
  targetWord?: string;
}

export interface DailyPronunciationActivity {
  mode: "scored";
  game: PronunciationGameKind;
  selectionSource: PronunciationSelectionSource;
  feature?: LatamPronunciationFeature;
  targets: [DailyPronunciationTarget, DailyPronunciationTarget, DailyPronunciationTarget];
  /** Authored items relevant to this game, including real minimal-pair partners. */
  itemPool?: DailyPronunciationTarget[];
  /** One authored lesson item; stage text never replaces its identity. */
  sourceTarget?: DailyPronunciationTarget;
  stages?: [DailyPronunciationStage, DailyPronunciationStage, DailyPronunciationStage];
  recoveryArchive?: { at: number; version: unknown; contentHash: unknown }[];
  state?: DailyPronunciationGameState;
}

export function dailyPronunciationChoiceIds(activity: DailyPronunciationActivity, targetIndex: number): string[] {
  if (activity.game !== "beat-the-twin") return [];
  const target = activity.targets[targetIndex];
  if (!target?.pairId) return [];
  return (activity.itemPool ?? []).filter((candidate) => candidate.id === target.id || candidate.pairId === target.pairId)
    .map((candidate) => candidate.id);
}

function samePronunciationTarget(left: DailyPronunciationTarget, right: DailyPronunciationTarget): boolean {
  return left.id === right.id && left.text === right.text && left.kind === right.kind
    && left.ipa === right.ipa && left.mouthHint === right.mouthHint
    && left.categoryId === right.categoryId && left.phoneme === right.phoneme
    && left.pairId === right.pairId && left.note === right.note && left.meaning === right.meaning
    && left.visualObjectId === right.visualObjectId && left.lessonId === right.lessonId
    && left.stressMarkedText === right.stressMarkedText && left.targetWord === right.targetWord;
}

export function isAuthoredDailyPronunciationActivity(activity: DailyPronunciationActivity): boolean {
  if (!Array.isArray(activity.targets) || activity.targets.length !== 3
    || !activity.targets.every((target) => target.text.trim().length > 0 && target.text.length <= 80)
    || new Set(activity.targets.map((target) => target.text.trim().toLocaleLowerCase("en-US"))).size !== 3) return false;
  const pool = activity.itemPool ?? [];
  if (pool.length < 1 || pool.length > 64 || new Set(pool.map((item) => item.id)).size !== pool.length) return false;
  if (activity.game === "beat-the-twin") {
    return new Set(activity.targets.map((target) => target.id)).size === 3
      && activity.targets.every((target) => Boolean(target.pairId
        && pool.some((candidate) => samePronunciationTarget(candidate, target))
        && pool.some((candidate) => candidate.id !== target.id && candidate.pairId === target.pairId)));
  }
  if (activity.game === "echo-chain" || activity.game === "call-rescue") {
    if (!activity.sourceTarget || !activity.stages || activity.stages.length !== 3) return false;
    const sourceTarget = activity.sourceTarget;
    if (!pool.some((candidate) => samePronunciationTarget(candidate, sourceTarget))
      || !activity.targets.every((target) => target.id === sourceTarget.id)) return false;
    const expectedStages = activity.game === "echo-chain" ? echoStages(sourceTarget) : callStages(sourceTarget);
    if (!expectedStages) return false;
    const sameStage = (left: DailyPronunciationStage, right: DailyPronunciationStage) => left.kind === right.kind
      && left.text === right.text && left.stressMarkedText === right.stressMarkedText && left.targetWord === right.targetWord;
    const expectedTargets = stagedTargets(sourceTarget, expectedStages);
    return activity.stages.every((stage, index) => sameStage(stage, expectedStages[index]))
      && activity.targets.every((target, index) => samePronunciationTarget(target, expectedTargets[index]));
  }
  return new Set(activity.targets.map((target) => target.id)).size === 3
    && activity.targets.every((target) => pool.some((candidate) => samePronunciationTarget(candidate, target)));
}

export interface DailyActivity {
  id: string;
  kind: DailyActivityKind;
  title: { es: string; en: string };
  targetIds: string[];
  sourceId: string;
  reason: "review-due" | "weak-sound" | "weak-vocabulary" | "recent-mistake" | "level-next" | "path-goal" | "transfer";
  estimatedMinutes: number;
  status: ActivityStatus;
  pronunciation?: DailyPronunciationActivity;
  completedAt?: number;
}

export interface DailySession {
  id: string;
  version: 1 | 2;
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
export type DailyPronunciationHistoryRow = Omit<AttemptEvidence, "at"> & { at?: number } & Partial<Pick<Attempt,
  "providerStatus" | "policyVersion" | "targetPhonemeScore" | "weakestPhoneme" | "phoneme" | "pronunciationOutcome"
>>;

export interface DailySessionInput {
  profileId: string;
  day: string;
  now: number;
  level: Level;
  path: LearningPath;
  lessons: Lesson[];
  scenarios: Scenario[];
  progress: ItemProgress[];
  attempts?: DailyPronunciationHistoryRow[];
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
const MAX_PRONUNCIATION_HISTORY = 80;
const RECENT_MISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

export const FEATURE_LESSON: Readonly<Partial<Record<LatamPronunciationFeature, string>>> = Object.freeze({
  "short-i-long-ee": "i-vs-ii",
  "b-v": "b-vs-v",
  "dzh-y": "dj-vs-y",
  th: "th",
  "initial-s-cluster": "s-clusters",
  "final-endings": "ed-endings",
  "final-clusters": "final-clusters",
  h: "h",
  "rhotic-r": "american-r",
  schwa: "schwa",
  "word-stress": "word-stress",
  "connected-speech": "connected-speech",
  flap: "flap-t",
});

const LESSON_FEATURE = Object.freeze(Object.fromEntries(
  Object.entries(FEATURE_LESSON).map(([feature, lessonId]) => [lessonId, feature]),
)) as Readonly<Record<string, LatamPronunciationFeature>>;

const PHONEME_FEATURE: Readonly<Record<string, LatamPronunciationFeature>> = {
  "ɪ": "short-i-long-ee", i: "short-i-long-ee", "iː": "short-i-long-ee",
  "ʊ": "foot-goose", u: "foot-goose", "uː": "foot-goose",
  "æ": "trap-dress", "ɛ": "trap-dress", "ʌ": "strut-lot", "ɑ": "strut-lot",
  b: "b-v", v: "b-v", "dʒ": "dzh-y", j: "dzh-y", "ʃ": "sh-ch", "tʃ": "sh-ch",
  "θ": "th", "ð": "th", h: "h", r: "rhotic-r", "ɹ": "rhotic-r", "ɻ": "rhotic-r",
  "ə": "schwa", flap: "flap",
};

const NEUTRAL_FALLBACK_LESSON = BUILT_IN_LESSONS.find((lesson) => lesson.id === "i-vs-ii")!;
const BUILT_IN_LESSON_IDS = new Set(BUILT_IN_LESSONS.map((lesson) => lesson.id));

const ECHO_STAGE_METADATA: Readonly<Record<string, readonly [string, string, string]>> = Object.freeze({
  "connected-speech:phrase-1": ["She SELLS", "She SELLS SEA-shells", "She SELLS SEA-shells by the SEA-shore"],
  "connected-speech:phrase-2": ["I've BEEN", "I've been THINK-ing", "I've been THINK-ing a-BOUT it"],
});

function echoStages(source: DailyPronunciationTarget): [DailyPronunciationStage, DailyPronunciationStage, DailyPronunciationStage] | null {
  const marked = ECHO_STAGE_METADATA[source.id];
  if (!marked) return null;
  return marked.map((stressMarkedText) => ({ kind: "echo-chunk" as const, text: stressMarkedText.replaceAll(/-/g, "").toLowerCase().replace(/\b\w/g, (value) => value), stressMarkedText })) as [DailyPronunciationStage, DailyPronunciationStage, DailyPronunciationStage];
}

function callStages(source: DailyPronunciationTarget): [DailyPronunciationStage, DailyPronunciationStage, DailyPronunciationStage] | null {
  const word = source.text.trim();
  if (source.kind !== "word" || word.length > 40 || !/^[A-Za-z]+(?:['-][A-Za-z]+)*$/.test(word)) return null;
  return [
    { kind: "call-keyword", text: word, targetWord: word },
    { kind: "call-clarification", text: `Did you say ${word}?`, targetWord: word },
    { kind: "call-confirmation", text: `Let me confirm: ${word}.`, targetWord: word },
  ];
}

function stagedTargets(source: DailyPronunciationTarget, stages: readonly DailyPronunciationStage[]): [DailyPronunciationTarget, DailyPronunciationTarget, DailyPronunciationTarget] {
  return stages.map((stage) => ({ ...source, kind: stage.text === source.text ? source.kind : "phrase", text: stage.text, stressMarkedText: stage.stressMarkedText, targetWord: stage.targetWord })) as [DailyPronunciationTarget, DailyPronunciationTarget, DailyPronunciationTarget];
}

function pronunciationFeature(item: PracticeItem | undefined, lessonId?: string): LatamPronunciationFeature | undefined {
  if (!item) return undefined;
  if (lessonId && LESSON_FEATURE[lessonId]) return LESSON_FEATURE[lessonId];
  const metadata = PRONUNCIATION_TARGET_METADATA[item.id];
  if (metadata?.kind === "flap") return "flap";
  if (metadata?.kind === "final-ending") return "final-endings";
  if (/^(?:s[ptk]|str)$/.test(item.phoneme)) return "initial-s-cluster";
  return PHONEME_FEATURE[item.phoneme];
}

function strictRecentMiss(value: unknown): value is {
  itemId: string; passed: false; at?: number; providerStatus: "valid"; policyVersion: "latam-v1"; targetPhonemeScore: number;
} {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return row.evidence === "valid" && row.providerStatus === "valid" && row.policyVersion === "latam-v1"
    && row.passed === false && typeof row.itemId === "string"
    && typeof row.targetPhonemeScore === "number" && Number.isFinite(row.targetPhonemeScore)
    && row.targetPhonemeScore >= 0 && row.targetPhonemeScore <= 100;
}

function stableGame(seed: string): PronunciationGameKind {
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const games: readonly PronunciationGameKind[] = ["sound-sprint", "beat-the-twin", "echo-chain", "call-rescue"];
  return games[(hash >>> 0) % games.length];
}

function authoredPronunciationPool(
  primary: PracticeItem | undefined,
  primaryLessonId: string | undefined,
  lessons: readonly Lesson[],
): DailyPronunciationTarget[] {
  const feature = pronunciationFeature(primary, primaryLessonId);
  const mappedLessonId = feature ? FEATURE_LESSON[feature] : undefined;
  const lessonById = new Map([...lessons, ...BUILT_IN_LESSONS].map((lesson) => [lesson.id, lesson]));
  const primaryLesson = primaryLessonId ? lessonById.get(primaryLessonId) : undefined;
  const mappedLesson = mappedLessonId ? lessonById.get(mappedLessonId) : undefined;
  const paired = primary?.pairId
    ? [...lessonById.values()].flatMap((lesson) => lesson.items).filter((item) => item.pairId === primary.pairId)
    : [];
  const related = mappedLesson?.items ?? primaryLesson?.items ?? [];
  const ordered = [primary, ...paired, ...related, ...NEUTRAL_FALLBACK_LESSON.items]
    .filter((item): item is PracticeItem => Boolean(item && item.text.trim() && item.text.length <= 80));
  const lessonForItem = new Map<string, string>();
  for (const lesson of lessonById.values()) for (const item of lesson.items) lessonForItem.set(item.id, lesson.id);
  return [...new Map(ordered.map((item) => [item.id, {
    ...item,
    lessonId: lessonForItem.get(item.id) ?? primaryLessonId ?? NEUTRAL_FALLBACK_LESSON.id,
  }])).values()];
}

function targetTrio(pool: readonly DailyPronunciationTarget[]): [DailyPronunciationTarget, DailyPronunciationTarget, DailyPronunciationTarget] {
  if (pool.length < 3) throw new Error("Daily pronunciation requires three distinct authored targets");
  return [pool[0], pool[1], pool[2]];
}

const LEGACY_STAGE_SUFFIX = /:daily-(?:focus|check|confirm|echo-[123])$/;
const PRONUNCIATION_SELECTION_SOURCES = new Set<PronunciationSelectionSource>([
  "recent-valid-miss", "due-item", "personal-weakness", "latam-prior", "curriculum-fallback",
]);

/**
 * Upgrade the shipped v1 pronunciation shape without trusting its display
 * metadata. The target ids are treated only as references into Clara's signed
 * curriculum; unknown or internally inconsistent references fail closed.
 */
export function migrateLegacyDailyPronunciationActivity(value: unknown): DailyPronunciationActivity | null {
  if (!value || typeof value !== "object") return null;
  const legacy = value as Partial<DailyPronunciationActivity>;
  if (legacy.mode !== "scored" || legacy.state !== undefined || legacy.itemPool !== undefined
    || !["sound-sprint", "beat-the-twin", "echo-chain", "call-rescue"].includes(legacy.game ?? "")
    || !Array.isArray(legacy.targets) || legacy.targets.length !== 3) return null;

  const lessonByItem = new Map<string, Lesson>();
  const canonicalById = new Map<string, PracticeItem>();
  for (const lesson of BUILT_IN_LESSONS) for (const item of lesson.items) {
    lessonByItem.set(item.id, lesson);
    canonicalById.set(item.id, item);
  }
  const targetIds = legacy.targets.map((target) => typeof target?.id === "string" ? target.id : "");
  const sourceIds = targetIds.map((id) => id.replace(LEGACY_STAGE_SUFFIX, ""));
  const canonicalSources = sourceIds.map((id) => canonicalById.get(id));
  if (canonicalSources.some((item) => !item)) return null;
  const primary = canonicalSources[0]!;
  const primaryLesson = lessonByItem.get(primary.id);
  if (!primaryLesson) return null;
  const itemPool = authoredPronunciationPool(primary, primaryLesson.id, BUILT_IN_LESSONS);
  const poolById = new Map(itemPool.map((item) => [item.id, item]));
  const selectionSource = PRONUNCIATION_SELECTION_SOURCES.has(legacy.selectionSource as PronunciationSelectionSource)
    ? legacy.selectionSource as PronunciationSelectionSource
    : "curriculum-fallback";
  const feature = pronunciationFeature(primary, primaryLesson.id);
  const base = {
    mode: "scored" as const,
    game: legacy.game!,
    selectionSource,
    ...(feature ? { feature } : {}),
    itemPool,
  };

  let migrated: DailyPronunciationActivity;
  if (legacy.game === "echo-chain" || legacy.game === "call-rescue") {
    if (!sourceIds.every((id) => id === sourceIds[0])) return null;
    const sourceTarget = poolById.get(primary.id);
    const stages = sourceTarget && (legacy.game === "echo-chain" ? echoStages(sourceTarget) : callStages(sourceTarget));
    if (!sourceTarget || !stages) return null;
    const targets = stagedTargets(sourceTarget, stages);
    migrated = { ...base, game: legacy.game, sourceTarget, stages, targets };
  } else {
    const canonicalTargets = targetIds.map((id) => poolById.get(id));
    if (canonicalTargets.some((target) => !target)) return null;
    const targets = canonicalTargets as [DailyPronunciationTarget, DailyPronunciationTarget, DailyPronunciationTarget];
    migrated = { ...base, game: legacy.game as PronunciationGameKind, targets };
  }
  migrated.state = createDailyPronunciationGameState(migrated.game, migrated.targets, migrated.itemPool);
  return isAuthoredDailyPronunciationActivity(migrated) ? migrated : null;
}

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
  const itemsById = new Map(input.lessons.flatMap((lesson) => lesson.items).map((item) => [item.id, item]));
  const allItems = [...itemsById.values()].sort((left, right) => left.id.localeCompare(right.id));
  const relevant = new Set(input.pathLessonIds ?? []);
  const candidates = input.progress.filter((progress) => lessonsByItem.has(progress.itemId))
    .map((progress) => ({ ...progress, pathRelevant: relevant.has(progress.lessonId) }))
    .sort(compareCandidates(input.now, input.recentMinutes ?? 0));
  const primary = candidates[0];
  const due = candidates.find((candidate) => candidate.dueAt <= input.now);
  const validMiss = (input.attempts ?? []).slice(0, MAX_PRONUNCIATION_HISTORY).filter(strictRecentMiss)
    .filter((attempt) => itemsById.has(attempt.itemId) && typeof attempt.at === "number" && attempt.at >= input.now - RECENT_MISS_WINDOW_MS && attempt.at <= input.now)
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
  const personalWeaknesses = derivePersonalWeaknesses((input.attempts ?? []).slice(0, MAX_PRONUNCIATION_HISTORY))
    .sort((left, right) => left.score - right.score || right.validAttempts - left.validAttempts
      || LATAM_PRONUNCIATION_PRIOR[left.feature].priorOrder - LATAM_PRONUNCIATION_PRIOR[right.feature].priorOrder);
  const personalItem = personalWeaknesses
    .map((weakness) => allItems.find((item) => pronunciationFeature(item, lessonsByItem.get(item.id)?.id) === weakness.feature))
    .find((item): item is PracticeItem => item !== undefined);
  const priorItem = allItems
    .map((item) => ({ item, feature: pronunciationFeature(item, lessonsByItem.get(item.id)?.id) }))
    .filter((entry): entry is { item: PracticeItem; feature: LatamPronunciationFeature } => entry.feature !== undefined)
    .sort((left, right) => LATAM_PRONUNCIATION_PRIOR[left.feature].priorOrder - LATAM_PRONUNCIATION_PRIOR[right.feature].priorOrder
      || left.item.id.localeCompare(right.item.id))[0]?.item;
  const nextLesson = [...input.lessons].sort((a, b) => Number(relevant.has(b.id)) - Number(relevant.has(a.id)) || a.order - b.order || a.id.localeCompare(b.id))[0];
  const fallbackId = nextLesson?.items[0]?.id ?? "";
  const target = (candidate?: Candidate) => candidate?.itemId || fallbackId;
  const source = (candidate?: Candidate) => candidate?.lessonId || nextLesson?.id || "curriculum";
  const scenario = input.scenarios[0];
  const sparse = input.progress.every((progress) => progress.attempts === 0);
  const proposedSpeakingItem = validMiss ? itemsById.get(validMiss.itemId) : due ? itemsById.get(due.itemId) : personalItem ?? priorItem ?? allItems[0];
  const proposedSpeakingLesson = proposedSpeakingItem ? lessonsByItem.get(proposedSpeakingItem.id) : undefined;
  const proposedFeature = pronunciationFeature(proposedSpeakingItem, proposedSpeakingLesson?.id);
  // Strict pronunciation never grades an unknown custom item or word-stress by
  // pretending whole-word evidence is the requested stress feature.
  const speakingItem = proposedSpeakingLesson && BUILT_IN_LESSON_IDS.has(proposedSpeakingLesson.id) && proposedFeature !== "word-stress"
    ? proposedSpeakingItem
    : undefined;
  const speakingLesson = speakingItem ? proposedSpeakingLesson : undefined;
  const rankedSpeakingSource: PronunciationSelectionSource = validMiss ? "recent-valid-miss" : due ? "due-item" : personalItem
    ? "personal-weakness" : priorItem ? "latam-prior" : "curriculum-fallback";
  const speakingSource: PronunciationSelectionSource = speakingItem ? rankedSpeakingSource : "curriculum-fallback";
  const authoredPool = authoredPronunciationPool(speakingItem, speakingLesson?.id, input.lessons);
  let targets = targetTrio(authoredPool);
  const sourceId = speakingLesson?.id ?? NEUTRAL_FALLBACK_LESSON.id;
  const speaking = activity("speak", sourceId, targets.map((item) => item.id), speakingItem && validMiss ? "recent-mistake" : speakingItem && personalItem ? "weak-sound" : "level-next");
  const proposedGame = stableGame(`${input.profileId}:${input.day}:${speakingItem?.id ?? "neutral"}`);
  const sourceTarget = speakingItem ? authoredPool.find((item) => item.id === speakingItem.id) : undefined;
  const echo = sourceTarget ? echoStages(sourceTarget) : null;
  const call = sourceTarget ? callStages(sourceTarget) : null;
  const game = proposedGame === "beat-the-twin" && !targets.every((item) => item.pairId && authoredPool.some((candidate) => candidate.id !== item.id && candidate.pairId === item.pairId))
    ? "sound-sprint"
    : proposedGame === "echo-chain" && !echo
      ? "sound-sprint"
      : proposedGame === "call-rescue" && !call
        ? "sound-sprint"
        : proposedGame;
  const stages = game === "echo-chain" ? echo : game === "call-rescue" ? call : null;
  if (sourceTarget && stages) targets = stagedTargets(sourceTarget, stages);
  speaking.targetIds = targets.map((item) => item.id);
  const state = createDailyPronunciationGameState(game, targets, authoredPool);
  speaking.pronunciation = {
    mode: "scored",
    game,
    selectionSource: speakingSource,
    ...(pronunciationFeature(speakingItem, speakingLesson?.id) ? { feature: pronunciationFeature(speakingItem, speakingLesson?.id) } : {}),
    targets,
    itemPool: authoredPool,
    ...(sourceTarget && stages ? { sourceTarget, stages } : {}),
    state,
  };
  const activities = [
    activity("retrieve", source(due), [target(due)], due ? "review-due" : "level-next"),
    activity("learn", nextLesson?.id ?? "curriculum", [fallbackId], "level-next"),
    activity("listen", source(primary), [target(primary)], sparse ? "level-next" : "weak-sound"),
    speaking,
    activity("situation", scenario?.id ?? "situation", [scenario?.id ?? ""].filter(Boolean), input.path === "job" ? "path-goal" : "transfer"),
    activity("reflect", "session", [], "transfer"),
  ];
  const budgeted = activities.reduce<DailyActivity[]>((kept, entry) => {
    const used = kept.reduce((total, item) => total + item.estimatedMinutes, 0);
    return used + entry.estimatedMinutes <= 15 ? [...kept, entry] : kept;
  }, []);
  return {
    id: `daily:${input.profileId}:${input.day}`, version: 2, profileId: input.profileId, day: input.day,
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
