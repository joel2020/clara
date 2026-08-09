export function gradedAccuracy(clears: number, gradedAttempts: number): number | null {
  if (!Number.isInteger(clears) || !Number.isInteger(gradedAttempts) || clears < 0 || gradedAttempts < 0 || clears > gradedAttempts) {
    throw new RangeError("Invalid graded round totals");
  }
  return gradedAttempts === 0 ? null : Math.round((clears / gradedAttempts) * 100);
}

export function shouldCelebrateGradedCompletion(input: {
  gradedAttempts: number;
  completedWithGradedResult: boolean;
  hadUngradedSkip?: boolean;
}): boolean {
  return input.gradedAttempts > 0
    && input.completedWithGradedResult
    && input.hadUngradedSkip !== true;
}
