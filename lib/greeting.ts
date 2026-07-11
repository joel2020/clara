// A warm, time-aware greeting for the home hero. Small thing, but she sees it
// every time she opens Clara — "Buenas tardes, Mariana" feels like the app knows
// her, not a generic dashboard. Computed on the client (see app/page.tsx) so the
// prerendered page and the device clock never disagree.

export type GreetKey = "morning" | "afternoon" | "evening";

export function timeGreetingKey(hour: number): GreetKey {
  if (hour < 12) return "morning";
  if (hour < 19) return "afternoon";
  return "evening";
}
