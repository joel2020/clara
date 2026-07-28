// Who am I, as far as the server is concerned. The client's ONLY source for
// access/admin flags: the email allowlists moved to server env (audit P0 —
// student emails were shipping in the client bundle), so client UI asks here
// instead of bundling the lists. Purely informational for UI gating — every
// protected route and the coach/instructor APIs still enforce the same checks
// server-side on each request.
import { authRequired, getAuthedUser } from "@/lib/auth-server";
import { isAdmin, isAllowed } from "@/lib/allowlist";

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
  return Response.json({
    authed: true,
    allowed: isAllowed(user.email),
    admin: isAdmin(user.email),
  });
}
