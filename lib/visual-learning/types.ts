export const VISUAL_TOPIC_IDS = [
  "cafe-restaurant",
  "airport-travel",
  "hotel",
  "directions-transport",
  "work-meetings",
  "shopping-payments",
  "doctor-pharmacy",
  "introductions",
  "social-plans",
  "home-routines",
] as const;

export type VisualTopicId = (typeof VISUAL_TOPIC_IDS)[number];
export type VisualObjectId = string;
export type VisualLanguage = "en" | "es";
export type VisualFallbackClass =
  | "topic-missing"
  | "environment-missing"
  | "object-missing"
  | "outfit-pose-missing"
  | "image-decode";

export interface LocalizedVisualText {
  en: string;
  es: string;
}

export interface VisualObject {
  id: VisualObjectId;
  label: LocalizedVisualText;
  pronunciation: string;
  image: string;
  audioItemId?: string;
  alt: LocalizedVisualText;
}

export interface VisualMoment {
  pose: "idle" | "cheer" | "think" | "encourage" | "clap" | "point" | "love";
  focusObjectIds: VisualObjectId[];
}

export interface VisualTopicPack {
  id: VisualTopicId;
  environment: { desktop: string; mobile: string };
  story: {
    eyebrow: LocalizedVisualText;
    title: LocalizedVisualText;
    body: LocalizedVisualText;
    cta: LocalizedVisualText;
  };
  discoveryObjectIds: VisualObjectId[];
  entryObjectId: VisualObjectId;
  entryPhraseItemId: string;
  objects: VisualObject[];
  moments: Record<"story" | "discover" | "speak" | "success" | "retry", VisualMoment>;
}

export interface VisualRegistry {
  packs: Partial<Record<VisualTopicId, VisualTopicPack>>;
}
