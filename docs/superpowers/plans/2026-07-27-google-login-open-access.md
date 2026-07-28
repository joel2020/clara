# Google Login and Open Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any authenticated Google or email/password user enter Clara while preserving admin-only coach and instructor access.

**Architecture:** Supabase remains the identity provider and row-level security remains the data-isolation boundary. The app-wide gate and authenticated paid routes will require a valid session but no student email allowlist; the separate admin email list will continue protecting coach and instructor capabilities. Google OAuth remains environment-gated until its Supabase and Google configuration is live.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth/Postgres/RLS, Node test runner, Vercel

## Global Constraints

- Any authenticated Supabase user may use the student application and its authenticated API routes.
- Coach and instructor screens and APIs remain restricted to the existing administrator emails.
- Existing email/password accounts, user IDs, and student data remain unchanged.
- Supabase row-level security continues to isolate each user's records by authentication user ID.
- Email/password login remains usable if Google OAuth is unavailable.
- Authentication and recovery copy remains bilingual Spanish/English.

---

### Task 1: Remove the student allowlist without weakening authentication

**Files:**
- Create: `lib/allowlist.test.mjs`
- Modify: `lib/allowlist.ts`
- Modify: `lib/auth-server.ts`
- Modify: `components/auth-gate.tsx`

**Interfaces:**
- Consumes: `getAuthedUser(request: Request): Promise<User | null>` and `isAdmin(email): boolean`
- Produces: `requireUser(request: Request): Promise<Response | null>` that accepts every valid Supabase user, and `ADMIN_EMAILS`/`isAdmin` as the sole email-based authorization boundary

- [ ] **Step 1: Write a failing access-policy test**

Create `lib/allowlist.test.mjs` with assertions that the admin list still recognizes the two administrators, rejects an ordinary student, and that the student-level `ALLOWED_EMAILS` and `isAllowed` exports no longer exist:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAdmin } from "./allowlist.ts";

let ok = 0;
function check(name, fn) {
  try {
    fn();
    ok += 1;
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

check("recognizes the first administrator", () =>
  assert.equal(isAdmin("alivio.studio.ops@gmail.com"), true));
check("recognizes the second administrator case-insensitively", () =>
  assert.equal(isAdmin(" JOELCARIAS23@GMAIL.COM "), true));
check("does not grant admin access to an ordinary user", () =>
  assert.equal(isAdmin("new.student@example.com"), false));

const source = readFileSync(new URL("./allowlist.ts", import.meta.url), "utf8");
check("does not retain a student allowlist", () => {
  assert.doesNotMatch(source, /ALLOWED_EMAILS/);
  assert.doesNotMatch(source, /function isAllowed/);
});

console.log(`${ok} ok`);
```

- [ ] **Step 2: Run the policy test and verify it fails**

Run: `npx tsx lib/allowlist.test.mjs`

Expected: FAIL because `ALLOWED_EMAILS` and `isAllowed` still exist.

- [ ] **Step 3: Remove the student allowlist exports**

Reduce `lib/allowlist.ts` to the administrator policy:

```ts
// The teachers who can see the whole roster in the coach cockpit and use
// instructor tools. Student access is open to every authenticated account.
export const ADMIN_EMAILS = ["alivio.studio.ops@gmail.com", "joelcarias23@gmail.com"];

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
```

- [ ] **Step 4: Make the app gate session-only**

In `components/auth-gate.tsx`, remove the `isAllowed` import and the branch that renders the no-access screen. Keep loading, reset-password, OAuth-callback, unauthenticated login, and authenticated child rendering unchanged.

- [ ] **Step 5: Make paid routes session-only**

In `lib/auth-server.ts`, remove the `isAllowed` import and the final `403 not_allowed` branch in `requireUser`. Keep the production fail-closed behavior for missing Supabase configuration and the `401 unauthorized` response for invalid or missing sessions.

- [ ] **Step 6: Run the policy test and full unit suite**

Run: `npx tsx lib/allowlist.test.mjs && npm test`

Expected: the policy test reports `4 ok`, and every unit-test file passes.

- [ ] **Step 7: Commit the access-policy change**

```bash
git add lib/allowlist.test.mjs lib/allowlist.ts lib/auth-server.ts components/auth-gate.tsx
git commit -m "Auth: open student access to every signed-in user"
```

### Task 2: Align Google OAuth UI and documentation with open access

**Files:**
- Modify: `components/login-screen.tsx`
- Modify: `components/oauth-callback-screen.tsx`
- Modify: `lib/hooks/useAuth.tsx`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: `signInWithGoogle(): Promise<{ error: string | null }>` and `/auth/callback`
- Produces: a Google login button gated by `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"` with no allowlist-related messaging

- [ ] **Step 1: Find stale allowlist promises in the OAuth flow**

Run:

```bash
rg -n "allowlist|allow-listed|approved account|approved email|only a signed-in" components/login-screen.tsx components/oauth-callback-screen.tsx lib/hooks/useAuth.tsx README.md .env.example
```

Expected: matches in comments or user-facing copy that describe student access as allowlisted.

- [ ] **Step 2: Update the OAuth comments and user-facing access copy**

Change the matched text so it states:

- any signed-in user can enter the student app;
- paid API routes still require a valid session;
- coach and instructor tools remain admin-only;
- Google and email/password are both supported.

Do not change the existing bilingual Google failure and retry behavior.

- [ ] **Step 3: Document production configuration**

In `README.md`, add a concise Google OAuth setup section listing:

```text
1. Enable Google under Supabase Authentication → Providers.
2. Put the Supabase provider callback URL in the Google OAuth client's authorized redirect URIs.
3. Add https://clara-joel-carias-projects.vercel.app/auth/callback and
   http://localhost:3000/auth/callback to Supabase redirect URLs.
4. Set NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true only after the provider works.
```

- [ ] **Step 4: Verify types, lint ratchet, tests, and production build**

Run: `npm run verify`

Expected: TypeScript passes, the lint count does not increase, every unit test passes, and the Next.js production build completes.

- [ ] **Step 5: Commit the OAuth copy and documentation**

```bash
git add components/login-screen.tsx components/oauth-callback-screen.tsx lib/hooks/useAuth.tsx .env.example README.md
git commit -m "Docs: align Google login with open student access"
```

### Task 3: Configure Google OAuth in Supabase and production

**Files:**
- Modify externally: Clara Supabase project `nwjtvlvzbfrlzgxiqzgd`
- Modify externally: Google Cloud OAuth client used by Supabase
- Modify externally: Vercel project `clara`

**Interfaces:**
- Consumes: Supabase provider callback URL and Clara callback URLs
- Produces: a working Google OAuth redirect in production with `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`

- [ ] **Step 1: Open Clara's Supabase authentication provider settings**

Using the user's authenticated browser, open the Clara Supabase project and navigate to Authentication → Providers → Google. Record the displayed Supabase callback URL without exposing the client secret in logs or chat.

- [ ] **Step 2: Configure or create the Google OAuth web client**

In Google Cloud Console, configure the OAuth consent screen if required, then configure a Web application OAuth client. Add the exact Supabase callback URL from Step 1 as an authorized redirect URI. Copy the client ID and client secret directly into Supabase without displaying either secret.

- [ ] **Step 3: Enable Google in Supabase**

Enable the Google provider, save the client ID and client secret, and confirm the provider remains enabled after the page refreshes.

- [ ] **Step 4: Configure Supabase application URLs**

Set the production site URL to:

```text
https://clara-joel-carias-projects.vercel.app
```

Add these redirect URLs:

```text
https://clara-joel-carias-projects.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

- [ ] **Step 5: Enable the production login button**

In Vercel project `clara`, set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` for Production and Preview. Trigger a production deployment from the commit containing Tasks 1 and 2, following the repository's existing deployment policy.

- [ ] **Step 6: Verify the production flow**

Open the production login page and confirm:

- the Google button is visible;
- selecting it reaches Google's account chooser;
- a Google account not previously on the student allowlist returns to Clara and enters the student app;
- that ordinary account cannot access coach or instructor features;
- an existing administrator still can;
- email/password controls remain visible and usable.

- [ ] **Step 7: Record operational state**

Update the Clara Obsidian overview to state that Google OAuth is enabled, student access is open to every authenticated account, the admin emails remain restricted, and list the verification date without recording any secret values.

- [ ] **Step 8: Commit any final repository documentation update**

If the verification reveals a repository documentation adjustment, commit only that documentation:

```bash
git add README.md
git commit -m "Docs: record live Google authentication"
```
