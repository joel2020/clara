# SDD ledger — plan: docs/superpowers/plans/2026-07-29-daily-loop-and-dashboard.md

Merge base: 1d748c6

Task 1: fix round 1/5 (1 addressed, 0 open — fatigue magnitude now affects ranking; commits fd52247..d1b5fcd)
Task 1: complete (commits 1d748c6..d1b5fcd, review clean)
Task 2: minor (deferred): daily_sessions RLS policy creation is not rerun-safe.
Task 2: minor (deferred): equal terminal activity merges can discard an existing completedAt timestamp.
Task 2: fix round 1/5 (3 addressed, 1 open — older-only pending SQL activity can serialize null status; commits 4006362..98c0fa4)
Task 2: minor (deferred): cloud merge behavior is schema/string and HTTP-boundary tested but not executed against a local PostgreSQL runtime.
Task 2: minor (deferred): claimable legacy-session validation intentionally checks a narrow safe shape, not every DailySession field.
Task 2: fix round 2/5 (1 addressed in implementation, 1 open — focused test asserts SQL substrings rather than executing older-only pending behavior; commits 98c0fa4..5b141f9)
Task 2: fix round 3/5 (1 addressed, 0 open — executable mutation-discriminating SQL logic fixture; commits 5b141f9..8fad1eb)
Task 2: deferred minor resolved during fix round 1 — RLS migration is rerun-safe.
Task 2: deferred minor resolved during fix round 1 — equal terminal merges preserve completion evidence.
Task 2: complete (commits d1b5fcd..8fad1eb, review clean)
Task 3: review open — atomic persisted reward claim, concurrent player merge, midnight safety, and orchestration durability coverage.
Task 3: fix round 1/5 (3 addressed, 1 open — unrolled prior-day player retains stale today counters; commits 6aec06e..2160197)
Task 3: fix round 2/5 (1 addressed, 0 open — older-session claims roll stale daily counters without replacing current-day counters; commits 2160197..744dc4c)
Task 3: complete (commits 8fad1eb..744dc4c, review clean)
Claude review: Tasks 1–3 pass with no blocking defects.
Claude review minor (deferred): migration logic is not yet executed against a real PostgreSQL runtime.
Claude review minor (deferred): pre-existing player_stats whole-row sync remains last-write-wins across simultaneous devices.
Task 4: minor (deferred to Task 5): dashboard session card precedes conversion of legacy /today consumer.
Task 4: minor (deferred): progress meter lacks progressbar value semantics.
Task 4: minor (deferred): pending activities use completed check icons.
Task 4: minor (deferred): TodaySessionCard contains a dead current-activity conditional.
Task 4: complete (commits 744dc4c..04fc97e, Claude review approved)
Task 5: Task 4 deferred findings resolved — progressbar semantics, pending-activity icons, dead conditional, /today converted to session runner.
Task 5: fix round 1/5 (4 addressed from review: unhandled technical-skip rejection, hardcoded Loading fallbacks, session exit-link labels, pre-claim +0 reward panel; 0 blocking open)
Task 5: minor (deferred): failed completed-checkpoint recovery retries the activity instead of the save; failed start() can require a second Start press.
Task 5: minor (deferred): completion "improved" row is always neutral copy; positive improvement evidence is never derived.
Task 5: minor (deferred): /talk mid-conversation API failures lack a session technical-exit link.
Task 5: minor (deferred): state swaps do not move focus to the new content heading.
Task 5: minor (pre-existing, for whole-plan review): shadow-round renders a failed flash for non-consent technical recognition errors.
Task 5: complete (commits 04fc97e..f8014b4, Claude review: no blocking findings; full gate green: typecheck, lint 0 errors, ratchet 0, 21451 checks, build, diff --check)
Whole-plan review: no blocking findings; plan delivered and safe to build the character and release plans on.
Whole-plan fix round (commit 2a7cac6): shadow-round technical recognition errors now show a neutral notice instead of the miss badge; activity returns carry sessionDay so a post-midnight return cannot credit the new session; checkpointActivity writes locally without a blocking cloud pull.
Whole-plan review minor (deferred): TS/SQL completedAt tie-break asymmetry (unreachable divergence, informational).
Whole-plan review minor (deferred to insights plan): evidenced-improvement derivation, player_stats whole-row LWW, real-PostgreSQL migration execution, visible sync queue, comeback session.
