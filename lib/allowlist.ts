// Who is allowed to use Clara.
//
// Registration is open at the Supabase level (so accounts can be created from
// inside the app, with no dashboard trip), but an account is worthless unless
// its email is on the allowlist: the gate won't open and the paid API routes
// return 403. So a stranger can sign up and still get nothing — no app, no
// OpenAI, no ElevenLabs, no Azure.
//
// The lists live in SERVER environment variables, not in code: student emails
// are personal data and used to ship in the repository AND the client bundle
// (audit P0). Client UI never sees the lists — it asks /api/me. Server-side
// enforcement (lib/auth-server.ts) fails closed: with the learner list unset in
// production, every non-admin identity is denied.
//
//   ALLOWED_EMAILS  comma-separated learner emails
//
// Administrator capability comes from the Supabase JWT's
// app_metadata.clara_role claim, not from a client-supplied value.
//
// To add a student: add their email to ALLOWED_EMAILS in the deployment env
// and redeploy. Local dev without Supabase env bypasses auth entirely, so
// these are only consulted when a real auth backend is configured.

function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function allowedEmails(): string[] {
  return parseList(process.env.ALLOWED_EMAILS);
}

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().includes(email.trim().toLowerCase());
}

export interface AccessIdentity {
  email?: string | null;
  app_metadata?: Record<string, unknown>;
}

export function isAdminIdentity(user: AccessIdentity): boolean {
  return user.app_metadata?.clara_role === "admin";
}

export function accessFlags(user: AccessIdentity): { allowed: boolean; admin: boolean } {
  const admin = isAdminIdentity(user);
  return { admin, allowed: admin || isAllowed(user.email) };
}
