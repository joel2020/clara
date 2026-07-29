# Plan — approval-based enrollment

Supersedes both the open-access spec (`2026-07-27-google-login-open-access.md`) and
the `ALLOWED_EMAILS` student allowlist shipped in Phase 0 commit `d1ee67c`.

Branch: `worktree-phase0-remediation` (continues Phase 0; nothing merged or deployed).

## Policy

Anyone may create an account. Authentication alone grants nothing. Every new user
gets a `pending` enrollment request and a warm waiting screen. Only
`joelcarias23@gmail.com` approves or declines, from inside the coach area.
`alivio.studio.ops@gmail.com` becomes an ordinary student.

## Inspection findings (what has to change)

The allowlist surface is small — four code files:

| Location | Today | Becomes |
|---|---|---|
| `lib/allowlist.ts` | `ALLOWED_EMAILS` + `isAllowed`, `ADMIN_EMAILS` + `isAdmin` | admin only; student functions deleted |
| `lib/auth-server.ts:58` | `requireUser` → 403 `not_allowed` on allowlist miss | `requireApproved` → DB enrollment truth |
| `app/api/me/route.ts` | `{authed, allowed, admin}` | `EnrollmentState` |
| `components/auth-gate.tsx:87` | binary allowed/denied screen | 8 explicit states |

Plus 8 paid routes calling `requireUser` (`assess`, `call-score`, `chat`, `grade`,
`news`, `push`, `transcribe`, `tts`), `app/api/coach` + `app/api/health` on `isAdmin`,
and `lib/hooks/useAccess.tsx` as the single client seam (already distinguishes
check-failure from denial — that Phase 0 property is preserved, not rebuilt).

**No location assumes open access.** The open-access branch
(`feature/google-login-open-access`) is unmerged and stays unmerged.

**Parallel UI conflict surface:** `docs/redesign/PHASE-0-INTEGRATION-LOG.md` declares
`lib/auth-*`, `lib/allowlist.ts`, `app/api/**`, `components/auth-gate.tsx`,
`components/profile-binder.tsx` off-limits to `redesign/premium-ui`. Overlap is
therefore nil — **except** `components/mobile-nav.tsx` and `components/site-header.tsx`,
which premium-ui does own. The pending badge goes on the **coach entry and coach page**
(`components/instructor-entry.tsx`, `app/coach/page.tsx`), which premium-ui does not
touch, so no nav file is edited.

## Data model

`public.enrollment_requests`, one row per `auth.users.id` (PK = FK, cascade delete).
Status `pending | approved | declined` (CHECK-constrained). `decided_by` + `decided_at`
+ optional private `decision_note` make decisions attributable. PK on `user_id` makes
duplicate requests structurally impossible, which covers simultaneous tabs and repeated
OAuth callbacks without application locking.

Email/display_name/provider are personal data: server-side only, never in client
bundles, migrations, fixtures, or docs.

## Creating requests — trigger, plus a repair path

`handle_new_auth_user()` (SECURITY DEFINER) on `auth.users AFTER INSERT` inserts
`pending` with `ON CONFLICT DO NOTHING`, reading email/name/provider from the NEW row
— never from a client. Wrapped in an exception handler so a failure can never break
signup.

Because a broken trigger would strand users invisibly, `/api/me` also **ensures** the
row idempotently on read (`ON CONFLICT DO NOTHING`, never resetting a decided status).
Belt and braces: either path alone is sufficient; together no user can exist without a
record.

## Existing-user migration

Two auth users exist in production. Both have bound `profiles` rows; one has 397
attempts and 9,108 XP (the active learner), the other is the owner. There are no test
or unknown accounts, so the data distinguishes cleanly and no private list is needed.

Rule: approve every `auth.users` row that has a `public.profiles` row **created before
an explicit cutoff timestamp**, recorded in the migration. Not "has a profile" alone —
that would auto-approve future accounts. Idempotent (`ON CONFLICT DO NOTHING` + status
guard). Never consults IndexedDB. Verification query documented in the migration and
the deployment checklist.

## Server authorization

One guard, not per-route logic. `requireApproved(request)` in `lib/auth-server.ts`:

| Condition | Response |
|---|---|
| no/invalid session | `401 unauthorized` |
| enrollment `pending` | `403 enrollment_pending` |
| enrollment `declined` | `403 enrollment_declined` |
| lookup/config failure | `503 enrollment_unavailable` |
| approved | proceed |

Read per request against the database — never from a client-supplied flag. Uses a
narrow service-role client confined to server code.

## Client states

`useAccess` gains `enrollment`; `AuthGate` renders: auth-loading, signed-out,
enrollment-loading, **lookup-failed** (retry + sign out — the Phase 0 fix, kept
verbatim), **pending**, **declined**, approved, admin.

Pending and declined screens are bilingual, warm, and explicitly not errors. Pending
tells her the account exists, Joel must approve, she need not sign up again, and offers
Retry + Sign out.

## Admin surface

`/api/admin/enrollments` (GET list) and `POST` approve/decline — session validated,
`isAdmin` enforced server-side, input validated, idempotent, rate-limited, stable error
codes, acting admin taken from the session and never the body. Coach area gains a
pending-first list with deliberate Approve/Decline, disabled-while-saving, and rows that
survive a failed mutation. Declined can be re-approved.

## RLS

`enrollment_requests`: authenticated may `SELECT` only `user_id = auth.uid()`; no
client `INSERT`/`UPDATE`/`DELETE`; anon nothing. All admin reads/writes go through the
protected routes on the service role. Existing per-user RLS untouched.

Separately prepared (reviewed, **not executed**): `custom_lessons` write policies drop
`alivio.studio.ops@gmail.com`, leaving only the real administrator.

## Commits

1. enrollment schema + migration + tests
2. server-side enrollment authorization
3. pending/declined/failed application states
4. admin enrollment APIs
5. coach pending-requests interface
6. privacy + documentation
7. RLS migration + final verification

## Out of scope

Email notification, payments, spend caps, UI redesign, and any change to Phase 0's
identity, pronunciation, privacy, consent, isolation, sync, grading, or recovery work.
