// npx tsx lib/scoring.test.mjs
//
// The pass/fail verdict is the most consequential pure function in the app — it
// decides whether a rep counts, feeds SRS, and drives readiness — yet it had no
// test. This covers transcript-only fallback, strict acoustic grading, the
// minimal-pair ("heardPartner") detection, and the phrase fuzzy matcher.
import {
  isGradedScoreResult,
  scoreAttempt,
  similarity,
  normalize,
} from "./speech/scoring.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (a === b) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a), "want", JSON.stringify(b)); } };
const truthy = (a, m) => { if (a) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a)); } };

// ── normalize / similarity ────────────────────────────────────────────────
eq(normalize("  Héllo, WORLD! "), "hello world", "normalize lowercases, strips accents+punct");
eq(similarity("sheep", "sheep"), 100, "identical words score 100");
eq(similarity("", ""), 100, "two empties are identical");
eq(similarity("sheep", ""), 0, "something vs nothing is 0");
truthy(similarity("sheep", "ship") < 100 && similarity("sheep", "ship") > 0, "near words score between");

// ── word scoring: threshold is 80 ─────────────────────────────────────────
const perfect = scoreAttempt({ target: "cat", transcript: "cat", kind: "word" });
eq(perfect.passed, true, "exact word passes");
eq(perfect.score, 100, "exact word scores 100");
eq(perfect.feedbackKey, "perfect", "exact word is 'perfect'");

const miss = scoreAttempt({ target: "cat", transcript: "dog", kind: "word" });
eq(miss.passed, false, "unrelated word fails");
eq(miss.feedbackKey, "notQuite", "bad miss is 'notQuite'");

// ── ease/lenient may alter scaffolding, never a pass threshold ─────────────
const strict = scoreAttempt({ target: "cats", transcript: "cat", kind: "word" });
const eased = scoreAttempt({ target: "cats", transcript: "cat", kind: "word", ease: 15 });
const lenient = scoreAttempt({ target: "cats", transcript: "cat", kind: "word", lenient: true });
eq(strict.score, 75, "one-char-off 4-letter word scores 75");
eq(strict.passed, false, "75 misses the fixed transcript word threshold");
eq(eased.passed, false, "ease cannot flip a transcript result");
eq(lenient.passed, false, "lenient cannot flip a transcript result");
eq(strict.gradingOutcome, "ungraded", "transcript fallback is explicitly ungraded");
eq(eased.gradingOutcome, "ungraded", "ease does not turn transcript evidence into grading evidence");

// ── minimal-pair detection ────────────────────────────────────────────────
const partner = scoreAttempt({ target: "sheep", transcript: "ship", kind: "word", partnerText: "ship" });
eq(partner.heardPartner, true, "landing on the twin sets heardPartner");
eq(partner.passed, false, "hearing the partner never passes");
eq(partner.feedbackKey, "partner", "partner feedback fires");

// a correct answer is NOT flagged as the partner
const notPartner = scoreAttempt({ target: "sheep", transcript: "sheep", kind: "word", partnerText: "ship" });
eq(notPartner.heardPartner, false, "the right word is not the partner");
eq(notPartner.passed, true, "the right word passes even with a partner defined");

// ── phrase scoring: word overlap, order-independent, threshold 70 ──────────
const phraseOk = scoreAttempt({ target: "can I have a coffee", transcript: "can I have a coffee", kind: "phrase" });
eq(phraseOk.score, 100, "exact phrase scores 100");
eq(phraseOk.passed, true, "exact phrase passes");

const phrasePartial = scoreAttempt({ target: "can I have a coffee please", transcript: "can I have coffee", kind: "phrase" });
truthy(phrasePartial.score >= 60 && phrasePartial.score < 100, "a partial phrase scores partial");

// ── acoustic (Azure) path requires complete policy evidence ───────────────
const azure = (recognizedText, pronunciationScore, words = []) => ({
  provider: "azure",
  providerStatus: "valid",
  recognizedText,
  pronunciationScore,
  words,
});
const azurePass = scoreAttempt({ target: "water", transcript: "water", kind: "word", assessment: azure("water", 88) });
eq(azurePass.score, 88, "acoustic path returns pronunciation score");
eq(azurePass.passed, false, "overall score alone does not invent absent target-phoneme evidence");
eq(azurePass.gradingOutcome, "diagnostic", "incomplete acoustic evidence preserves diagnostic status");
eq(azurePass.feedbackKey, "diagnostic", "diagnostic evidence does not receive retry feedback");

const azureFail = scoreAttempt({ target: "water", transcript: "wader", kind: "word", assessment: azure("wader", 40) });
eq(azureFail.passed, false, "low pronScore fails");

const acousticStrict = scoreAttempt({ target: "water", transcript: "water", kind: "word", assessment: azure("water", 69) });
const acousticEased = scoreAttempt({ target: "water", transcript: "water", kind: "word", ease: 50, assessment: azure("water", 69) });
const acousticLenient = scoreAttempt({ target: "water", transcript: "water", kind: "word", lenient: true, assessment: azure("water", 69) });
eq(acousticStrict.passed, false, "partial acoustic evidence is not mastery");
eq(acousticEased.passed, false, "ease cannot flip an acoustic result");
eq(acousticLenient.passed, false, "lenient cannot flip an acoustic result");
eq(acousticEased.gradingOutcome, "diagnostic", "ease cannot change an acoustic diagnostic outcome");
eq(acousticLenient.gradingOutcome, "diagnostic", "lenient cannot change an acoustic diagnostic outcome");

// ── every caller shares one explicit graded/non-graded boundary ────────────
for (const outcome of ["mastered", "retry"]) {
  eq(isGradedScoreResult({ gradingOutcome: outcome }), true, `${outcome} is valid grading evidence`);
}
for (const outcome of ["diagnostic", "technical-skip", "ungraded"]) {
  eq(isGradedScoreResult({ gradingOutcome: outcome }), false, `${outcome} is not grading evidence`);
}

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
