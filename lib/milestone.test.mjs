// npx tsx lib/milestone.test.mjs
//
// "Hold a ten-minute conversation without freezing" is the general path's whole
// destination, so it must be earned by real sessions and not gameable by leaving a
// tab open.
import { milestoneProgress, qualifies, MILESTONE_MINUTES, MILESTONE_TURNS } from "./milestone.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (a === b) ok++; else { fail++; console.log("FAIL", m, "got", a, "want", b); } };

const MIN = 60_000;
const sess = (mins, turns, completed = true, at = 1) => ({
  scenarioId: "cafe",
  at,
  durationMs: mins * MIN,
  studentTurns: turns,
  avgPauseMs: null,
  completed,
});

eq(MILESTONE_MINUTES, 10, "the goal is ten minutes");
eq(MILESTONE_TURNS, 20, "the goal is twenty of her turns");

// --- What qualifies --------------------------------------------------------
eq(qualifies(sess(10, 20)), true, "ten minutes and twenty turns qualifies");
eq(qualifies(sess(12, 25)), true, "more than enough qualifies");
eq(qualifies(sess(9, 25)), false, "under ten minutes does not qualify");
eq(qualifies(sess(15, 19)), false, "too few turns does not qualify");

// An idle tab must not count: long duration, almost no speaking.
eq(qualifies(sess(45, 3)), false, "leaving it open and barely talking does not qualify");

// An abandoned session proves nothing, however long.
eq(qualifies(sess(20, 40, false)), false, "an abandoned session never qualifies");

// --- Progress toward it ----------------------------------------------------
const none = milestoneProgress([]);
eq(none.percent, 0, "no sessions is 0 percent");
eq(none.achieved, false, "no sessions is not achieved");
eq(none.bestMinutes, 0, "no sessions has no best");
eq(none.achievedAt, null, "no sessions has no date");

// Progress is the WEAKER of the two criteria, so a long silent session cannot show
// as nearly-there.
const idle = milestoneProgress([sess(20, 2)]);
eq(idle.percent, 10, "twenty minutes with two turns is 10 percent, not 100");

const half = milestoneProgress([sess(5, 10)]);
eq(half.percent, 50, "half of both criteria is 50 percent");
eq(half.bestMinutes, 5, "best minutes is reported");
eq(half.bestTurns, 10, "best turns is reported");

// Abandoned sessions are excluded from progress entirely.
eq(milestoneProgress([sess(9, 18, false)]).percent, 0, "abandoned sessions do not count as progress");

// The best session wins, not the most recent.
const mixed = milestoneProgress([sess(8, 16, true, 1), sess(2, 4, true, 2)]);
eq(mixed.percent, 80, "the best session sets progress, not the latest");

// Achievement, and the FIRST time it happened.
const done = milestoneProgress([sess(11, 22, true, 500), sess(12, 30, true, 900)]);
eq(done.achieved, true, "a qualifying session achieves the milestone");
eq(done.achievedAt, 500, "the first qualifying session is the date recorded");
eq(done.percent, 100, "achieved is capped at 100");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
