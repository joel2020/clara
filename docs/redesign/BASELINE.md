# Redesign branch baseline — redesign/premium-ui

Recorded: 2026-07-28
Branched from: `main` @ `1cbdb31` ("Docs: record what production readiness actually means here")
Worktree: `/Users/joel/clara/.worktrees/premium-ui`

## Verification results at branch point

| Check | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | PASS — 0 errors |
| Lint ratchet | `npm run lint:ratchet` | PASS — 0 errors, baseline 0 |
| Unit tests | `npm test` | PASS — 16 files, 440 checks, 0 failing |
| Production build | `next build` | PASS — 35 routes compiled |

No pre-existing failures. Any regression on this branch is attributable to this branch.

## Parallel-work context

- Phase 0 remediation worktree: `/Users/joel/clara/.claude/worktrees/phase0-remediation`
  on branch `worktree-phase0-remediation`, currently at `1cbdb31` with **no commits ahead
  of main and a clean working tree** at the time this branch was cut. File-level conflict
  targets are therefore unknown; the integration log records *expected* conflict surfaces
  based on Phase 0's stated scope (auth, privacy, Dexie, sync, storage, RLS, API routes,
  grading, exams, curriculum, account authorization).
- This branch must not touch those systems. Phase 0 merges first; this branch rebases after.

## Recent history at branch point (for context)

```
1cbdb31 Docs: record what production readiness actually means here
5480d49 DB: hoist auth.uid() out of per-row RLS evaluation, split custom_lessons writes
c802549 Make production misconfiguration visible instead of silent
6c03c3c Lumi: lighten her skin tone to match the student she was made for
1290882 Fix three rendering defects: hydration mismatch, warped character, thin letterforms
28bd0f0 Chore: ignore local worktrees
80c62de Docs: plan Google login open access
024e67d Auth: sign in with Google, alongside email and password
712a6a1 Auth: add a password-reset flow from the login screen
```

Note: auth work (Google login, password reset) landed recently on main and there is a
separate `feature/google-login-open-access` worktree. Login/auth surfaces are explicitly
out of scope for this branch.
