// npx tsx lib/scoring.test.mjs
//
// The pass/fail verdict is the most consequential pure function in the app — it
// decides whether a rep counts, feeds SRS, and drives readiness — yet it had no
// test. This covers the thresholds, the ease adjustment, the minimal-pair
// ("heardPartner") detection, and the phrase fuzzy matcher.
import { scoreAttempt, similarity, normalize } from "./speech/scoring.ts";

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

// ── ease lowers the bar; a borderline attempt flips to pass ────────────────
const borderlineTarget = "seven"; // "even" is dist 1, len 5 → 80
const strict = scoreAttempt({ target: borderlineTarget, transcript: "even", kind: "word" });
const eased = scoreAttempt({ target: borderlineTarget, transcript: "even", kind: "word", ease: 15 });
eq(strict.score, 80, "one-char-off 5-letter word scores 80");
truthy(eased.passed, "ease of 15 lets an 80 pass a 80-threshold word (80 >= 65)");

// lenient is the +10 fallback when ease is unset
const lenient = scoreAttempt({ target: "hello", transcript: "helo", kind: "word", lenient: true });
truthy(lenient.passed, "lenient mode passes a close word");

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

// ── acoustic (Azure) path trusts pronScore ────────────────────────────────
const azurePass = scoreAttempt({ target: "water", transcript: "water", kind: "word", assessment: { display: "water", pronScore: 88 } });
eq(azurePass.score, 88, "acoustic path returns pronScore");
eq(azurePass.passed, true, "pronScore 88 passes the 70 word bar");

const azureFail = scoreAttempt({ target: "water", transcript: "wader", kind: "word", assessment: { display: "wader", pronScore: 40 } });
eq(azureFail.passed, false, "low pronScore fails");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
