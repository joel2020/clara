export type LearnerSpace = "hoy" | "camino" | "hablar" | "yo";
export type LearnerNavIcon = "sunrise" | "route" | "message" | "profile";

export interface LearnerNavItem {
  id: LearnerSpace;
  href: "/" | "/map" | "/talk" | "/profile";
  labelKey: "navToday" | "navCamino" | "navTalk" | "navYo";
  icon: LearnerNavIcon;
}

export const LEARNER_NAV: readonly LearnerNavItem[] = [
  { id: "hoy", href: "/", labelKey: "navToday", icon: "sunrise" },
  { id: "camino", href: "/map", labelKey: "navCamino", icon: "route" },
  { id: "hablar", href: "/talk", labelKey: "navTalk", icon: "message" },
  { id: "yo", href: "/profile", labelKey: "navYo", icon: "profile" },
] as const;

/** Secondary identity destinations remain anchored to Yo in the app shell. */
export function isLearnerNavActive(item: LearnerNavItem, pathname: string): boolean {
  return pathname === item.href || (item.id === "yo" && pathname === "/shop");
}

const IMMERSIVE_EXACT = new Set([
  "/today",
  "/exam",
  "/call",
  "/virtual-call",
  "/duet",
  "/listen",
  "/play",
  "/review",
  "/shadow",
  "/build",
]);

/** Full-focus learning routes do not compete with global navigation. */
export function isImmersiveRoute(pathname: string): boolean {
  return IMMERSIVE_EXACT.has(pathname)
    || pathname.startsWith("/lesson/")
    || pathname.startsWith("/preview/");
}
