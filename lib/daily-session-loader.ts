import type { DailySession } from "./daily-session.ts";

export interface DailySessionLoadBoundary {
  day: string;
  load: (day: string) => Promise<DailySession | undefined>;
  compose: () => Promise<DailySession | null>;
  save: (session: DailySession) => Promise<DailySession>;
  publish: (session: DailySession) => void;
}

/**
 * Resume persisted state before consulting fresh learner evidence. A newly
 * composed plan crosses the durable save boundary before React can publish it.
 */
export async function loadOrCreateDailySession(
  boundary: DailySessionLoadBoundary,
): Promise<DailySession | null> {
  const saved = await boundary.load(boundary.day);
  if (saved) {
    boundary.publish(saved);
    return saved;
  }

  const composed = await boundary.compose();
  if (!composed) return null;
  const persisted = await boundary.save(composed);
  boundary.publish(persisted);
  return persisted;
}
