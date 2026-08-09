import type { PracticeItem } from "../db/types.ts";
import type { PronunciationGameKind } from "../daily-session.ts";
import type { PronunciationSessionState } from "./pronunciation-session.ts";

export type DailyPronunciationResolution = "graded-mastered" | "graded-practiced" | "technical" | "ungraded";
export type DailyPronunciationStage = "ready" | "listened" | "choice-made";
export type DailyPronunciationAttemptOutcome = "mastered" | "retry";

export interface DailyPronunciationAttemptEvent {
  id: string;
  targetIndex: 0 | 1 | 2;
  outcome: DailyPronunciationAttemptOutcome;
  score: number;
  /** Attempt number observed when capture began; merge ordering never trusts it alone. */
  ordinal: 1 | 2 | 3;
  at: number;
}

export interface DailyPronunciationGameState {
  version: 2;
  game: PronunciationGameKind;
  contentHash: string;
  sequence: number;
  targetIndex: number;
  stage: DailyPronunciationStage;
  choiceId?: string;
  /** Mergeable, idempotent evidence. At most three deterministic events per target. */
  attemptEvents: DailyPronunciationAttemptEvent[];
  /** Valid evidence below the three-per-target selection line; retained to keep future merges associative. */
  overflowEvents?: DailyPronunciationAttemptEvent[];
  /** Permanent UUID tombstones for conflicting canonical payloads. */
  conflictIds?: string[];
  sessions: [PronunciationSessionState, PronunciationSessionState, PronunciationSessionState];
  resolutions: [DailyPronunciationResolution | null, DailyPronunciationResolution | null, DailyPronunciationResolution | null];
  gradedTargets: number;
  masteredTargets: number;
  technicalTargets: number;
  ungradedTargets: number;
  terminal: boolean;
}

type IdentityTarget = Pick<PracticeItem, "id" | "text" | "kind"> & Partial<Pick<PracticeItem,
  "ipa" | "mouthHint" | "categoryId" | "phoneme" | "pairId" | "note" | "meaning" | "visualObjectId"
>> & { lessonId?: string; stressMarkedText?: string; targetWord?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CONTENT_HASH = /^daily-pronunciation-v[23]:[0-9a-f]{8}$/;
const RESOLUTIONS = new Set<DailyPronunciationResolution | null>([null, "graded-mastered", "graded-practiced", "technical", "ungraded"]);
const MAX_EVENTS = 9;
const MAX_OVERFLOW_EVENTS = 9;
export const MAX_DAILY_PRONUNCIATION_CONFLICT_IDS = 9;
export const MAX_DAILY_PRONUNCIATION_SEQUENCE = 1_000_000;
export const MAX_DAILY_PRONUNCIATION_TIMESTAMP = 9_000_000_000_000_000;

function fingerprint(value: string, prefix: string): string {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `${prefix}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function dailyPronunciationLegacyContentHash(game: PronunciationGameKind, targets: readonly IdentityTarget[]): string {
  return fingerprint(JSON.stringify({ format: 2, game, targets: targets.map(({ id, text, kind }) => ({ id, text, kind })) }), "daily-pronunciation-v2");
}

function canonicalIdentity(target: IdentityTarget) {
  return {
    id: target.id, text: target.text, kind: target.kind,
    ipa: target.ipa ?? null, mouthHint: target.mouthHint ?? null,
    categoryId: target.categoryId ?? null, phoneme: target.phoneme ?? null,
    pairId: target.pairId ?? null, lessonId: target.lessonId ?? null,
    note: target.note ?? null, meaning: target.meaning ?? null,
    visualObjectId: target.visualObjectId ?? null,
    stressMarkedText: target.stressMarkedText ?? null, targetWord: target.targetWord ?? null,
  };
}

export function dailyPronunciationContentHash(
  game: PronunciationGameKind,
  targets: readonly IdentityTarget[],
  itemPool: readonly IdentityTarget[] = [],
): string {
  const pool = [...itemPool].sort((left, right) => left.id === right.id ? 0 : left.id < right.id ? -1 : 1).map(canonicalIdentity);
  return fingerprint(JSON.stringify({ format: 3, game, targets: targets.map(canonicalIdentity), itemPool: pool }), "daily-pronunciation-v3");
}

const freshSession = (): PronunciationSessionState => ({ validAttempts: 0, status: "active" });

export function createDailyPronunciationGameState(game: PronunciationGameKind, targets: readonly IdentityTarget[], itemPool: readonly IdentityTarget[] = []): DailyPronunciationGameState {
  return deriveState({
    version: 2,
    game,
    contentHash: dailyPronunciationContentHash(game, targets, itemPool),
    sequence: 0,
    targetIndex: 0,
    stage: "ready",
    attemptEvents: [],
    overflowEvents: [],
    conflictIds: [],
    sessions: [freshSession(), freshSession(), freshSession()],
    resolutions: [null, null, null],
    gradedTargets: 0,
    masteredTargets: 0,
    technicalTargets: 0,
    ungradedTargets: 0,
    terminal: false,
  });
}

export function isDailyPronunciationAttemptEvent(value: unknown): value is DailyPronunciationAttemptEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<DailyPronunciationAttemptEvent>;
  return typeof event.id === "string" && UUID.test(event.id)
    && (event.targetIndex === 0 || event.targetIndex === 1 || event.targetIndex === 2)
    && (event.outcome === "mastered" || event.outcome === "retry")
    && typeof event.score === "number" && Number.isFinite(event.score) && event.score >= 0 && event.score <= 100
    && (event.ordinal === 1 || event.ordinal === 2 || event.ordinal === 3)
    && typeof event.at === "number" && Number.isSafeInteger(event.at) && event.at >= 0 && event.at <= MAX_DAILY_PRONUNCIATION_TIMESTAMP;
}

function canonicalEvent(event: DailyPronunciationAttemptEvent): string {
  return JSON.stringify([event.id, event.targetIndex, event.outcome, event.score, event.ordinal, event.at]);
}

const compareText = (left: string, right: string): number => left === right ? 0 : left < right ? -1 : 1;

function compareEvents(left: DailyPronunciationAttemptEvent, right: DailyPronunciationAttemptEvent): number {
  return left.targetIndex - right.targetIndex
    || left.ordinal - right.ordinal
    || Number(right.outcome === "mastered") - Number(left.outcome === "mastered")
    || left.at - right.at
    || compareText(left.id, right.id);
}

function compareSelectionPriority(left: DailyPronunciationAttemptEvent, right: DailyPronunciationAttemptEvent): number {
  return Number(right.outcome === "mastered") - Number(left.outcome === "mastered")
    || left.ordinal - right.ordinal
    || left.at - right.at
    || compareText(left.id, right.id);
}

export interface DailyPronunciationEventReduction {
  events: DailyPronunciationAttemptEvent[];
  overflowEvents: DailyPronunciationAttemptEvent[];
  conflictIds: string[];
  corruptIds: string[];
}

/** Canonical local/cloud ordering and conflict rule. Never use map insertion order. */
export function reduceDailyPronunciationEvents(values: readonly unknown[], inheritedConflictIds: readonly unknown[] = []): DailyPronunciationEventReduction {
  const inherited = [...new Set(inheritedConflictIds.filter((value): value is string => typeof value === "string" && UUID.test(value)))].sort(compareText);
  if (!inheritedConflictIds.every((value) => typeof value === "string" && UUID.test(value))
    || inherited.length > MAX_DAILY_PRONUNCIATION_CONFLICT_IDS) {
    throw new Error("Pronunciation corruption evidence bound exceeded");
  }
  const grouped = new Map<string, DailyPronunciationAttemptEvent[]>();
  for (const value of values) {
    if (!isDailyPronunciationAttemptEvent(value) || inherited.includes(value.id)) continue;
    grouped.set(value.id, [...(grouped.get(value.id) ?? []), { ...value }]);
  }
  const corruptIds = [...inherited];
  const unique: DailyPronunciationAttemptEvent[] = [];
  for (const [id, candidates] of [...grouped].sort(([left], [right]) => compareText(left, right))) {
    const payloads = new Set(candidates.map(canonicalEvent));
    if (payloads.size !== 1) corruptIds.push(id);
    else unique.push(candidates[0]);
  }
  const conflictIds = [...new Set(corruptIds)].sort(compareText);
  if (conflictIds.length > MAX_DAILY_PRONUNCIATION_CONFLICT_IDS) throw new Error("Pronunciation corruption evidence bound exceeded");
  const eligible = unique.filter((event) => !conflictIds.includes(event.id));
  const selected = [0, 1, 2].flatMap((targetIndex) => eligible
    .filter((event) => event.targetIndex === targetIndex)
    .sort(compareSelectionPriority)
    .slice(0, 3));
  const selectedIds = new Set(selected.map((event) => event.id));
  const overflowEvents = eligible.filter((event) => !selectedIds.has(event.id)).sort(compareEvents);
  if (overflowEvents.length > MAX_OVERFLOW_EVENTS) throw new Error("Pronunciation evidence overflow bound exceeded");
  return {
    events: selected.sort(compareEvents).slice(0, MAX_EVENTS),
    overflowEvents,
    conflictIds,
    corruptIds: conflictIds,
  };
}

function reducedEvidence(state: Pick<DailyPronunciationGameState, "attemptEvents" | "overflowEvents" | "conflictIds">): DailyPronunciationEventReduction {
  return reduceDailyPronunciationEvents([...(state.attemptEvents ?? []), ...(state.overflowEvents ?? [])], state.conflictIds ?? []);
}

function sessionFor(events: readonly DailyPronunciationAttemptEvent[], resolution: DailyPronunciationResolution | null): PronunciationSessionState {
  if (events.length === 0) return { validAttempts: 0, status: resolution === "technical" ? "technical-skip" : "active" };
  const firstValidScore = events[0].score;
  if (events.some((event) => event.outcome === "mastered")) return { validAttempts: events.length, firstValidScore, status: "mastered" };
  if (events.length >= 3) return { validAttempts: 3, firstValidScore, status: "practiced-not-mastered" };
  if (resolution === "technical") return { validAttempts: events.length, firstValidScore, status: "technical-skip" };
  return { validAttempts: events.length, firstValidScore, status: "active" };
}

function validResolution(resolution: DailyPronunciationResolution | null, events: readonly DailyPronunciationAttemptEvent[]): boolean {
  if (resolution === null || resolution === "ungraded") return resolution === null || events.length === 0;
  if (resolution === "technical") return events.length < 3 && !events.some((event) => event.outcome === "mastered");
  if (resolution === "graded-mastered") return events.some((event) => event.outcome === "mastered");
  return events.length === 3 && events.every((event) => event.outcome === "retry");
}

function deriveState(state: DailyPronunciationGameState): DailyPronunciationGameState {
  const reduced = reducedEvidence(state);
  const attemptEvents = reduced.events;
  const resolutions = state.resolutions.map((resolution, index) => {
    const events = attemptEvents.filter((event) => event.targetIndex === index);
    return validResolution(resolution, events) ? resolution : null;
  }) as DailyPronunciationGameState["resolutions"];
  const sessions = [0, 1, 2].map((index) => sessionFor(attemptEvents.filter((event) => event.targetIndex === index), resolutions[index])) as DailyPronunciationGameState["sessions"];
  const terminal = resolutions.every((entry) => entry !== null);
  const firstPending = resolutions.findIndex((entry) => entry === null);
  const targetIndex = terminal ? 2 : firstPending;
  return {
    ...state,
    attemptEvents,
    overflowEvents: reduced.overflowEvents,
    conflictIds: reduced.conflictIds,
    sessions,
    resolutions,
    targetIndex,
    stage: terminal || targetIndex !== state.targetIndex ? "ready" : state.stage,
    ...(terminal || targetIndex !== state.targetIndex ? { choiceId: undefined } : {}),
    gradedTargets: resolutions.filter((entry) => entry === "graded-mastered" || entry === "graded-practiced").length,
    masteredTargets: resolutions.filter((entry) => entry === "graded-mastered").length,
    technicalTargets: resolutions.filter((entry) => entry === "technical").length,
    ungradedTargets: resolutions.filter((entry) => entry === "ungraded").length,
    terminal,
  };
}

export function isDailyPronunciationGameState(value: unknown, contentHash?: string | readonly string[], allowedChoiceIds?: readonly string[]): value is DailyPronunciationGameState {
  if (!value || typeof value !== "object") return false;
  const state = value as DailyPronunciationGameState;
  const allowedHashes = typeof contentHash === "string" ? [contentHash] : contentHash;
  if (state.version !== 2 || !["sound-sprint", "beat-the-twin", "echo-chain", "call-rescue"].includes(state.game)
    || typeof state.contentHash !== "string" || !CONTENT_HASH.test(state.contentHash)
    || (allowedHashes && !allowedHashes.includes(state.contentHash))) return false;
  if (!Number.isSafeInteger(state.sequence) || state.sequence < 0 || state.sequence > MAX_DAILY_PRONUNCIATION_SEQUENCE || !Number.isInteger(state.targetIndex) || state.targetIndex < 0 || state.targetIndex > 2) return false;
  if (!["ready", "listened", "choice-made"].includes(state.stage) || (state.choiceId !== undefined && (typeof state.choiceId !== "string" || !state.choiceId))) return false;
  if (state.game !== "beat-the-twin" && (state.stage !== "ready" || state.choiceId !== undefined)) return false;
  if (state.game === "beat-the-twin") {
    if (state.stage === "choice-made") {
      if (!state.choiceId || (allowedChoiceIds && !allowedChoiceIds.includes(state.choiceId))) return false;
    } else if (state.choiceId !== undefined) return false;
  }
  if (!Array.isArray(state.attemptEvents) || state.attemptEvents.length > MAX_EVENTS || !state.attemptEvents.every(isDailyPronunciationAttemptEvent)) return false;
  if (new Set(state.attemptEvents.map((event) => event.id)).size !== state.attemptEvents.length) return false;
  const overflowEvents = state.overflowEvents ?? [];
  const conflictIds = state.conflictIds ?? [];
  if (!Array.isArray(overflowEvents) || overflowEvents.length > MAX_OVERFLOW_EVENTS || !overflowEvents.every(isDailyPronunciationAttemptEvent)) return false;
  if (!Array.isArray(conflictIds) || conflictIds.length > MAX_DAILY_PRONUNCIATION_CONFLICT_IDS || !conflictIds.every((id) => typeof id === "string" && UUID.test(id))) return false;
  if (new Set([...state.attemptEvents, ...overflowEvents].map((event) => event.id)).size !== state.attemptEvents.length + overflowEvents.length
    || new Set(conflictIds).size !== conflictIds.length) return false;
  if (!Array.isArray(state.resolutions) || state.resolutions.length !== 3 || !state.resolutions.every((entry) => RESOLUTIONS.has(entry))) return false;
  if (state.game === "beat-the-twin" && state.resolutions[state.targetIndex] === null
    && state.attemptEvents.some((event) => event.targetIndex === state.targetIndex) && state.stage !== "choice-made") return false;
  let derived: DailyPronunciationGameState;
  try {
    derived = deriveState({ ...state, attemptEvents: state.attemptEvents, overflowEvents, conflictIds, resolutions: [...state.resolutions] as DailyPronunciationGameState["resolutions"] });
  } catch { return false; }
  return JSON.stringify(state.attemptEvents) === JSON.stringify(derived.attemptEvents)
    && (state.overflowEvents === undefined || JSON.stringify(state.overflowEvents) === JSON.stringify(derived.overflowEvents))
    && (state.conflictIds === undefined || JSON.stringify(state.conflictIds) === JSON.stringify(derived.conflictIds))
    && JSON.stringify(state.sessions) === JSON.stringify(derived.sessions)
    && JSON.stringify(state.resolutions) === JSON.stringify(derived.resolutions)
    && state.targetIndex === derived.targetIndex && state.stage === derived.stage && state.choiceId === derived.choiceId
    && state.terminal === derived.terminal
    && state.gradedTargets === derived.gradedTargets && state.masteredTargets === derived.masteredTargets
    && state.technicalTargets === derived.technicalTargets && state.ungradedTargets === derived.ungradedTargets;
}

export type DailyPronunciationGameEvent =
  | { type: "listen"; targetIndex: number }
  | { type: "choose"; targetIndex: number; choiceId: string }
  | { type: "attempt"; event: DailyPronunciationAttemptEvent }
  | { type: "resolve"; targetIndex: number; resolution: DailyPronunciationResolution };

export function advanceDailyPronunciationGame(state: DailyPronunciationGameState, event: DailyPronunciationGameEvent): DailyPronunciationGameState {
  if (!isDailyPronunciationGameState(state)) throw new TypeError("Invalid daily pronunciation game state");
  if (state.terminal) return state;
  if (state.sequence >= MAX_DAILY_PRONUNCIATION_SEQUENCE) throw new Error("Pronunciation sequence limit reached");
  if (event.type === "attempt") {
    if (event.event.targetIndex !== state.targetIndex) throw new Error("Stale pronunciation target transition");
    if (state.game === "beat-the-twin" && state.stage !== "choice-made") throw new Error("Choose the heard word before speaking");
    if (!isDailyPronunciationAttemptEvent(event.event)) throw new TypeError("Invalid pronunciation attempt event");
    if ((state.conflictIds ?? []).includes(event.event.id)) return state;
    const existing = [...state.attemptEvents, ...(state.overflowEvents ?? [])].find((candidate) => candidate.id === event.event.id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(event.event)) throw new Error("Conflicting pronunciation attempt UUID");
      return state;
    }
    return deriveState({ ...state, sequence: state.sequence + 1, attemptEvents: [...state.attemptEvents, event.event] });
  }
  if (event.targetIndex !== state.targetIndex) throw new Error("Stale pronunciation target transition");
  if (event.type === "listen") {
    if (state.game !== "beat-the-twin") throw new Error("Listening choices only belong to Beat the Twin");
    return state.stage === "ready" ? { ...state, stage: "listened", sequence: state.sequence + 1 } : state;
  }
  if (event.type === "choose") {
    if (state.game !== "beat-the-twin" || state.stage !== "listened") throw new Error("Listen successfully before choosing");
    if (!event.choiceId.trim()) throw new TypeError("A listening choice is required");
    return { ...state, stage: "choice-made", choiceId: event.choiceId, sequence: state.sequence + 1 };
  }
  if (state.game === "beat-the-twin" && state.stage !== "choice-made") throw new Error("Choose the heard word before speaking");
  const targetEvents = state.attemptEvents.filter((candidate) => candidate.targetIndex === state.targetIndex);
  if (!validResolution(event.resolution, targetEvents)) throw new Error("Pronunciation resolution lacks matching target evidence");
  const resolutions = [...state.resolutions] as DailyPronunciationGameState["resolutions"];
  resolutions[state.targetIndex] = event.resolution;
  return deriveState({ ...state, sequence: state.sequence + 1, resolutions, stage: "ready", choiceId: undefined });
}

const RESOLUTION_RANK: Record<Exclude<DailyPronunciationResolution, null>, number> = {
  ungraded: 1, technical: 2, "graded-practiced": 3, "graded-mastered": 4,
};

export function mergeDailyPronunciationGameStates(left: DailyPronunciationGameState, right: DailyPronunciationGameState): DailyPronunciationGameState {
  if (!isDailyPronunciationGameState(left) || !isDailyPronunciationGameState(right) || left.contentHash !== right.contentHash || left.game !== right.game) {
    throw new Error("Cannot merge incompatible pronunciation game states");
  }
  const reduced = reduceDailyPronunciationEvents(
    [...left.attemptEvents, ...(left.overflowEvents ?? []), ...right.attemptEvents, ...(right.overflowEvents ?? [])],
    [...(left.conflictIds ?? []), ...(right.conflictIds ?? [])],
  );
  const attemptEvents = reduced.events;
  const resolutions = [0, 1, 2].map((index) => {
    const events = attemptEvents.filter((event) => event.targetIndex === index);
    const candidates = [left.resolutions[index], right.resolutions[index]].filter((entry): entry is DailyPronunciationResolution => entry !== null);
    if (candidates.length === 0) return null;
    if (events.some((event) => event.outcome === "mastered")) return "graded-mastered";
    if (events.length === 3 && events.every((event) => event.outcome === "retry")) return "graded-practiced";
    return candidates.sort((a, b) => RESOLUTION_RANK[b] - RESOLUTION_RANK[a] || compareText(a, b))[0];
  }) as DailyPronunciationGameState["resolutions"];
  const stageRank = (stage: DailyPronunciationStage) => ({ ready: 0, listened: 1, "choice-made": 2 })[stage];
  const terminal = resolutions.every((resolution) => resolution !== null);
  const targetIndex = terminal ? 2 : resolutions.findIndex((resolution) => resolution === null);
  const interaction = [left, right]
    .filter((candidate) => candidate.targetIndex === targetIndex)
    .sort((first, second) => stageRank(second.stage) - stageRank(first.stage)
      || compareText(first.choiceId ?? "", second.choiceId ?? ""))[0];
  const stage = left.game === "beat-the-twin" && !terminal ? interaction?.stage ?? "ready" : "ready";
  const choiceId = stage === "choice-made" ? interaction?.choiceId : undefined;
  return deriveState({
    ...(left.sequence >= right.sequence ? left : right),
    sequence: Math.max(left.sequence, right.sequence),
    targetIndex,
    attemptEvents,
    overflowEvents: reduced.overflowEvents,
    conflictIds: reduced.conflictIds,
    resolutions,
    stage,
    ...(choiceId ? { choiceId } : { choiceId: undefined }),
  });
}
