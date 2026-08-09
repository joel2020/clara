import type { PracticeItem } from "../db/types.ts";
import type { AssessedWord } from "./azure-response.ts";
import { PRONUNCIATION_TARGET_METADATA } from "./latam-prior.ts";

export interface TargetEvidenceMetadata {
  phonemes: readonly string[];
  targetIndexes: readonly number[];
  reduction: "phoneme-min" | "target-word-min" | "diagnostic-only";
}

const MULTI = ["tʃ", "dʒ", "aɪ", "aʊ", "eɪ", "oʊ", "ɔɪ", "ɝ", "ɚ"];
const NON_PHONEMES = new Set(["/", "[", "]", "ˈ", "ˌ", ".", " ", "‿"]);

export function ipaPhonemes(ipa: string): string[] {
  const value = ipa.normalize("NFC").replaceAll("ː", "");
  const result: string[] = [];
  for (let index = 0; index < value.length;) {
    if (NON_PHONEMES.has(value[index])) { index += 1; continue; }
    const multi = MULTI.find((candidate) => value.startsWith(candidate, index));
    if (multi) { result.push(multi); index += multi.length; continue; }
    const codepoint = [...value.slice(index)][0];
    if (/\p{L}/u.test(codepoint)) result.push(codepoint);
    index += codepoint.length;
  }
  return result;
}

function aliases(phoneme: string): readonly string[] {
  if (phoneme === "r" || phoneme === "ɹ" || phoneme === "ɻ") return ["r", "ɹ", "ɻ", "ɝ", "ɚ"];
  if (phoneme === "iː") return ["i"];
  if (phoneme === "uː") return ["u"];
  return [phoneme.replaceAll("ː", "")];
}

export function targetEvidenceMetadata(item: PracticeItem): TargetEvidenceMetadata {
  if (item.categoryId === "word-stress") {
    return { phonemes: ipaPhonemes(item.ipa), targetIndexes: [], reduction: "diagnostic-only" };
  }
  const explicit = PRONUNCIATION_TARGET_METADATA[item.id];
  if (explicit) {
    const index = explicit.kind === "flap" ? explicit.flap.index : explicit.finalEnding.index;
    return { phonemes: explicit.phonemes, targetIndexes: [index], reduction: "phoneme-min" };
  }
  const phonemes = ipaPhonemes(item.ipa);
  const wanted = new Set(aliases(item.phoneme));
  const targetIndexes = phonemes.flatMap((phoneme, index) => wanted.has(phoneme) ? [index] : []);
  return {
    phonemes,
    targetIndexes: targetIndexes.length > 0 ? targetIndexes : phonemes.map((_, index) => index),
    reduction: targetIndexes.length > 0 ? "phoneme-min" : "target-word-min",
  };
}

function samePhoneme(left: string, right: string): boolean {
  return aliases(left).includes(right) || aliases(right).includes(left);
}

/** Returns undefined when required provider phoneme evidence is absent. */
export function targetPhonemeScore(item: PracticeItem, words: readonly AssessedWord[]): number | undefined {
  const metadata = targetEvidenceMetadata(item);
  if (metadata.reduction === "diagnostic-only") return undefined;
  const targetWords = words.filter((word) => word.word.localeCompare(item.text, undefined, { sensitivity: "base", usage: "search" }) === 0);
  const candidates = targetWords.length > 0 ? targetWords : (item.kind === "word" && words.length === 1 ? [...words] : []);
  const scores: number[] = [];
  for (const word of candidates) {
    if (metadata.reduction === "target-word-min") {
      scores.push(...word.phonemes.flatMap((entry) => entry.accuracyScore === undefined ? [] : [entry.accuracyScore]));
      continue;
    }
    for (const index of metadata.targetIndexes) {
      const expected = metadata.phonemes[index];
      const aligned = word.phonemes[index];
      const found = aligned && samePhoneme(expected, aligned.phoneme)
        ? aligned
        : word.phonemes.find((entry) => samePhoneme(expected, entry.phoneme));
      if (found?.accuracyScore !== undefined) scores.push(found.accuracyScore);
    }
  }
  return scores.length > 0 ? Math.min(...scores) : undefined;
}
