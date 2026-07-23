// Who is allowed to use Clara.
//
// Registration is open at the Supabase level (so accounts can be created from
// inside the app, with no dashboard trip), but an account is worthless unless
// its email is on this list: the gate won't open and the paid API routes return
// 403. So a stranger can sign up and still get nothing — no app, no OpenAI, no
// ElevenLabs, no Azure.
//
// Emails are not secrets, so this lives in code rather than an env var — knowing
// an allowed address gets you nowhere without that account's password.
// To add a student: add their email here and ship.

export const ALLOWED_EMAILS = [
  "marianaarango1515@gmail.com", // Mariana
  "jravalentina04@gmail.com", // Valentina
  "alivio.studio.ops@gmail.com", // Joel
  "joelcarias23@gmail.com", // Joel (teacher/admin)
];

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.trim().toLowerCase());
}

// The teacher(s) who can see the whole roster in the coach cockpit. A strict
// subset of the allowlist — students can use the app but never see each other.
export const ADMIN_EMAILS = ["alivio.studio.ops@gmail.com", "joelcarias23@gmail.com"];

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
