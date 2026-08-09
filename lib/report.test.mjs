// npx tsx lib/report.test.mjs
//
// This is the only artefact that leaves the app and goes to a recruiter, so the
// non-negotiables are: it shows nothing until an exam is passed, it never claims a
// band higher than one she demonstrated, and every number is measured rather than
// estimated.
import { buildReport } from "./report.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a), "want", JSON.stringify(b)); } };

const DAY = 86_400_000;
const att = (at, passed) => ({ itemId: "i", lessonId: "l", categoryId: "c", phoneme: "p", target: "t", heard: "t", score: passed ? 90 : 40, passed, at });
const prog = (itemId, box) => ({ itemId, lessonId: "l", categoryId: "c", phoneme: "p", attempts: 4, passes: 3, box, dueAt: 0, lastResult: "pass", lastScore: 85, updatedAt: 1 });
const exam = (level, passed, at, score = 80) => ({ day: "d", at, level, score, passed, sections: {}, weakest: null });
const call = (at, score) => ({ scenarioId: "double-charge", at, score, checks: {} });

// --- Nothing until an exam is passed ---------------------------------------
const none = buildReport({ attempts: [att(1, true)], progress: [prog("a", 5)], exams: [], calls: [] });
eq(none.ready, false, "no exam means not ready");
eq(none.band, null, "no exam means no band claimed");
eq(none.examScore, null, "no exam means no score");

// A FAILED sitting must not produce a band.
const failedOnly = buildReport({ attempts: [], progress: [], exams: [exam("B1", false, 5)], calls: [] });
eq(failedOnly.ready, false, "a failed sitting does not make a report");
eq(failedOnly.band, null, "a failed sitting claims no band");

// --- The band is what she demonstrated, promoted by exactly one -------------
const passedB1 = buildReport({ attempts: [], progress: [], exams: [exam("B1", true, 10, 82)], calls: [] });
eq(passedB1.ready, true, "a passed sitting makes a report");
eq(passedB1.band, "B2", "passing at B1 certifies B2");
eq(passedB1.examScore, 82, "the passing score is carried");
eq(passedB1.passedAt, 10, "the sitting date is carried");

// With several passes, the highest wins — and a later FAILED attempt at a higher
// level must not inflate it.
const mixed = buildReport({
  attempts: [],
  progress: [],
  exams: [exam("A2", true, 5), exam("B1", true, 10), exam("B2", false, 20)],
  calls: [],
});
eq(mixed.band, "B2", "highest passed sitting wins, failures ignored");

// The ceiling holds.
eq(buildReport({ attempts: [], progress: [], exams: [exam("C2", true, 1)], calls: [] }).band, "C2", "C2 cannot be exceeded");

// --- Every number is measured ---------------------------------------------
const full = buildReport({
  attempts: [att(1 * DAY, true), att(1 * DAY, false), att(2 * DAY, true), att(2 * DAY, true)],
  progress: [prog("a", 5), prog("b", 5), prog("c", 2)],
  exams: [exam("B1", true, 3 * DAY, 78)],
  calls: [call(1, 70), call(2, 90)],
});
eq(full.practiceSessions, 4, "practice sessions counts attempts");
eq(full.activeDays, 2, "active days counts distinct days");
eq(full.accuracy, 75, "accuracy is passes over attempts");
eq(full.phrasesMastered, 2, "only mastered items count");
eq(full.callsCompleted, 2, "calls are counted");
eq(full.callAverage, 80, "call average is the mean");

// No calls yet is null, not a fake zero — zero would read as "scored badly".
eq(full.callsCompleted > 0, true, "sanity");
eq(buildReport({ attempts: [], progress: [], exams: [exam("A1", true, 1)], calls: [] }).callAverage, null, "no calls means null, not 0");

// --- The document id is stable and does not leak the profile id ------------
const a = buildReport({ attempts: [], progress: [], exams: [exam("B1", true, 99)], calls: [], profileId: "mariana-secret" });
const b = buildReport({ attempts: [], progress: [], exams: [exam("B1", true, 99)], calls: [], profileId: "mariana-secret" });
eq(a.id, b.id, "the id is stable for the same inputs");
eq(a.id.includes("mariana"), false, "the id does not contain the profile id");
eq(/^[0-9A-F]{4}-[0-9A-F]{4}$/.test(a.id), true, "the id is a short hex pair");

// Empty everything must not throw or produce NaN.
const empty = buildReport({ attempts: [], progress: [], exams: [], calls: [] });
eq(empty.accuracy, 0, "no attempts is 0 accuracy, not NaN");
eq(empty.activeDays, 0, "no attempts is 0 active days");

// ─── The instructor cockpit aggregation ─────────────────────────────────────
//
// The other artefact built from measured data: the admin-only roster. It is
// exercised through the real route handler against a stubbed Supabase, because
// the rules that matter here are exclusions — a technical failure is never her
// mistake, and a technical-skip is never completed practice — and an exclusion
// is only proved by running the thing.

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://coach-test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

const MARI = "11111111-1111-4111-8111-111111111111";
const TIE = "22222222-2222-4222-8222-222222222222";
const TECH = "33333333-3333-4333-8333-333333333333";
const DROP = "44444444-4444-4444-8444-444444444444";
const LAG = "55555555-5555-4555-8555-555555555555";
const GONE = "66666666-6666-4666-8666-666666666666";
const QUIET = "77777777-7777-4777-8777-777777777777";

const now = Date.now();
const day = (n) => new Date(now - n * 86_400_000).toISOString().slice(0, 10);
const ev = (profileId, type, dayKey, props = {}) => ({ profile_id: profileId, type, at: Date.parse(`${dayKey}T12:00:00Z`), day: dayKey, props });
const done = (ms) => ({ activityKind: "learn", activityStatus: "completed", durationMs: ms });
const attempt = (profileId, phoneme, passed) => ({ profile_id: profileId, category_id: "c1", phoneme, passed, at: now - 1000 });
const item = (profileId, phoneme, attempts, box, due) => ({ profile_id: profileId, category_id: phoneme ? "c1" : "vowels", phoneme, attempts, box, due_at: due ? now - 1000 : now + 86_400_000 });
const stats = (profileId, lastActiveDay) => ({ profile_id: profileId, xp: 100, stars: 3, current_streak: 2, longest_streak: 5, total_attempts: 20, total_passes: 15, last_active_day: lastActiveDay });

let fixtures = {};
const jsonResponse = (rows) => new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input) => {
  const target = typeof input === "string" ? input : input.url;
  if (target.includes("/auth/v1/user")) {
    return jsonResponse({ id: "admin", email: "profe@clara.test", app_metadata: { clara_role: "admin" } });
  }
  const table = /\/rest\/v1\/([a-z_]+)/.exec(target)?.[1] ?? "";
  if (table === "events") return jsonResponse(target.includes("client_error") ? [] : (fixtures.events ?? []));
  return jsonResponse(fixtures[table] ?? []);
};

const { GET } = await import("../app/api/coach/route.ts");
async function coach(next) {
  fixtures = next;
  const res = await GET(new Request("https://clara.test/api/coach", { headers: { authorization: "Bearer admin-token" } }));
  const body = await res.json();
  return { ...body, byId: Object.fromEntries(body.students.map((s) => [s.id, s])) };
}

// --- One learner, one honest week -------------------------------------------
// d1 and today are full sessions. d2 is the day the microphone died: she showed
// up, the app failed, and that day must not count against her anywhere.
const week = await coach({
  profiles: [{ id: MARI, name: "Mariana" }],
  player_stats: [stats(MARI, day(0))],
  settings: [{ profile_id: MARI, onboarding: { level: "B1", path: "job" } }],
  progress: [
    item(MARI, "th", 4, 2, true),
    item(MARI, "sh", 4, 1, true),
    item(MARI, "vv", 10, 5, true), // mastered
    item(MARI, "nn", 0, 0, true), // never attempted
    item(MARI, null, 3, 1, true), // no phoneme: falls back to the category
  ],
  attempts: [
    attempt(MARI, "th", false), attempt(MARI, "th", false), attempt(MARI, "th", false), attempt(MARI, "th", true),
    attempt(MARI, "sh", false), attempt(MARI, "sh", true), attempt(MARI, "sh", true), attempt(MARI, "sh", true),
    attempt(MARI, "ee", true), attempt(MARI, "ee", true), // clean: not a weak area
  ],
  events: [
    ev(MARI, "session_start", day(1)),
    ev(MARI, "activity_complete", day(1), done(240_000)),
    ev(MARI, "activity_complete", day(1), done(20 * 60_000)), // 20 min: capped at 10
    ev(MARI, "speaking_attempted", day(1), { passed: true, score: 80 }),
    ev(MARI, "review_complete", day(1), { dueCount: 10, completedCount: 6 }),
    ev(MARI, "session_complete", day(1)),
    ev(MARI, "session_start", day(0)),
    ev(MARI, "activity_complete", day(0), done(360_000)),
    ev(MARI, "speaking_attempted", day(0), { passed: false, score: 40 }),
    ev(MARI, "session_complete", day(0)),
    // The broken day.
    ev(MARI, "session_start", day(2)),
    ev(MARI, "activity_complete", day(2), { activityKind: "speak", activityStatus: "technical-skip" }),
    ev(MARI, "technical_failure", day(2), { category: "microphone-permission" }),
  ],
});
const mari = week.byId[MARI];

eq(mari.level, "B1", "CEFR level comes from her onboarding profile");
eq(mari.path, "job", "the learning path is carried");
eq(mari.activeToday, true, "practising today reads as active today");
eq(mari.daysSince, 0, "last practice is measured in her local days");
eq(mari.sessions, { startedDays: 2, completedDays: 2, completionRate: 100, practiceMinutes: 20 }, "the technically broken day leaves the completion denominator");
eq(mari.speaking, { attempts: 2, days: 2, participationRate: 100 }, "a technical-skip day is not counted as a day she refused to speak");
eq(mari.review, { dueItems: 3, due: 10, completed: 6, completionRate: 60 }, "review need counts due, unmastered, practised items only");
eq(mari.technical, { failures: 1, categories: [{ category: "microphone-permission", count: 1 }] }, "the failure is reported as ours, by category");
eq(mari.sync, { lagDays: 0, failures: 0 }, "events arriving on her last active day mean no sync lag");
eq(mari.warnings, [], "a learner the app broke on collects no learner-fault warning");

// Weak areas: ranked, bounded, and built only from valid attempts + due progress.
eq(mari.weakAreas.map((w) => w.area), ["th", "sh", "vowels"], "weak areas rank by miss rate, then due pressure");
eq(mari.weakAreas[0], { area: "th", misses: 3, attempts: 4, dueItems: 1, missRate: 75 }, "the weakest area carries its measured numbers");
eq(mari.weakAreas.some((w) => w.area === "vv"), false, "a mastered item is not a weak area");
eq(mari.weakAreas.some((w) => w.area === "nn"), false, "a never-attempted item is not a weak area");
eq(mari.weakAreas.some((w) => w.area === "ee"), false, "an area she never misses is not a weak area");

eq(week.metrics.dailyActiveLearners, 1, "daily active learner counts meaningful practice");
eq(week.metrics.sessionCompletionRate, 100, "cohort completion excludes the blocked day");
eq(week.metrics.speakingParticipationRate, 100, "cohort speaking participation excludes the blocked day");
eq(week.metrics.nextDayReturnRate, 100, "returning the next day is measured from active days");
eq(week.metrics.sevenDayReturnRate, null, "a week that has not elapsed is null, not 0");
eq(week.metrics.meaningfulPracticeMinutes, 10, "practice minutes are capped per activity and averaged per active day");
eq(week.metrics.reviewCompletionRate, 60, "review completion is completed over due");
eq(week.metrics.technicalFailureRate, 17, "technical failures are rated against attempted interactions");

// --- Ranking rules in isolation ---------------------------------------------
const ranking = await coach({
  profiles: [{ id: TIE, name: "Tie" }, { id: TECH, name: "Tech" }],
  player_stats: [stats(TIE, day(0)), stats(TECH, day(0))],
  settings: [],
  progress: [
    item(TIE, "zz", 2, 1, true), // due
    item(TIE, "aa", 2, 1, false), // not due
    item(TECH, "cc", 4, 5, true), // mastered: nothing to rank
  ],
  attempts: [
    attempt(TIE, "zz", false), attempt(TIE, "zz", true),
    attempt(TIE, "aa", false), attempt(TIE, "aa", true),
    attempt(TECH, "cc", true), attempt(TECH, "cc", true),
  ],
  events: [
    ev(TECH, "session_start", day(0)),
    ev(TECH, "technical_failure", day(0), { category: "speech-recognition" }),
    ev(TECH, "technical_failure", day(0), { category: "speech-recognition" }),
    ev(TECH, "technical_failure", day(0), { category: "speech-recognition" }),
    ev(TECH, "technical_failure", day(0), { category: "audio-playback" }),
  ],
});
// Equal miss rate, and the due area sorts LAST alphabetically: only the due
// weighting can put it first.
eq(ranking.byId[TIE].weakAreas.map((w) => [w.area, w.missRate]), [["zz", 50], ["aa", 50]], "an equal miss rate is broken by due progress");
eq(ranking.byId[TECH].weakAreas, [], "technical failures never manufacture a weak area");
eq(ranking.byId[TECH].warnings.includes("technical-trouble"), true, "repeated failures are flagged as our trouble");
eq(ranking.byId[TECH].warnings.includes("no-speaking"), true, "a session with no valid attempt is flagged");
eq(ranking.metrics.technicalFailureRate, 100, "a learner who only hit failures has a 100% failure rate");

// --- Warnings: who needs help, and why --------------------------------------
const help = await coach({
  profiles: [{ id: DROP, name: "Drop" }, { id: LAG, name: "Lag" }, { id: GONE, name: "Gone" }, { id: QUIET, name: "Quiet" }],
  player_stats: [stats(DROP, day(0)), stats(LAG, day(0)), stats(QUIET, day(5))],
  settings: [],
  progress: Array.from({ length: 15 }, (_, i) => ({ profile_id: DROP, category_id: "c1", phoneme: `p${i}`, attempts: 2, box: 1, due_at: now - 1000 })),
  attempts: [],
  events: [
    ev(DROP, "session_start", day(0)), ev(DROP, "activity_complete", day(0), done(60_000)),
    ev(DROP, "session_start", day(1)),
    ev(DROP, "session_start", day(2)),
    ev(DROP, "session_start", day(3)), ev(DROP, "session_complete", day(3)),
    // Practised today by her own day counter, but nothing since d3 reached us.
    ev(LAG, "session_start", day(3)), ev(LAG, "activity_complete", day(3), done(60_000)), ev(LAG, "speaking_attempted", day(3), { passed: true, score: 90 }),
  ],
});
eq(help.byId[DROP].warnings, ["session-drop", "no-speaking", "review-backlog"], "half-finished sessions, silence, and a review backlog are each named");
eq(help.byId[DROP].sessions.completionRate, 25, "completion rate counts started days that were not blocked");
eq(help.byId[LAG].warnings, ["sync-lag"], "practice her device recorded but never uploaded shows as sync lag");
eq(help.byId[LAG].sync.lagDays, 3, "sync lag is measured in local days of missing events");
eq(help.byId[GONE].warnings, ["never-practiced"], "a learner who never started is named plainly");
eq(help.byId[QUIET].warnings, ["quiet"], "five silent days is quiet, and — with no events at all — not a sync failure");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
