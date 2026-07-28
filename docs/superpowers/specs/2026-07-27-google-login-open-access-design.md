# Google Login and Open Access

## Goal

Let anyone create or access a Clara account with Google or the existing
email/password flow. Keep coach and instructor capabilities restricted to the
existing administrator emails.

## Authentication flow

- The login screen presents **Continue with Google** above the existing
  email/password form.
- Google authentication uses Supabase OAuth and returns through
  `/auth/callback`.
- The callback exchanges the authorization result for a Supabase session,
  removes authentication details from the browser address, and sends the user
  into Clara.
- Email/password registration and login remain available.
- Authentication failures are shown in clear Spanish and English, with a path
  back to the login screen.

## Access policy

- Any authenticated Supabase user may use the student application and its
  authenticated API routes.
- The student allowlist is removed as an application-entry and paid-route gate.
- Coach and instructor screens and APIs continue to use the existing admin
  allowlist.
- Supabase row-level security continues to isolate each user's records by
  authentication user ID.

## Configuration

- Enable the Google provider in the Clara Supabase project.
- Configure the Google OAuth client and its Supabase callback URI.
- Allow Clara's production URL and local development callback URLs in Supabase.
- Enable the Google login button in production only after the provider is
  usable, preventing users from reaching a broken OAuth flow.

## Compatibility and data

- Existing email/password accounts and their user IDs remain unchanged.
- Existing student data is not migrated or deleted.
- If an existing user chooses Google with the same verified email, account
  behavior follows Supabase's identity-linking rules.
- Admin authorization remains email-based and is evaluated independently of
  the sign-in method.

## Error handling

- Missing or rejected OAuth results return users to a bilingual recovery screen.
- Users can retry Google login or use email/password.
- A provider or deployment configuration failure must not remove the existing
  email/password path.

## Verification

- Run the existing automated checks and production build.
- Verify email/password login remains present.
- Verify Google login begins the Supabase OAuth flow and returns successfully.
- Verify a previously unlisted account can enter the student app.
- Verify an unlisted account cannot enter coach or instructor areas.
- Verify an existing administrator retains coach and instructor access.
