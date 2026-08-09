import { gradedAccuracy, shouldCelebrateGradedCompletion } from "./graded-round.ts";

let ok = 0;
let fail = 0;
const eq = (actual, expected, message) => {
  if (Object.is(actual, expected)) ok += 1;
  else {
    fail += 1;
    console.log("FAIL", message, "got", actual, "want", expected);
  }
};

eq(gradedAccuracy(0, 0), null, "a fully ungraded round has neutral accuracy");
eq(gradedAccuracy(1, 2), 50, "mixed rounds use only graded attempts in the denominator");
eq(gradedAccuracy(2, 3), 67, "graded accuracy rounds only for display");
eq(shouldCelebrateGradedCompletion({ gradedAttempts: 0, completedWithGradedResult: false }), false, "an all-ungraded round never celebrates");
eq(shouldCelebrateGradedCompletion({ gradedAttempts: 2, completedWithGradedResult: false }), false, "a final ungraded skip never triggers finish celebration");
eq(shouldCelebrateGradedCompletion({ gradedAttempts: 2, completedWithGradedResult: true, hadUngradedSkip: true }), false, "a partially ungraded round stays neutral");
eq(shouldCelebrateGradedCompletion({ gradedAttempts: 2, completedWithGradedResult: true }), true, "a wholly graded completion may celebrate");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
