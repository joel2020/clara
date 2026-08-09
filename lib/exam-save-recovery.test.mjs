import { resolveExamSaveFailure } from "./exam-save-recovery.ts";
import { ExamCheckpointConflictError } from "./exam-checkpoint.ts";
import { StaleExamLevelError, StalePracticeBindingError } from "./db/repository.ts";

let ok = 0, fail = 0;
const check = (value, message) => value ? ok++ : (fail++, console.log("FAIL", message));
const binding = {};
const identity = { day: "2026-08-09", sourceLevel: "A1", candidateLevel: "A2", seed: "seed", contentVersion: "v1", contentHash: "0123456789abcdef" };
const pending = { ...identity, status: "pending-advance", sessionId: "s", sequence: 4 };
let reads = 0;
const repo = { peekExamCheckpointForPracticeBinding: async () => (reads++, pending), getExamAttemptsForPracticeBinding: async () => [] };

let result = await resolveExamSaveFailure({ error: new ExamCheckpointConflictError(), repo, binding, identity, sessionId: "s", retryCount: 0 });
check(result.kind === "resume" && result.checkpoint === pending && reads === 1, "a CAS conflict loads and resumes the latest bound checkpoint exactly once");
result = await resolveExamSaveFailure({ error: new ExamCheckpointConflictError(), repo: { peekExamCheckpointForPracticeBinding: async () => ({ ...pending, sessionId: "other" }), getExamAttemptsForPracticeBinding: async () => [] }, binding, identity, sessionId: "s", retryCount: 0 });
check(result.kind === "conflict", "a different sitting is preserved and never disclosed as the current sitting");
result = await resolveExamSaveFailure({ error: new ExamCheckpointConflictError(), repo: { peekExamCheckpointForPracticeBinding: async () => null, getExamAttemptsForPracticeBinding: async () => [] }, binding, identity, sessionId: "s", retryCount: 0 });
check(result.kind === "restart", "a missing conflict checkpoint restarts only when today's attempt is still available");
result = await resolveExamSaveFailure({ error: new ExamCheckpointConflictError(), repo: { peekExamCheckpointForPracticeBinding: async () => null, getExamAttemptsForPracticeBinding: async () => [{ day: identity.day }] }, binding, identity, sessionId: "s", retryCount: 0 });
check(result.kind === "conflict", "a missing checkpoint never bypasses the one-attempt policy");
result = await resolveExamSaveFailure({ error: new StalePracticeBindingError(), repo, binding, identity, sessionId: "s", retryCount: 0 });
check(result.kind === "account-changed" && reads === 1, "an account change never reads or retries the stale learner payload");
result = await resolveExamSaveFailure({ error: new StaleExamLevelError(), repo, binding, identity, sessionId: "s", retryCount: 0 });
check(result.kind === "level-changed" && reads === 1, "a transaction-fresh level change cannot enter a stale retry loop");
result = await resolveExamSaveFailure({ error: new Error("quota"), repo, binding, identity, sessionId: "s", retryCount: 0, maxRetries: 2 });
check(result.kind === "retry" && result.retryCount === 1 && result.canRetry, "an ordinary save failure preserves one bounded retry");
result = await resolveExamSaveFailure({ error: new Error("quota"), repo, binding, identity, sessionId: "s", retryCount: 2, maxRetries: 2 });
check(result.kind === "retry" && result.retryCount === 3 && !result.canRetry, "ordinary save recovery stops after its retry bound");

console.log(`exam-save-recovery: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
