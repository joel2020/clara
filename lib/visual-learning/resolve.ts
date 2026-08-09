import type {
  VisualObject,
  VisualObjectId,
  VisualRegistry,
  VisualTopicId,
  VisualTopicPack,
} from "./types";

export function resolveTopicPack(
  registry: VisualRegistry,
  topicId?: VisualTopicId,
): VisualTopicPack | null {
  return topicId ? registry.packs[topicId] ?? null : null;
}

export function resolveVisualObject(
  pack: VisualTopicPack,
  objectId?: VisualObjectId,
): VisualObject | null {
  return objectId ? pack.objects.find((object) => object.id === objectId) ?? null : null;
}

export function orderEntryPhraseFirst<T extends { id: string }>(
  items: readonly T[],
  entryPhraseItemId?: string,
): T[] {
  if (!entryPhraseItemId) return [...items];

  const entryIndex = items.findIndex((item) => item.id === entryPhraseItemId);
  if (entryIndex === -1) return [...items];

  return [items[entryIndex], ...items.slice(0, entryIndex), ...items.slice(entryIndex + 1)];
}
