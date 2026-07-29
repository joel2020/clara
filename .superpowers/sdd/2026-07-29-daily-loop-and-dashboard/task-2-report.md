# Task 2 Report: Local persistence, conflict merge, and cloud migration

## Status

Implemented and committed.

Implementation commit: `5996825fb47d5e4b4c5577bd95dc7df6566d6707`

## Files changed

- `lib/db/dexie.ts`
  - Added the account-scoped `dailySessions` table.
  - Appended Dexie schema version 10 with exactly `dailySessions: "id, day, updatedAt, completedAt"`.
  - Added the new table to the non-destructive legacy claim/copy list.
- `lib/db/repository.ts`
  - Added `getDailySession(day)` and `saveDailySession(session)` to `DataRepository`.
- `lib/db/dexie-repository.ts`
  - Implemented local daily-session reads and awaited writes.
  - Rejects a session attributed to a profile other than the currently bound account.
  - Starts the durable cloud mirror only after the local write succeeds.
  - Includes daily sessions in the existing explicit learner reset operation.
- `lib/db/index.ts`
  - Added explicit `.ts` import/export suffixes so the required bare-Node focused test can load the real repository.
- `lib/db/types.ts`
  - Added `"daily-session"` to `OutboxRow.kind`.
- `lib/daily-session-store.ts`
  - Added the public daily-session store and conflict policy.
- `lib/daily-session-store.test.mjs`
  - Added merge, checkpoint durability, account isolation/attribution, retry, cloud upsert, and pull/merge coverage.
- `lib/sync/supabase-sync.ts`
  - Added durable `daily_sessions` row construction, upsert, replay, and current-day pull.
- `lib/sync/outbox.ts`
  - Uses the expanded durable kind and explicit relative imports needed by the focused bare-Node integration test.
- `lib/sync/schema.test.mjs`
  - Added daily-session columns, row-builder validation, and migration/RLS checks.
- `lib/sync/coverage.test.mjs`
  - Added the new Dexie store, pusher, caller, and pull path to sync coverage.
- `supabase/daily_sessions.sql`
  - Added the required table, authenticated-user foreign key, primary key, RLS enablement, and own-row policy.

## Interfaces

### Consumed

- `DailySession`, `DailyActivity`, and `ActivityStatus` from `lib/daily-session.ts`.
- The currently bound account-scoped Dexie database through `DataRepository`.
- The existing Supabase client and durable outbox registration/replay pattern.

### Produced

- `getDailySession(day: string): Promise<DailySession | undefined>`
  - Reads the bound account's local row.
  - When cloud sync is available, pulls only that profile/day, merges it with local state, and saves the merged row locally before returning.
  - Falls back to the local row when cloud sync is disabled or unavailable.
- `saveDailySession(session: DailySession): Promise<DailySession>`
  - Rejects cross-account attribution.
  - Merges with the existing local row so stale callers cannot regress terminal evidence or reward claims.
  - Awaits the IndexedDB write before returning.
- `checkpointActivity(input: ActivityCheckpoint): Promise<DailySession>`
  - Input: `{ day, activityId, status: "completed" | "technical-skip", at }`.
  - Sets one activity terminal, preserves any existing completion, advances `currentActivityId`, stamps start/session completion times, and awaits persistence.
- `mergeDailySessions(local, remote): DailySession`
  - Rejects different profile/day/id pairs.
  - Uses the newer copy for ordinary session/activity content.
  - Applies monotonic activity status precedence: `completed` > `technical-skip` > `active` > `pending`.
  - OR-merges `rewardClaimed`, preserves the earliest start/create time, and retains terminal evidence.
- `pushDailySession(profileId, session)`
  - Durable upsert on `profile_id,day`; failed writes enqueue `"daily-session"` for retry.
- `pullDailySession(profileId, day)`
  - Selects exactly the requested authenticated profile/day and rejects payload attribution/version mismatches.

## Migration and data-safety decisions

- Dexie v10 is additive. No earlier version declaration, existing store schema, or learner row is reset or rewritten.
- The new table is account-scoped by the existing separate-database binding (`clara-u-<account>`).
- Legacy local-mode daily sessions participate in the existing guarded copy migration. The source legacy database remains intact, and the existing `shouldClaimLegacy` profile check still prevents a different account from claiming it.
- Local persistence always precedes the fire-and-forget cloud mirror.
- Both the public store and repository boundary reject stale writes attributed to another bound account.
- Conflict resolution is monotonic for learner evidence and reward claims; a newer pending/active copy cannot undo an older completion.
- Cloud replay retains the original `profileId` in the account-scoped outbox, and RLS independently restricts rows to `auth.uid()`.
- The SQL payload contains only the `DailySession` domain object. It contains no Blob, raw audio, base64 audio, transcript recording, or recording reference.
- `daily_sessions` keys on `(profile_id, day)` and the client uses the same `onConflict` target.
- Pulls select only the requested day, merge with local evidence, then save locally.
- The only deletion behavior added is clearing `dailySessions` inside the pre-existing explicit learner reset action.

## TDD evidence

### RED

1. `node lib/daily-session-store.test.mjs`
   - Exit 1.
   - Expected failure: `ERR_MODULE_NOT_FOUND` for the not-yet-created `lib/daily-session-store.ts`.
2. `node lib/daily-session-store.test.mjs`
   - Exit 1 after the first merge implementation.
   - Expected failure: missing `checkpointActivity` export, proving the persistence/checkpoint API was not yet implemented.
3. `node lib/daily-session-store.test.mjs && node lib/sync/schema.test.mjs && node lib/sync/coverage.test.mjs`
   - Exit 1.
   - Expected daily cloud failures: replay targeted no `daily_sessions` endpoint, and current-day cloud state was not pulled/merged.
4. `node lib/daily-session-store.test.mjs`
   - Exit 1 during self-review.
   - Regression test caught older completed activity content replacing newer activity content while completion evidence was preserved.

### GREEN / final focused verification

Command:

```bash
node lib/daily-session-store.test.mjs && node lib/sync/schema.test.mjs && node lib/sync/coverage.test.mjs
```

Result: exit 0.

- Daily session store: 6 tests passed, 0 failed.
- Schema: 126 checks passed, 0 failed.
- Sync coverage: 44 checks passed, 0 failed.
- Node emitted the repository's existing `MODULE_TYPELESS_PACKAGE_JSON` warning for direct `.ts` loading; it did not affect the result.

## Additional verification

Command:

```bash
npm run typecheck
```

Result: exit 0; `tsc --noEmit` reported no errors.

Command:

```bash
npm test
```

Result: exit 0; 28 test files, 21,392 checks, 0 failing files.

Command:

```bash
npm run lint:ratchet
```

Result: exit 0; 0 errors against a baseline of 0.

Command:

```bash
git diff --check
```

Result: exit 0; no whitespace errors.

## Self-review

- Verified every Task 2 checklist item against the final diff.
- Verified the exact v10 schema string and that versions 1–9 were not altered.
- Verified local write ordering: repository `put` is awaited before cloud mirroring begins.
- Verified account attribution at both store and repository boundaries and in the actual generated Supabase REST payload.
- Verified outbox failure keeps the row, increments `tries`, and later success removes it.
- Verified pull URL includes only `day=eq.2026-07-29` in the integration test.
- Verified completed evidence, technical-skip precedence, reward claims, activity advancement, and local persistence.
- Added and passed a regression test after finding that the first merge implementation could preserve older activity content along with older completion evidence.
- Searched the new storage, sync, and SQL paths for audio/recording fields; none are present.
- Confirmed the worktree contained only Task 2 changes before the implementation commit.

## Concerns

- `supabase/daily_sessions.sql` is committed but was not applied to a live Supabase project in this task. Cloud writes will remain queued/fail until that migration is deployed.
- The required bare-Node test emits Node's existing typeless-package warning when importing TypeScript; the focused and full suites still exit cleanly.
- The required SQL policy statement is intended as a one-time migration. Re-running it after the policy already exists would require dropping the policy first.
