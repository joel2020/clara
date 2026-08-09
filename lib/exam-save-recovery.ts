import type { ExamCheckpoint, ExamCheckpointIdentity } from "./db/types.ts";
import type { DataRepository, PracticePersistenceBinding } from "./db/repository.ts";
import { StaleExamLevelError, StalePracticeBindingError } from "./db/repository.ts";
import { ExamCheckpointConflictError, sameExamCheckpointIdentity } from "./exam-checkpoint.ts";

export type ExamSaveRecovery =
  | { kind: "resume"; checkpoint: ExamCheckpoint }
  | { kind: "restart" }
  | { kind: "conflict" }
  | { kind: "account-changed" }
  | { kind: "level-changed" }
  | { kind: "retry"; retryCount: number; canRetry: boolean };

export async function resolveExamSaveFailure(input: {
  error: unknown;
  repo: Pick<DataRepository, "peekExamCheckpointForPracticeBinding" | "getExamAttemptsForPracticeBinding">;
  binding: PracticePersistenceBinding;
  identity: ExamCheckpointIdentity;
  sessionId: string;
  retryCount: number;
  maxRetries?: number;
}): Promise<ExamSaveRecovery> {
  if (input.error instanceof StalePracticeBindingError) return { kind: "account-changed" };
  if (input.error instanceof StaleExamLevelError) return { kind: "level-changed" };
  if (input.error instanceof ExamCheckpointConflictError) {
    try {
      const checkpoint = await input.repo.peekExamCheckpointForPracticeBinding(input.binding);
      if (checkpoint) {
        return checkpoint.sessionId === input.sessionId && sameExamCheckpointIdentity(checkpoint, input.identity)
          ? { kind: "resume", checkpoint }
          : { kind: "conflict" };
      }
      const attempts = await input.repo.getExamAttemptsForPracticeBinding(input.binding);
      return attempts.some((attempt) => attempt.day === input.identity.day) ? { kind: "conflict" } : { kind: "restart" };
    } catch (error) {
      return error instanceof StalePracticeBindingError ? { kind: "account-changed" } : { kind: "conflict" };
    }
  }
  const retryCount = input.retryCount + 1;
  return { kind: "retry", retryCount, canRetry: retryCount <= (input.maxRetries ?? 2) };
}
