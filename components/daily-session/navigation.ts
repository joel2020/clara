import type { DailyActivity } from "@/lib/daily-session";

const SESSION_RETURN = "/today";

export function activityHref(activity: DailyActivity): string | null {
  const pathname =
    activity.kind === "retrieve"
      ? "/review"
      : activity.kind === "learn"
        ? `/lesson/${encodeURIComponent(activity.sourceId)}`
        : activity.kind === "listen"
          ? "/listen"
          : activity.kind === "speak"
            ? "/shadow"
            : activity.kind === "situation"
              ? "/talk"
              : null;
  if (!pathname) return null;

  const query = new URLSearchParams({
    returnTo: SESSION_RETURN,
    sessionActivity: activity.id,
  });
  return `${pathname}?${query}`;
}

export function sessionReturnHref(
  searchParams: Pick<URLSearchParams, "get">,
  result: "completed" | "technical" = "completed",
): string | null {
  if (searchParams.get("returnTo") !== SESSION_RETURN) return null;
  const activityId = searchParams.get("sessionActivity");
  if (!activityId) return SESSION_RETURN;

  const query = new URLSearchParams({ sessionActivity: activityId });
  if (result === "technical") query.set("sessionResult", "technical");
  return `${SESSION_RETURN}?${query}`;
}
