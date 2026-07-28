import type { LucideIcon } from "lucide-react";
import {
  Hand,
  Coffee,
  Map,
  ShoppingBag,
  CloudSun,
  CalendarDays,
  MessageCircle,
  Phone,
  Gift,
  Palmtree,
  Sparkles,
} from "lucide-react";

// Presentation-side bridge from content data to the drawn icon system.
// Content files (lib/content/*) keep their emoji fields untouched — Phase 0 owns
// that data — and the UI resolves an id (preferred) or the emoji itself to a
// real icon component. Unmapped future content falls through to the emoji so a
// new scenario never renders blank.

const BY_ID: Record<string, LucideIcon> = {
  greetings: Hand,
  cafe: Coffee,
  directions: Map,
  shopping: ShoppingBag,
  smalltalk: CloudSun,
  plans: CalendarDays,
};

const BY_EMOJI: Record<string, LucideIcon> = {
  "👋": Hand,
  "☕": Coffee,
  "🗺️": Map,
  "🛍️": ShoppingBag,
  "🌤️": CloudSun,
  "📅": CalendarDays,
  "💬": MessageCircle,
  "📞": Phone,
  "🎁": Gift,
  "🌴": Palmtree,
  "✨": Sparkles,
};

export function contentIcon(id?: string, emoji?: string): LucideIcon | null {
  if (id && BY_ID[id]) return BY_ID[id];
  if (emoji && BY_EMOJI[emoji]) return BY_EMOJI[emoji];
  return null;
}
