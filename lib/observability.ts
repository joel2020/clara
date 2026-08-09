const FILTERED = "[Filtered]";
const FILTERED_EMAIL = "[Filtered email]";
const EMAIL_ADDRESS = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SENSITIVE_TEXT =
  /(?:authorization|cookie|set-cookie|transcript|audio|voice(?:\s*recording)?|utterance|speech(?:\s*sample)?)(?:\s*[:=]|\s+(?:content|data|upload|recording|failed))/i;
const CREDENTIAL_TEXT = /\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]+/i;
const SENSITIVE_KEY_PARTS = [
  "authorization",
  "cookie",
  "email",
  "transcript",
  "audio",
  "voice",
  "recording",
  "utterance",
  "speech",
  "password",
  "passwd",
  "token",
  "secret",
  "prompt",
  "completion",
  "messages",
  "modelinput",
  "modeloutput",
  "arguments",
] as const;
const AI_CONTENT_INTEGRATIONS = new Set([
  "OpenAI",
  "VercelAI",
  "Anthropic_AI",
  "Google_GenAI",
  "LangChain",
  "LangGraph",
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function scrubString(value: string): string {
  if (CREDENTIAL_TEXT.test(value) || SENSITIVE_TEXT.test(value) || /^data:audio\//i.test(value)) {
    return FILTERED;
  }

  return value.replace(EMAIL_ADDRESS, FILTERED_EMAIL);
}

function scrubRequestUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return scrubString(value.split(/[?#]/, 1)[0] ?? "");
  }
}

function scrubValue(value: unknown, path: string[], seen: WeakMap<object, unknown>): unknown {
  if (typeof value === "string") {
    const key = path.at(-1);
    const isEventOrBreadcrumbMessage =
      key === "message" && (path.length === 1 || path.includes("breadcrumbs") || path.includes("logentry"));
    const isExceptionValue = key === "value" && path.includes("exception");
    const isSpanDescription = key === "description" && path.includes("spans");

    if (isEventOrBreadcrumbMessage || isExceptionValue || isSpanDescription) return FILTERED;

    return path.at(-1) === "url" && path.at(-2) === "request"
      ? scrubRequestUrl(value)
      : scrubString(value);
  }

  if (value === null || typeof value !== "object") return value;

  const cached = seen.get(value);
  if (cached !== undefined) return cached;

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (let index = 0; index < value.length; index += 1) {
      copy.push(scrubValue(value[index], [...path, String(index)], seen));
    }
    return copy;
  }

  const copy: Record<string, unknown> = {};
  seen.set(value, copy);

  for (const [key, entry] of Object.entries(value)) {
    const parent = path.at(-1);
    const normalizedKey = key.toLowerCase();
    const isRequestBody = parent === "request" && normalizedKey === "data";
    const isRequestQuery = parent === "request" && normalizedKey === "query_string";

    if (
      normalizedKey === "user" ||
      isSensitiveKey(key) ||
      isRequestBody ||
      isRequestQuery
    ) {
      continue;
    }

    copy[key] = scrubValue(entry, [...path, key], seen);
  }

  return copy;
}

export function scrubSentryEvent<T extends object>(event: T): T {
  return scrubValue(event, [], new WeakMap()) as T;
}

export function createSentryOptions(dsn: string | undefined) {
  if (!dsn || dsn !== dsn.trim()) return undefined;

  const tracesSampleRate =
    process.env.VERCEL_ENV !== undefined
      ? process.env.VERCEL_ENV === "production"
        ? 0.1
        : 0
      : process.env.NODE_ENV === "production"
        ? 0.1
        : 0;

  return {
    dsn,
    sendDefaultPii: false,
    includeLocalVariables: false,
    release: process.env.NEXT_PUBLIC_CLARA_BUILD_ID ?? "local",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate,
    // Provider spans can contain learner prompts, transcripts, or model output.
    // Route-level performance tracing remains enabled without those integrations.
    integrations: <T extends { name: string }>(defaults: T[]) =>
      defaults.filter((integration) => !AI_CONTENT_INTEGRATIONS.has(integration.name)),
    beforeSend: <T extends object>(event: T) => scrubSentryEvent(event),
    beforeSendTransaction: <T extends object>(event: T) => scrubSentryEvent(event),
    beforeBreadcrumb: <T extends object>(breadcrumb: T) => scrubSentryEvent(breadcrumb),
  };
}
