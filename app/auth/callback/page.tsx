// Google OAuth return route.
//
// The visible UI is OAuthCallbackScreen, which AuthGate renders in place of the
// whole app when the path is /auth/callback (see components/auth-gate.tsx) — so
// it runs before the session check and without the app chrome. This page
// component renders nothing; it exists only so the URL resolves.
export default function AuthCallbackRoute() {
  return null;
}
