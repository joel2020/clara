// npx tsx lib/analytics-schema.test.mjs
//
// The privacy bound on analytics. Everything below exists because an event
// pipeline that accepts arbitrary properties will eventually be handed a
// transcript, and once it is written to IndexedDB and mirrored to Supabase it
// is too late to take back.
import {
  validateEvent,
  EVENT_SCHEMAS,
  ANALYTICS_EVENT_TYPES,
  TECHNICAL_FAILURE_CATEGORIES,
} from "./analytics-schema.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a), "want", JSON.stringify(b)); } };
const truthy = (a, m) => { if (a) ok++; else { fail++; console.log("FAIL", m); } };
const throws = (fn, m) => { try { fn(); fail++; console.log("FAIL", m, "(did not throw)"); } catch { ok++; } };
const doesNotThrow = (fn, m) => { try { fn(); ok++; } catch (e) { fail++; console.log("FAIL", m, String(e.message ?? e)); } };

// A valid value for each rule kind, so every event type can be exercised from
// its own schema instead of a hand-written fixture that drifts.
const sample = (rule) => {
  switch (rule.kind) {
    case "enum": return rule.values[0];
    case "count": return 2;
    case "duration": return 1500;
    case "id": return "lesson-01";
    case "flag": return true;
    case "diagnostic": return "TypeError: x is not a function";
    default: throw new Error(`unhandled rule kind ${rule.kind}`);
  }
};
const wrong = (rule) => (rule.kind === "flag" || rule.kind === "count" || rule.kind === "duration" ? "not-a-number" : { nested: 1 });
const validProps = (schema, from = "required") =>
  Object.fromEntries(Object.entries(schema[from]).map(([k, r]) => [k, sample(r)]));

// --- The two bounds the plan names explicitly -------------------------------

for (const key of ["transcript", "heard", "audio", "voice", "email", "name"]) {
  throws(() => validateEvent({ type: "speaking_attempted", props: { [key]: "secret" } }), `speaking_attempted rejects "${key}"`);
  // ...and rejects it even when every required property is present, so it can
  // never ride along on an otherwise valid event.
  throws(
    () => validateEvent({ type: "speaking_attempted", props: { passed: true, score: 80, [key]: "secret" } }),
    `speaking_attempted rejects "${key}" alongside valid props`,
  );
}

doesNotThrow(() => validateEvent({ type: "technical_failure", props: { category: "speech-recognition" } }), "technical failure accepts a bounded category");
throws(() => validateEvent({ type: "technical_failure", props: { category: "arbitrary-free-text" } }), "technical failure rejects a free-text category");
for (const category of TECHNICAL_FAILURE_CATEGORIES) {
  doesNotThrow(() => validateEvent({ type: "technical_failure", props: { category } }), `technical failure accepts "${category}"`);
}

// A denied name is refused on every event type, not just the speaking one.
for (const type of ANALYTICS_EVENT_TYPES) {
  const props = { ...validProps(EVENT_SCHEMAS[type]), transcript: "she said hello" };
  throws(() => validateEvent({ type, props }), `${type} rejects a transcript property`);
}

// --- Every event type validates its own required properties ----------------

truthy(ANALYTICS_EVENT_TYPES.length === Object.keys(EVENT_SCHEMAS).length, "the event catalogue is closed and enumerable");
for (const type of ["session_start", "session_resume", "session_complete", "session_abandon", "activity_complete", "speaking_attempted", "review_complete", "return_next_day", "return_seven_day", "technical_failure"]) {
  truthy(ANALYTICS_EVENT_TYPES.includes(type), `${type} is in the closed union`);
}

for (const type of ANALYTICS_EVENT_TYPES) {
  const schema = EVENT_SCHEMAS[type];
  const required = validProps(schema);
  const result = validateEvent({ type, props: required });
  eq(result.type, type, `${type} validates and keeps its type`);
  eq(result.props, required, `${type} keeps every required property`);

  for (const key of Object.keys(schema.required)) {
    const missing = { ...required };
    delete missing[key];
    throws(() => validateEvent({ type, props: missing }), `${type} rejects a missing "${key}"`);
    throws(() => validateEvent({ type, props: { ...required, [key]: wrong(schema.required[key]) } }), `${type} rejects an invalid "${key}"`);
  }
}

// Events with no required properties still need a known type.
eq(validateEvent({ type: "app_open" }).props, {}, "app_open validates with no props at all");
throws(() => validateEvent({ type: "definitely_not_an_event", props: {} }), "an unknown event type is rejected");
throws(() => validateEvent({ type: "toString", props: {} }), "a prototype key is not an event type");

// --- Invalid optional properties are dropped, never thrown -----------------

for (const type of ANALYTICS_EVENT_TYPES) {
  const schema = EVENT_SCHEMAS[type];
  const optionalKeys = Object.keys(schema.optional);
  if (optionalKeys.length === 0) continue;
  const required = validProps(schema);

  const good = validateEvent({ type, props: { ...required, ...validProps(schema, "optional") } });
  for (const key of optionalKeys) truthy(key in good.props, `${type} keeps a valid optional "${key}"`);

  const junk = Object.fromEntries(optionalKeys.map((k) => [k, wrong(schema.optional[k])]));
  const dropped = validateEvent({ type, props: { ...required, ...junk } });
  eq(dropped.props, required, `${type} drops invalid optional properties and still records`);
}

// Unknown-but-harmless property names are dropped rather than stored.
eq(
  validateEvent({ type: "mode_open", props: { mode: "talk", somethingNew: 3 } }).props,
  { mode: "talk" },
  "unknown properties are dropped",
);

// --- No schema permits a free-text field ------------------------------------

const BOUNDED = ["enum", "count", "duration", "id", "flag"];
for (const type of ANALYTICS_EVENT_TYPES) {
  const schema = EVENT_SCHEMAS[type];
  for (const [key, rule] of Object.entries({ ...schema.required, ...schema.optional })) {
    if (rule.kind === "diagnostic") {
      // The single documented legacy exception: developer diagnostics on
      // client_error, hard-capped so nothing long can hide in them.
      truthy(type === "client_error", `only client_error carries diagnostics (${type}.${key})`);
      truthy(rule.max <= 200, `${type}.${key} diagnostics are length-capped`);
    } else {
      truthy(BOUNDED.includes(rule.kind), `${type}.${key} is a bounded kind, not text (${rule.kind})`);
    }
  }
}

// Ids are opaque handles, so they cannot be used to smuggle a sentence.
throws(() => validateEvent({ type: "lesson_start", props: { lesson: "she said hello to me" } }), "an id cannot hold a sentence");
throws(() => validateEvent({ type: "lesson_start", props: { lesson: "x".repeat(65) } }), "an id cannot hold a long string");
doesNotThrow(() => validateEvent({ type: "lesson_start", props: { lesson: "vowels.short-i_1" } }), "a real lesson id validates");

// Diagnostics are truncated rather than dropped: an error nobody can read is a
// bug nobody fixes, but an unbounded string is a leak.
const err = validateEvent({
  type: "client_error",
  props: { source: "window.error", message: "E".repeat(500), frame: "at f (app.js:1:1)", path: "/today" },
});
eq(err.props.message.length, 200, "client_error messages are truncated to the cap");
eq(err.props.path, "/today", "client_error keeps the pathname");

// --- The legacy producers keep working --------------------------------------

eq(validateEvent({ type: "mode_open", props: { mode: "call" } }).props, { mode: "call" }, "mode_open call still validates");
eq(validateEvent({ type: "mode_open", props: { mode: "talk" } }).props, { mode: "talk" }, "mode_open talk still validates");
for (const type of ["lesson_start", "lesson_complete", "lesson_abandon"]) {
  eq(validateEvent({ type, props: { lesson: "l1" } }).props, { lesson: "l1" }, `${type} still validates`);
}

console.log(`\n${ok} ok, ${fail} fail`);
if (fail) process.exit(1);
