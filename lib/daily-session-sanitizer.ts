import { dailyPronunciationChoiceIds, type DailyActivity, type DailyPronunciationActivity, type DailyPronunciationStage, type DailyPronunciationTarget, type DailySession } from "./daily-session.ts";
import { hasRequiredScoredPronunciation } from "./daily-session-loader.ts";
import { dailyPronunciationContentHash, dailyPronunciationLegacyContentHash, isDailyPronunciationGameState, type DailyPronunciationGameState } from "./speech/daily-pronunciation-game.ts";
import { LESSONS } from "./content/lessons.ts";
import { LATAM_PRONUNCIATION_FEATURES } from "./speech/latam-prior.ts";

type UnknownRecord = Record<string, unknown>;
const SAFE_ID = /^[a-z0-9][a-z0-9:._/-]*$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HASH = /^daily-pronunciation-v[23]:[0-9a-f]{8}$/;
const MAX_AT = 9_000_000_000_000_000;
const AUTHORED_BY_ID = new Map(LESSONS.flatMap((lesson) => lesson.items.map((item) => [item.id, { item, lessonId: lesson.id }] as const)));
const SELECTION_SOURCES = new Set(["recent-valid-miss", "due-item", "personal-weakness", "latam-prior", "curriculum-fallback"]);
const FEATURES = new Set<string>(LATAM_PRONUNCIATION_FEATURES);

function authoredMatch(item: DailyPronunciationTarget): boolean {
  const authored = AUTHORED_BY_ID.get(item.id);
  return Boolean(authored && authored.item.text === item.text && authored.item.kind === item.kind
    && authored.item.ipa === item.ipa && authored.item.mouthHint === item.mouthHint
    && authored.item.categoryId === item.categoryId && authored.item.phoneme === item.phoneme
    && authored.item.pairId === item.pairId && authored.item.note === item.note
    && authored.item.meaning === item.meaning && authored.item.visualObjectId === item.visualObjectId
    && authored.lessonId === item.lessonId);
}

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
    ? value as UnknownRecord : null;
}
function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max ? value : null;
}
function id(value: unknown): string | null {
  const result = text(value, 160);
  return result && SAFE_ID.test(result) ? result : null;
}
function integer(value: unknown, min = 0, max = MAX_AT): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}
function nullableAt(value: unknown): number | null | undefined {
  return value === null ? null : integer(value) ?? undefined;
}
function translation(value: unknown): { es: string; en: string } | null {
  const source = record(value);
  const es = text(source?.es, 240), en = text(source?.en, 240);
  return es && en ? { es, en } : null;
}

function target(value: unknown): DailyPronunciationTarget | null {
  const source = record(value);
  if (!source) return null;
  const targetId = id(source.id), targetText = text(source.text, 80), ipa = typeof source.ipa === "string" && source.ipa.length <= 160 ? source.ipa : null;
  const mouthHint = typeof source.mouthHint === "string" && source.mouthHint.length <= 320 ? source.mouthHint : null;
  const categoryId = id(source.categoryId), phoneme = text(source.phoneme, 64);
  if (!targetId || !targetText || ipa === null || mouthHint === null || !categoryId || !phoneme || (source.kind !== "word" && source.kind !== "phrase")) return null;
  const optional = (key: string, max: number) => source[key] === undefined ? undefined : text(source[key], max) ?? null;
  const pairId = optional("pairId", 128), note = optional("note", 240), meaning = optional("meaning", 240), lessonId = optional("lessonId", 128);
  const stressMarkedText = optional("stressMarkedText", 100), targetWord = optional("targetWord", 80);
  const visualObjectId = source.visualObjectId === undefined ? undefined : id(source.visualObjectId);
  if ([pairId, note, meaning, lessonId, stressMarkedText, targetWord, visualObjectId].includes(null)) return null;
  return {
    id: targetId, text: targetText, ipa, mouthHint, kind: source.kind, categoryId, phoneme,
    ...(pairId ? { pairId } : {}), ...(note ? { note } : {}), ...(meaning ? { meaning } : {}),
    ...(visualObjectId ? { visualObjectId } : {}), ...(lessonId ? { lessonId } : {}),
    ...(stressMarkedText ? { stressMarkedText } : {}), ...(targetWord ? { targetWord } : {}),
  };
}

function stage(value: unknown): DailyPronunciationStage | null {
  const source = record(value);
  const kind = source?.kind;
  const valueText = text(source?.text, 80);
  if (!valueText || !["echo-chunk", "call-keyword", "call-clarification", "call-confirmation"].includes(String(kind))) return null;
  const stressMarkedText = source?.stressMarkedText === undefined ? undefined : text(source.stressMarkedText, 100);
  const targetWord = source?.targetWord === undefined ? undefined : text(source.targetWord, 80);
  if (stressMarkedText === null || targetWord === null) return null;
  return { kind: kind as DailyPronunciationStage["kind"], text: valueText, ...(stressMarkedText ? { stressMarkedText } : {}), ...(targetWord ? { targetWord } : {}) };
}

function gameState(value: unknown, contentHashes: readonly string[], allowedChoiceIds?: readonly string[]): DailyPronunciationGameState | null {
  const source = record(value);
  if (!source || !Array.isArray(source.attemptEvents) || source.attemptEvents.length > 9
    || (source.overflowEvents !== undefined && (!Array.isArray(source.overflowEvents) || source.overflowEvents.length > 9))
    || (source.conflictIds !== undefined && (!Array.isArray(source.conflictIds) || source.conflictIds.length > 9))
    || !Array.isArray(source.sessions) || source.sessions.length !== 3 || !Array.isArray(source.resolutions) || source.resolutions.length !== 3) return null;
  const mapEvents = (values: unknown[]) => values.map((entry) => {
    const event = record(entry);
    return event ? { id: event.id, targetIndex: event.targetIndex, outcome: event.outcome, score: event.score, ordinal: event.ordinal, at: event.at } : null;
  });
  const events = mapEvents(source.attemptEvents);
  const overflowEvents = mapEvents((source.overflowEvents as unknown[] | undefined) ?? []);
  if (events.includes(null) || overflowEvents.includes(null)) return null;
  const sessions = source.sessions.map((entry) => {
    const session = record(entry);
    if (!session) return null;
    return { validAttempts: session.validAttempts, ...(session.firstValidScore === undefined ? {} : { firstValidScore: session.firstValidScore }), status: session.status };
  });
  if (sessions.includes(null)) return null;
  const mapped = {
    version: source.version, game: source.game, contentHash: source.contentHash, sequence: source.sequence,
    targetIndex: source.targetIndex, stage: source.stage, ...(source.choiceId === undefined ? {} : { choiceId: source.choiceId }),
    attemptEvents: events, overflowEvents, conflictIds: [...((source.conflictIds as unknown[] | undefined) ?? [])],
    sessions, resolutions: [...source.resolutions], gradedTargets: source.gradedTargets,
    masteredTargets: source.masteredTargets, technicalTargets: source.technicalTargets, ungradedTargets: source.ungradedTargets, terminal: source.terminal,
  };
  return isDailyPronunciationGameState(mapped, contentHashes, allowedChoiceIds) ? mapped : null;
}

function pronunciation(value: unknown): DailyPronunciationActivity | null {
  const source = record(value);
  if (!source || source.mode !== "scored" || !["sound-sprint", "beat-the-twin", "echo-chain", "call-rescue"].includes(String(source.game))
    || !SELECTION_SOURCES.has(String(source.selectionSource))
    || (source.feature !== undefined && !FEATURES.has(String(source.feature)))
    || !Array.isArray(source.targets) || source.targets.length !== 3 || !Array.isArray(source.itemPool) || source.itemPool.length < 1 || source.itemPool.length > 64) return null;
  const targets = source.targets.map(target), itemPool = source.itemPool.map(target);
  if (targets.includes(null) || itemPool.includes(null)) return null;
  const allowedChoiceIds = (itemPool as DailyPronunciationTarget[]).map((item) => item.id);
  const contentHashes = [
    dailyPronunciationContentHash(source.game as DailyPronunciationActivity["game"], targets as DailyPronunciationTarget[], itemPool as DailyPronunciationTarget[]),
    dailyPronunciationLegacyContentHash(source.game as DailyPronunciationActivity["game"], targets as DailyPronunciationTarget[]),
  ];
  const state = gameState(source.state, contentHashes, allowedChoiceIds);
  if (!state) return null;
  const sourceTarget = source.sourceTarget === undefined ? undefined : target(source.sourceTarget);
  const stages = source.stages === undefined ? undefined : Array.isArray(source.stages) && source.stages.length === 3 ? source.stages.map(stage) : null;
  if (sourceTarget === null || stages === null || stages?.includes(null)) return null;
  const recoveryArchive = source.recoveryArchive === undefined ? undefined : Array.isArray(source.recoveryArchive) && source.recoveryArchive.length <= 3
    ? source.recoveryArchive.map((entry) => {
        const archive = record(entry); const at = integer(archive?.at);
        const version = archive?.version === null ? null : integer(archive?.version, 0, 2);
        const contentHash = archive?.contentHash === null ? null : typeof archive?.contentHash === "string" && HASH.test(archive.contentHash) ? archive.contentHash : undefined;
        return at === null || (version === null && archive?.version !== null) || contentHash === undefined ? null : { at, version, contentHash };
      }) : null;
  if (recoveryArchive === null || recoveryArchive?.includes(null)) return null;
  const mapped: DailyPronunciationActivity = {
    mode: "scored", game: source.game as DailyPronunciationActivity["game"], selectionSource: source.selectionSource as DailyPronunciationActivity["selectionSource"],
    ...(typeof source.feature === "string" && source.feature.length <= 40 ? { feature: source.feature as DailyPronunciationActivity["feature"] } : {}),
    targets: targets as DailyPronunciationActivity["targets"], itemPool: itemPool as DailyPronunciationTarget[], state,
    ...(sourceTarget ? { sourceTarget } : {}), ...(stages ? { stages: stages as DailyPronunciationActivity["stages"] } : {}),
    ...(recoveryArchive ? { recoveryArchive: recoveryArchive as NonNullable<DailyPronunciationActivity["recoveryArchive"]> } : {}),
  };
  if (mapped.game === "beat-the-twin") {
    if ((state.stage === "choice-made" && (!state.choiceId || !dailyPronunciationChoiceIds(mapped, state.targetIndex).includes(state.choiceId)))
      || (state.stage !== "choice-made" && state.choiceId !== undefined)) return null;
  } else if (state.stage !== "ready" || state.choiceId !== undefined) return null;
  if (!(mapped.itemPool ?? []).every(authoredMatch)) return null;
  if (mapped.game === "echo-chain" || mapped.game === "call-rescue") {
    if (!mapped.sourceTarget || !authoredMatch(mapped.sourceTarget)) return null;
  } else if (!mapped.targets.every(authoredMatch)) return null;
  if (mapped.game === "beat-the-twin" && !mapped.targets.every((entry) => mapped.itemPool?.some((partner) => partner.id !== entry.id && partner.pairId === entry.pairId && authoredMatch(partner)))) return null;
  return mapped;
}

/** Preserve the bounded pronunciation object shipped by Task 7 v1 without accepting provider payloads. */
function legacyPronunciation(value: unknown): DailyPronunciationActivity | null {
  const source = record(value);
  if (!source || source.mode !== "scored" || !["sound-sprint", "beat-the-twin", "echo-chain", "call-rescue"].includes(String(source.game))
    || !SELECTION_SOURCES.has(String(source.selectionSource))
    || (source.feature !== undefined && !FEATURES.has(String(source.feature)))
    || !Array.isArray(source.targets) || source.targets.length !== 3) return null;
  const targets = source.targets.map(target);
  if (targets.includes(null)) return null;
  return {
    mode: "scored",
    game: source.game as DailyPronunciationActivity["game"],
    selectionSource: source.selectionSource as DailyPronunciationActivity["selectionSource"],
    ...(typeof source.feature === "string" ? { feature: source.feature as DailyPronunciationActivity["feature"] } : {}),
    targets: targets as DailyPronunciationActivity["targets"],
  };
}

function activity(value: unknown, version: 1 | 2): DailyActivity | null {
  const source = record(value);
  if (!source) return null;
  const activityId = id(source.id), title = translation(source.title), sourceId = id(source.sourceId);
  if (!activityId || !title || !sourceId || !["retrieve", "learn", "listen", "speak", "situation", "reflect"].includes(String(source.kind))
    || !["review-due", "weak-sound", "weak-vocabulary", "recent-mistake", "level-next", "path-goal", "transfer"].includes(String(source.reason))
    || !["pending", "active", "completed", "technical-skip"].includes(String(source.status)) || !Array.isArray(source.targetIds) || source.targetIds.length > 64) return null;
  const targetIds = source.targetIds.map(id); const estimatedMinutes = integer(source.estimatedMinutes, 0, 30);
  const completedAt = source.completedAt === undefined ? undefined : integer(source.completedAt);
  if (targetIds.includes(null) || estimatedMinutes === null || completedAt === null) return null;
  const mappedPronunciation = source.pronunciation === undefined ? undefined
    : version === 2 ? pronunciation(source.pronunciation) : legacyPronunciation(source.pronunciation);
  if (source.pronunciation !== undefined && !mappedPronunciation) return null;
  return { id: activityId, kind: source.kind as DailyActivity["kind"], title, targetIds: targetIds as string[], sourceId, reason: source.reason as DailyActivity["reason"], estimatedMinutes, status: source.status as DailyActivity["status"], ...(mappedPronunciation ? { pronunciation: mappedPronunciation } : {}), ...(completedAt === undefined ? {} : { completedAt }) };
}

export function sanitizeDailySessionPayload(value: unknown, expectedProfileId: string, expectedDay: string, expectedVersion?: unknown): DailySession | null {
  const source = record(value);
  if (!source || source.profileId !== expectedProfileId || source.day !== expectedDay || !DAY.test(expectedDay) || (source.version !== 1 && source.version !== 2) || (expectedVersion !== undefined && source.version !== expectedVersion)) return null;
  const sessionId = id(source.id), objective = translation(source.objective), outcome = translation(source.outcome);
  if (sessionId !== `daily:${expectedProfileId}:${expectedDay}` || !objective || !outcome || !["spanish-full", "spanish-selective", "english-default"].includes(String(source.assistance))
    || !Array.isArray(source.activities) || source.activities.length < 1 || source.activities.length > 12 || typeof source.rewardClaimed !== "boolean") return null;
  const version = source.version as 1 | 2;
  const activities = source.activities.map((entry) => activity(entry, version));
  const startedAt = nullableAt(source.startedAt), completedAt = nullableAt(source.completedAt), createdAt = integer(source.createdAt), updatedAt = integer(source.updatedAt);
  if (activities.includes(null) || startedAt === undefined || completedAt === undefined || createdAt === null || updatedAt === null) return null;
  const currentActivityId = source.currentActivityId === null ? null : id(source.currentActivityId);
  if (currentActivityId === null && source.currentActivityId !== null || currentActivityId && !activities.some((entry) => entry?.id === currentActivityId)) return null;
  const result: DailySession = {
    id: sessionId, version, profileId: expectedProfileId, day: expectedDay, objective, outcome,
    assistance: source.assistance as DailySession["assistance"], activities: activities as DailyActivity[], currentActivityId,
    rewardClaimed: source.rewardClaimed, startedAt, completedAt, createdAt, updatedAt,
  };
  return version === 2 && !hasRequiredScoredPronunciation(result) ? null : result;
}
