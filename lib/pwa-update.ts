// Only passive hub pages may reload automatically when a new deployment takes
// control. Exercise and assessment routes can contain unsent learner work, so
// they wait until the learner returns to a safe destination.
const SAFE_UPDATE_PATHS = new Set([
  "/",
  "/map",
  "/shop",
  "/profile",
  "/settings",
  "/today",
]);

export function canReloadForAppUpdate(pathname: string): boolean {
  return SAFE_UPDATE_PATHS.has(pathname);
}

export function serviceWorkerUrl(buildId: string | undefined): string {
  return `/sw.js?v=${encodeURIComponent(buildId || "local")}`;
}
