import test from "node:test";
import assert from "node:assert/strict";
import { LESSONS } from "../content/lessons.ts";
import { targetEvidenceMetadata, targetPhonemeScore } from "./pronunciation-target-evidence.ts";
import { gradePronunciation } from "./pronunciation-policy.ts";

for (const lessonId of ["connected-speech", "final-clusters", "word-stress", "flap-t", "ed-endings"]) {
  test(`${lessonId} uses real IPA evidence rather than curriculum markers`, () => {
    const lesson = LESSONS.find((entry) => entry.id === lessonId);
    assert.ok(lesson);
    for (const item of lesson.items) {
      const metadata = targetEvidenceMetadata(item);
      assert.ok(metadata.phonemes.length > 0, item.id);
      assert.equal(metadata.phonemes.some((value) => ["ksts", "noun", "verb", "flap"].includes(value)), false, item.id);
      const provider = metadata.phonemes.map((phoneme, index) => ({ phoneme, accuracyScore: 90 - index }));
      assert.equal(
        typeof targetPhonemeScore(item, [{ word: item.text, accuracyScore: 90, phonemes: provider }]),
        lessonId === "word-stress" ? "undefined" : "number",
        item.id,
      );
    }
  });
}

test("every authored curriculum item can reach a strict A1 verdict with realistic provider evidence", () => {
  for (const item of LESSONS.flatMap((lesson) => lesson.items)) {
    if (item.categoryId === "word-stress") {
      assert.equal(targetPhonemeScore(item, [{ word: item.text, accuracyScore: 94, phonemes: [] }]), undefined, `${item.id} remains diagnostic-only`);
      continue;
    }
    const metadata = targetEvidenceMetadata(item);
    const words = item.text.split(/\s+/).map((word, wordIndex) => ({
      word: word.replace(/[^\p{L}']/gu, ""),
      accuracyScore: 94,
      phonemes: wordIndex === 0
        ? metadata.phonemes.map((phoneme) => ({ phoneme, accuracyScore: 92 }))
        : [{ phoneme: "ə", accuracyScore: 92 }],
    }));
    const score = item.kind === "word" ? targetPhonemeScore(item, words) : undefined;
    assert.equal(item.kind === "word" ? typeof score : "number", "number", item.id);
    const verdict = gradePronunciation({
      context: item.kind === "word" ? "word" : "daily-phrase",
      cefr: "A1",
      evidence: {
        providerStatus: "valid",
        pronunciationScore: 94,
        accuracyScore: 94,
        completenessScore: 100,
        lowestTargetWordScore: 92,
        targetRecognized: true,
        ...(score === undefined ? {} : { targetPhonemeScore: score }),
      },
    });
    assert.equal(verdict.outcome, "mastered", `${item.id}: ${verdict.reasons.join(",")}`);
  }
});

test("missing required target phonemes remains diagnostic", () => {
  const item = LESSONS.find((lesson) => lesson.id === "final-clusters").items[0];
  assert.equal(targetPhonemeScore(item, [{ word: item.text, accuracyScore: 90, phonemes: [] }]), undefined);
  const verdict = gradePronunciation({ context: "word", cefr: "A1", evidence: { providerStatus: "valid", pronunciationScore: 90, targetRecognized: true } });
  assert.equal(verdict.outcome, "diagnostic");
  assert.ok(verdict.reasons.includes("missing-target-phoneme-score"));
});
