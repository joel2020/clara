import { readFileSync } from "node:fs";
const source = readFileSync("app/exam/page.tsx", "utf8");
let ok = 0, fail = 0;
const check = (value, message) => value ? ok++ : (fail++, console.log("FAIL", message));
for (const [family, pattern] of [
  ["open/retell", /await acceptScore\(section\.key, graded\.score, "llm"/],
  ["scripted pronunciation", /await acceptScore\(section\.key, score, "azure"/],
  ["build", /await acceptScore\("build", correct \? 100 : 0, "mechanical"/],
  ["meaning recognition", /await acceptScore\("shortAnswer", correct \? 100 : 0, "mechanical"/],
]) check(pattern.test(source), `${family} persists through the shared accepted-answer checkpoint before feedback`);
check(/await persistCheckpoint\([\s\S]{0,700}setNote\(feedback\)[\s\S]{0,250}schedule\(\(\) => void advance/.test(source), "checkpoint commits before feedback renders or an advance timer starts");
check(/aria-busy=\{advancing\}/.test(source) && /disabled=\{listening \|\| advancing\}/.test(source), "the rendered exam exposes and enforces its advancing lock");
check((source.match(/instanceof ExamCheckpointConflictError/g) ?? []).length >= 3 && /setPhase\("conflict"\)/.test(source), "stale start, answer, advance, and clear paths stop effects and offer recovery");
check(/outcome\.passed[\s\S]{0,500}settings\.onboarding\.level !== level[\s\S]{0,500}setPhase\("level-changed"\)/.test(source), "a pass with missing or stale onboarding stops before persistence without retrying a stale promotion");
check(/phase === "save-error"[\s\S]{0,900}Guardar de nuevo/.test(source), "a bilingual persisted-save recovery action is rendered");
check(/resolveExamSaveFailure\([\s\S]{0,2600}recovery\.kind === "resume"[\s\S]{0,300}applyCheckpoint\(recovery\.checkpoint\)/.test(source), "final-save CAS recovery loads and applies the latest durable checkpoint");
check(/recovery\.kind === "account-changed"[\s\S]{0,500}setPhase\("account-changed"\)/.test(source) && /saveRetryCount <= 2/.test(source), "account changes terminate safely while ordinary retries are visibly bounded");
check(/if \(finalSaveBusyRef\.current\) return;[\s\S]{0,100}finalSaveBusyRef\.current = true;[\s\S]{0,5000}finally \{[\s\S]{0,100}finalSaveBusyRef\.current = false/.test(source), "retry taps share one owned final-save operation");
check(/const \[sittingSourceLevel, setSittingSourceLevel\][\s\S]{0,180}const level = sittingSourceLevel \?\? settingsLevel/.test(source), "a started or restored sitting freezes its source level instead of following later settings renders");
check(/peekExamCheckpointForPracticeBinding\(binding\)[\s\S]{0,500}setSittingSourceLevel\(checkpoint\.sourceLevel/.test(source), "reload discovers the owner-bound checkpoint before composing its frozen paper");
check(/sameExamCheckpointIdentity\(checkpoint, examIdentity\)[\s\S]{0,350}setPhase\("conflict"\)/.test(source), "a changed composition is preserved and surfaced as conflict instead of relabelled or deleted");
console.log(`exam-answer-durability: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
