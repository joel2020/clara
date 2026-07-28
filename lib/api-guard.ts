// Abuse guard for the paid API routes (chat / tts / assess / transcribe). Clara
// is a public PWA, so these endpoints are reachable by anyone with the URL and
// they spend real money (OpenAI, ElevenLabs, Azure). This is defense-in-depth on
// top of the provider spend caps: it turns away the two cheapest-to-block abuse
// shapes without adding any friction for Mariana — her own app always passes.
//
//   1. Same-origin only. A browser `fetch` POST always sends an `Origin` header
//      matching the site; a script or `curl` hitting the route cold sends none
//      (or a foreign one). So we require Origin to be present and match the host.
//   2. Per-IP flood control. A best-effort in-memory sliding window catches a
//      single source hammering the route. It's per-instance (serverless), so the
//      hard, global limit still belongs at the Vercel WAF — but this alone stops
//      the common "someone found the URL and looped it" case.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40; // generous for one real learner; a flood trips it

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

function rateLimited(ip: string, now: number): boolean {
  const b = buckets.get(ip);
  if (!b || now >= b.reset) {
    buckets.set(ip, { count: 1, reset: now + WINDOW_MS });
    // Opportunistic cleanup so the map can't grow unbounded on a busy instance.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now >= v.reset) buckets.delete(k);
    }
    return false;
  }
  b.count += 1;
  return b.count > MAX_PER_WINDOW;
}

function deny(status: number, error: string, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json", ...(extra ?? {}) },
  });
}

/**
 * Call at the top of a paid POST route. Returns a Response to short-circuit with
 * (403 cross-origin, 429 flood), or null when the request may proceed.
 */
export function guardApi(request: Request): Response | null {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  // Require a same-origin Origin header. Browser fetch POSTs always send it;
  // localhost is allowed so dev and same-host tooling keep working.
  if (!origin) return deny(403, "forbidden");
  try {
    const oHost = new URL(origin).host;
    // Exact hostname match only: a prefix test would accept "localhost.evil.com".
    const oName = oHost.split(":")[0];
    const local = oName === "localhost" || oName === "127.0.0.1";
    if (oHost !== host && !local) return deny(403, "forbidden");
  } catch {
    return deny(403, "forbidden");
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip, Date.now())) return deny(429, "rate_limited", { "retry-after": "60" });

  return null;
}
