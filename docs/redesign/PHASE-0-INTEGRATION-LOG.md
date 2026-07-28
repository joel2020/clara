# Phase 0 integration log — redesign/premium-ui

This branch runs in parallel with the Phase 0 remediation branch
(`worktree-phase0-remediation`). **Phase 0 merges first; this branch rebases onto it.**
Every commit here is logged with its files, rationale, expected conflicts, and rebase
guidance. Conflict resolution rule: **adapt the UI to Phase 0's behavior — never restore
obsolete UI logic, never weaken a security/privacy/identity/data-integrity fix.**

Phase 0's stated scope: privacy, identity leakage (Mariana purge), data integrity
(Dexie/sync), curriculum defects (hints/IPA/content), assessment integrity, error
handling (error boundaries + branded 404). At branch time Phase 0 had **zero commits**
(worktree clean at `1cbdb31`), so expected conflicts below are inferred from that scope,
not from observed diffs. Re-check `git log main..worktree-phase0-remediation` at rebase time.

Files this branch treats as off-limits (Phase 0 territory): `lib/db/**`, `lib/sync/**`,
`lib/srs.ts`, `lib/content/**` (curriculum data), `lib/allowlist.ts`, `lib/auth-*.ts`,
`app/api/**`, `components/auth-gate.tsx`, `components/login-screen.tsx`,
`components/reset-password-screen.tsx`, `components/oauth-callback-screen.tsx`,
`components/profile-binder.tsx`, `app/error.tsx` / `app/global-error.tsx` /
`app/not-found.tsx` (Phase 0 will create these; we provide adoptable primitives),
exam/grading/readiness logic, supabase/**, vercel.json, next.config.ts (production config).

---

## Commits

### 7e7a1d2 — Redesign: record baseline and UI/UX diagnosis
- **Files:** `docs/redesign/BASELINE.md`, `docs/redesign/CLARA-UI-UX-DIAGNOSIS.md` (new)
- **Why:** Step 1/3 deliverables; records green baseline (typecheck 0, ratchet 11/11,
  440 checks, build 35 routes) at branch point `1cbdb31`.
- **Expected conflicts:** none (new files in a directory Phase 0 doesn't use).
- **Rebase decisions:** none.
- **Post-integration checks:** none.
- **Safe to cherry-pick independently:** yes.
