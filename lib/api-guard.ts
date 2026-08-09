// Exact-origin guard for every paid API route. Clara
// is a public PWA, so these endpoints are reachable by anyone with the URL and
// they spend real money (OpenAI, ElevenLabs, Azure). This is defense-in-depth on
// top of authenticated durable quotas and provider spend caps.
//
// A browser `fetch` POST always sends an `Origin` header matching the site; a
// script or `curl` hitting the route cold sends none (or a foreign one). So we
// require Origin to be present and match the request's complete origin.

function deny(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Call at the top of a paid POST route. Returns a 403 Response to short-circuit
 * a cross-origin request, or null when the request may proceed. Never rate-limit
 * by source IP here: many legitimate classroom users share one NAT address.
 */
export function guardApi(request: Request): Response | null {
  const origin = request.headers.get("origin");
  // Require a same-origin Origin header. Browser fetch POSTs always send it.
  // Compare the complete serialized origin (scheme, host, and port): hostname
  // prefixes and a localhost Origin against a production URL are both foreign.
  if (!origin) return deny(403, "forbidden");
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) return deny(403, "forbidden");
  } catch {
    return deny(403, "forbidden");
  }
  return null;
}
