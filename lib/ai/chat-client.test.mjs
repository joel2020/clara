// npx tsx lib/ai/chat-client.test.mjs
// Guards the provider switch on the live paid chat route: a half-configured
// Azure deployment must never take precedence over a working OpenAI key, and no
// credentials at all must return null (the route turns that into a 503) rather
// than constructing a client that fails at request time.
import { getChatModel } from "./chat-client.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (a === b) ok++; else { fail++; console.log("FAIL", m, "got", a, "want", b); } };
const isNull = (a, m) => { if (a === null) ok++; else { fail++; console.log("FAIL", m, "got", a); } };

const KEYS = ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_API_VERSION", "OPENAI_API_KEY"];
function withEnv(env, fn) {
  const saved = {};
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, env);
  try { return fn(); } finally {
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

// Nothing configured.
isNull(withEnv({}, getChatModel), "no credentials returns null");

// OpenAI only — the pre-existing behaviour must be untouched.
withEnv({ OPENAI_API_KEY: "sk-test" }, () => {
  const m = getChatModel();
  eq(m.provider, "openai", "openai key selects openai");
  eq(m.model, "gpt-4o-mini", "openai path keeps gpt-4o-mini");
});

// Full Azure trio wins over OpenAI.
withEnv({
  AZURE_OPENAI_ENDPOINT: "https://clara-openai.openai.azure.com",
  AZURE_OPENAI_API_KEY: "azure-test",
  AZURE_OPENAI_DEPLOYMENT: "clara-chat",
  OPENAI_API_KEY: "sk-test",
}, () => {
  const m = getChatModel();
  eq(m.provider, "azure", "full azure config wins");
  eq(m.model, "clara-chat", "azure model is the deployment name");
});

// Every partial Azure config must fall back rather than half-configure.
const full = {
  AZURE_OPENAI_ENDPOINT: "https://clara-openai.openai.azure.com",
  AZURE_OPENAI_API_KEY: "azure-test",
  AZURE_OPENAI_DEPLOYMENT: "clara-chat",
};
for (const missing of Object.keys(full)) {
  const partial = { ...full, OPENAI_API_KEY: "sk-test" };
  delete partial[missing];
  withEnv(partial, () => {
    eq(getChatModel().provider, "openai", `missing ${missing} falls back to openai`);
  });
  const noFallback = { ...full };
  delete noFallback[missing];
  withEnv(noFallback, () => {
    isNull(getChatModel(), `missing ${missing} with no openai key returns null`);
  });
}

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
