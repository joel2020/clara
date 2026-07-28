import { Sunrise, Route, MessageCircle, CircleUser } from "lucide-react";
import type { TabItem } from "@/components/system/tab-bar";

// The four spaces, pointed at their prototype surfaces.
export const PREVIEW_TABS: TabItem[] = [
  { href: "/preview/home", label: "Hoy", icon: Sunrise },
  { href: "/preview/progress", label: "Camino", icon: Route },
  { href: "/preview/talk", label: "Hablar", icon: MessageCircle },
  { href: "/preview/yo", label: "Yo", icon: CircleUser },
];
