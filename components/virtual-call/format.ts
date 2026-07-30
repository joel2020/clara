// Clock formatting for the call. Small and shared so the header, the report,
// and the screen reader announcements can never drift apart.

/** mm:ss — the live call duration, and any elapsed time on the report. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * "3 min 12 s" — a duration meant to be read aloud. Used for the report prose
 * and for the clock's aria-label, because a screen reader announces "4:07" as
 * a time of day rather than a length. The units are the same in both coach
 * languages, so this needs no translation.
 */
export function formatSpokenDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds} s`;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes} min ${seconds} s`;
}
