import Dexie, { type Table } from "dexie";
import type { DailySession } from "../daily-session";
import type { AnalyticsEvent, Attempt, CallScore, ConvItem, DailyQuestState, ExamAttempt, ItemProgress, Lesson, PhraseRecording, PlayerStats, Settings, TalkSession } from "./types";
import type { OutboxRow } from "./types";

/**
 * Local-first storage via IndexedDB. This is the ONLY file that knows we use
 * Dexie. The repository (see ./repository.ts) is the public surface every
 * component talks to, so swapping in Supabase later means writing a new
 * repository — not touching components.
 *
 * Storage is ACCOUNT-SCOPED (audit P1: cross-account bleed). Each signed-in
 * account gets its own database (`clara-u-<userId>`); the original shared
 * database (`clara`) remains the store for authless local mode and as the
 * legacy home of pre-scoping data. `bindLocalDb` switches the active database
 * when the signed-in account changes — sign-out cleanup is NOT the isolation
 * mechanism, separate databases are. Components must re-mount after a rebind
 * (DataScope keys the tree) so live queries re-subscribe to the new database.
 */
export class ClaraDB extends Dexie {
  attempts!: Table<Attempt, number>;
  progress!: Table<ItemProgress, string>;
  customLessons!: Table<Lesson, string>;
  settings!: Table<Settings, string>;
  player!: Table<PlayerStats, string>;
  convItems!: Table<ConvItem, string>;
  quests!: Table<DailyQuestState, string>;
  recordings!: Table<PhraseRecording, string>;
  events!: Table<AnalyticsEvent, number>;
  examAttempts!: Table<ExamAttempt, number>;
  callScores!: Table<CallScore, number>;
  talkSessions!: Table<TalkSession, number>;
  outbox!: Table<OutboxRow, number>;
  dailySessions!: Table<DailySession, string>;

  constructor(name = "clara") {
    super(name);
    this.version(1).stores({
      // Indexes chosen for the queries we actually run: history by item/category,
      // due items for SRS, etc.
      attempts: "++id, itemId, lessonId, categoryId, phoneme, at, passed",
      progress: "itemId, lessonId, categoryId, phoneme, dueAt, box",
      customLessons: "id, order",
      settings: "id",
    });
    // v2 adds the player progression store (XP, streaks, achievements).
    this.version(2).stores({
      player: "id",
    });
    // v3 adds the learning-loop stores: phrases mined from live conversations
    // (they feed the review deck) and per-day quest progress.
    this.version(3).stores({
      convItems: "id, createdAt",
      quests: "day",
    });
    // v4 adds her voice journal: first + best recording per phrase, kept
    // strictly on-device (never synced) so she can hear herself improve.
    this.version(4).stores({
      recordings: "itemId, bestAt",
    });
    // v5 adds a lightweight analytics event log (engagement signals not already
    // captured by attempts): opens, mode taps, lesson start/abandon. Local-first;
    // best-effort mirrored to the cloud per user.
    this.version(5).stores({
      events: "++id, type, at, day",
    });
    // v6 adds stage-exam attempts. These are what make a CEFR band earned rather
    // than self-reported: one row per sitting, keyed by day so the one-per-day
    // rule has something to check.
    this.version(6).stores({
      examAttempts: "++id, day, at, level",
    });
    // v7 adds completed call-simulator runs, so job-path practice is measurable
    // and can be counted on her report.
    this.version(7).stores({
      callScores: "++id, at, scenarioId",
    });
    // v8 adds /talk session records, so the ten-minute conversation milestone is
    // measured from real sessions instead of asserted.
    this.version(8).stores({
      talkSessions: "++id, at",
    });
    // v9 adds the sync outbox: one-shot history rows (attempts, exam sittings,
    // call runs, talk sessions) whose cloud insert failed, kept until a replay
    // succeeds so a transient failure can never orphan completed work.
    this.version(9).stores({
      outbox: "++id, kind, at",
    });
    // v10 adds the resumable daily classroom loop. Existing stores and rows are
    // untouched; one account-scoped row is kept per local day.
    this.version(10).stores({
      dailySessions: "id, day, updatedAt, completedAt",
    });
  }
}

/** Database name for an account. Null = authless local mode (legacy name). */
export function dbNameFor(accountId: string | null): string {
  const id = accountId?.trim().toLowerCase();
  return id ? `clara-u-${id}` : "clara";
}

/**
 * May the legacy shared database be claimed (copied) into this account's
 * database? Only when the legacy data already belongs to this account
 * (ProfileBinder bound it before scoping existed), or when it was written
 * before any account ever touched this device (profileId never set) — the
 * original single-student upgrade path. Data bound to a DIFFERENT account is
 * never claimed: that is exactly the bleed this file exists to prevent.
 */
export function shouldClaimLegacy(legacyProfileId: string | null | undefined, accountId: string): boolean {
  const bound = legacyProfileId?.trim().toLowerCase();
  return !bound || bound === accountId.trim().toLowerCase();
}

// Guard against multiple instances during Next.js hot-reload.
const globalForDb = globalThis as unknown as { __claraDb?: ClaraDB; __claraDbAccount?: string | null };

if (typeof window !== "undefined" && !globalForDb.__claraDb) {
  globalForDb.__claraDb = new ClaraDB(dbNameFor(null));
  globalForDb.__claraDbAccount = null;
}

/**
 * The active database. A delegating proxy rather than a rebindable module
 * export: `bindLocalDb` swaps the underlying instance on account switch, and
 * a proxy keeps every existing `db.table…` call site pointing at the CURRENT
 * account's database regardless of bundler import-binding semantics (tsx/esbuild
 * CJS interop snapshots `export let` values, which silently reintroduced the
 * cross-account bleed in tests). Server-side it stays undefined-behaving, as
 * before: guard with `typeof window`.
 */
export const db: ClaraDB = new Proxy({} as ClaraDB, {
  get(_t, prop) {
    const cur = globalForDb.__claraDb;
    if (!cur) return undefined;
    const v = cur[prop as keyof ClaraDB];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(cur) : v;
  },
  has(_t, prop) {
    const cur = globalForDb.__claraDb;
    return cur ? prop in cur : false;
  },
});

/** The account the local database is currently bound to (null = legacy/local). */
export function boundAccountId(): string | null {
  return globalForDb.__claraDbAccount ?? null;
}

const LEGACY_TABLES = [
  "attempts", "progress", "customLessons", "settings", "player", "convItems",
  "quests", "recordings", "events", "examAttempts", "callScores", "talkSessions",
  "outbox", "dailySessions",
] as const;

/** An account database with no settings row and no history is considered new. */
async function isEmpty(target: ClaraDB): Promise<boolean> {
  const [settings, progress, attempts] = await Promise.all([
    target.settings.count(),
    target.progress.count(),
    target.attempts.count(),
  ]);
  return settings === 0 && progress === 0 && attempts === 0;
}

/**
 * One-time copy of the pre-scoping shared database into an account database.
 * The legacy database is left intact (nothing is deleted without an explicit
 * migration decision); auto-increment ids are re-assigned on copy, which is
 * safe because nothing references attempt/event row ids across tables.
 */
async function claimLegacyInto(target: ClaraDB, accountId: string): Promise<void> {
  const legacyExists = await Dexie.exists(dbNameFor(null));
  if (!legacyExists) return;
  const legacy = new ClaraDB(dbNameFor(null));
  try {
    const legacySettings = await legacy.settings.get("app");
    if (!shouldClaimLegacy(legacySettings?.profileId ?? null, accountId)) return;
    if (!legacySettings && (await isEmpty(legacy))) return; // nothing to claim
    for (const name of LEGACY_TABLES) {
      const rows = await legacy.table(name).toArray();
      if (!rows.length) continue;
      if (name === "attempts" || name === "events" || name === "examAttempts" || name === "callScores" || name === "talkSessions" || name === "outbox") {
        // Auto-increment keys: strip ids so the target assigns fresh ones.
        await target.table(name).bulkAdd(rows.map((r) => { const { id: _id, ...rest } = r as { id?: number }; return rest; }));
      } else {
        await target.table(name).bulkPut(rows);
      }
    }
    // The claimed settings row now describes this account.
    const claimed = await target.settings.get("app");
    if (claimed) await target.settings.put({ ...claimed, profileId: accountId });
  } finally {
    legacy.close();
  }
}

/**
 * Point the local data layer at an account (or back at local mode). Must
 * complete before anything reads `db` for that account — DataScope gates the
 * React tree on it. Idempotent; re-binding the same account is a no-op.
 */
export async function bindLocalDb(accountId: string | null): Promise<void> {
  if (typeof window === "undefined") return;
  const id = accountId?.trim().toLowerCase() || null;
  const name = dbNameFor(id);
  if (globalForDb.__claraDb?.name === name) {
    globalForDb.__claraDbAccount = id;
    return;
  }
  const next = new ClaraDB(name);
  if (id && (await isEmpty(next))) {
    await claimLegacyInto(next, id).catch((e) => {
      // A failed claim must not block login — the account simply starts from
      // its cloud copy (ProfileBinder restores it). Legacy data stays put.
      console.error("[db] legacy claim failed", e instanceof Error ? e.message : e);
    });
  }
  const prev = globalForDb.__claraDb;
  globalForDb.__claraDb = next;
  globalForDb.__claraDbAccount = id;
  // Close after the swap so nothing new lands in the old handle; in-flight
  // live queries on the old instance error and re-subscribe on remount.
  if (prev && prev.name !== name) prev.close();
}
