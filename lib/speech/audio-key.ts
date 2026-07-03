// Maps a practice-item id to a filesystem- and URL-safe audio key. Pure and
// dependency-free so the Node generation script and the browser share one
// definition. e.g. "word-stress:present-verb" -> "word_stress_present_verb".

export function audioKey(itemId: string): string {
  return itemId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * URL of a clip. The primary voice (Joel) lives at /audio/<key>.mp3; the
 * supporting voices live at /audio/v/<slug>/<key>.mp3.
 */
export function audioUrl(itemId: string, voiceSlug?: string): string {
  const key = audioKey(itemId);
  return voiceSlug && voiceSlug !== "joel" ? `/audio/v/${voiceSlug}/${key}.mp3` : `/audio/${key}.mp3`;
}
