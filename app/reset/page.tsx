// The password-reset landing route.
//
// The visible UI is ResetPasswordScreen, which AuthGate renders in place of the
// whole app when the path is /reset (see components/auth-gate.tsx) — so it works
// without a session and without the app chrome. This page component therefore
// renders nothing; it exists only so the /reset URL resolves.
export default function ResetRoute() {
  return null;
}
