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
- Resolved in Fix round 1/5: the migration now drops the existing policy before recreating it, so policy setup is rerunnable.

## Fix round 1/5

### Findings addressed

1. Replaced last-writer-wins cloud table upserts with the authenticated
   `merge_daily_session` RPC. Both live pushes and outbox replay now cross the
   same atomic server boundary.
2. Moved local read/merge/put into one Dexie read-write transaction. Concurrent
   checkpoint callers can no longer read the same base row and erase one
   another's activity completion.
3. Re-keyed and re-attributed valid legacy daily-session rows and daily-session
   outbox payloads during account claim. Malformed rows are excluded. An
   originally unbound legacy settings row is pinned to the first successful
   claiming account so later accounts cannot claim the preserved legacy data.

Fix implementation commit:
`e77e466130331b9a65d40f47811848d98d16157d`

### Covering tests

- `concurrent checkpoints preserve disjoint activity completions`
  - Runs two real `checkpointActivity` calls concurrently against
    fake-indexeddb.
  - Proves both activity completions and the terminal session pointer survive.
- `stale disjoint cloud writes merge monotonically through the RPC boundary`
  - Sends a newer completion and an older disjoint completion/reward claim
    through the actual Supabase client RPC boundary.
  - Proves both terminal activities and `rewardClaimed: true` survive and that
    neither live/replay path calls a direct table upsert.
- Account-scope checks:
  - `unbound legacy daily session is re-keyed and attributed to A`
  - `stale legacy daily-session id is not copied`
  - `claimed daily-session retry is attributed to A`
  - `claimed retry payload is re-attributed to A`
  - `malformed legacy daily sessions are excluded`
  - `malformed daily-session retries are excluded`
- Schema/RPC checks cover:
  - authenticated ownership derived from `auth.uid()`;
  - `FOR UPDATE` row locking;
  - full-join reconciliation of disjoint activity IDs;
  - `completed > technical-skip > active > pending` precedence;
  - monotonic reward claims;
  - both client write paths using the RPC;
  - absence of direct `daily_sessions` upserts.

### TDD evidence

Command:

```bash
node lib/daily-session-store.test.mjs; npx tsx lib/db/scope.test.mjs
```

Initial result: both exited 1.

- Concurrent checkpoints lost the `speak` completion.
- Cloud requests did not target `/rest/v1/rpc/merge_daily_session`.
- Legacy claim retained the stale daily-session ID/profile in both the stored
  row and outbox payload.

Command:

```bash
npx tsx lib/db/scope.test.mjs
```

Second RED result after valid-row re-attribution: exit 1; the two new malformed
row checks failed because incompatible sessions and retries were still copied.

### Final focused verification

Command:

```bash
node lib/daily-session-store.test.mjs && npx tsx lib/db/scope.test.mjs && node lib/sync/schema.test.mjs && node lib/sync/coverage.test.mjs
```

Result: exit 0.

- Daily-session store: 7 tests passed, 0 failed.
- Account scope/legacy claim: 30 checks passed, 0 failed.
- Schema/RPC: 128 checks passed, 0 failed.
- Sync coverage: 44 checks passed, 0 failed.

Command:

```bash
npm run typecheck
```

Result: exit 0; `tsc --noEmit` reported no errors.

Command:

```bash
npm test
```

Result: exit 0; 28 test files, 21,400 checks, 0 failing files.

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

### Migration behavior

- `daily_sessions.sql` now drops/recreates its RLS policy safely on rerun.
- `merge_daily_session` is `SECURITY INVOKER`, derives `profile_id` only from
  `auth.uid()`, rejects payload attribution/version mismatches, and grants
  execution only to `authenticated`.
- First writes use `INSERT ... ON CONFLICT DO NOTHING`; existing or competing
  writes then lock `(profile_id, day)` with `SELECT ... FOR UPDATE`.
- Under that lock, the function keeps newer ordinary content while independently
  merging each activity's terminal evidence and OR-merging reward claims.
- An `updated_at` comparison chooses presentation metadata only; it never drops
  a disjoint completion from the older payload.
- Local Dexie storage remains v10 and additive. No existing learner evidence is
  deleted or reset.
- Legacy session rows are copied under `daily:<account>:<day>` with the claimed
  account ID. Valid queued retries receive the same re-attribution; malformed
  daily rows/retries are skipped. Legacy evidence rows remain present in the
  source database, while its previously-null ownership marker is set after the
  first successful claim to prevent cross-account duplicate claims.
- No raw audio is introduced.

### Fix-round self-review

- Confirmed the local transaction returns and mirrors the merged durable row,
  not the caller's stale input.
- Confirmed concurrent local commits can arrive at the cloud in either order;
  both are safe because direct and replay writes use the server merge function.
- Confirmed the RPC accepts no caller-supplied `profile_id` argument.
- Confirmed a stale outbox retry cannot regress a newer activity or claimed
  reward.
- Confirmed RLS remains enabled and the function runs with invoker privileges.
- Confirmed malformed legacy daily payloads cannot be re-keyed into syntactically
  valid account rows.

### Fix-round concerns

- The updated `supabase/daily_sessions.sql` migration has not been applied to the
  live Supabase project in this task. Until deployed, the client RPC will fail
  and durable writes will remain queued.
- No local PostgreSQL/Supabase runtime is present in the worktree, so the
  PL/pgSQL function was reviewed and schema-checked but not executed against a
  real database here. The client RPC boundary and monotonic stale/disjoint
  behavior are covered with the existing HTTP-level Supabase test harness.
- The required bare-Node test continues to emit Node's pre-existing
  typeless-package warning when importing TypeScript.
