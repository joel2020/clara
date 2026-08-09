// Who am I, as far as the server is concerned. Learner and admin access are
// both derived from the same server-side identity policy used by paid routes.
import { authRequired, getAuthedUser } from "../../../lib/auth-server.ts";
import { accessFlags } from "../../../lib/allowlist.ts";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  // No origin check (browsers don't send Origin on same-origin GETs — same
  // reasoning as /api/news) and no allowlist requirement: this is the route
  // that TELLS the client whether it's allowlisted. It spends no provider
  // money and reveals only the caller's own flags.
  if (!authRequired()) {
    if (process.env.NODE_ENV === "production") {
      return Response.json({ error: "auth_not_configured" }, { status: 503 });
    }
    // Local dev without an auth backend: everything is open, matching the gate.
    return Response.json({ authed: true, allowed: true, admin: true });
  }

  const user = await getAuthedUser(request);
  if (!user) return Response.json({ authed: false, allowed: false, admin: false }, { status: 401 });
  const flags = accessFlags(user);
  return Response.json({
    authed: true,
    ...flags,
  });
}
