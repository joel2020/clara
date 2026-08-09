# Production Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Clara's current production trust blockers before new learning or visual systems build on them.

**Architecture:** Security-sensitive decisions move into small pure modules with boundary tests. Authentication becomes invite-only and fail-closed, identity and microphone disclosures match runtime behavior, browser headers are centralized, and database admin authorization uses one Supabase app-metadata role.

**Tech Stack:** Next.js 16.3.0, React 19, TypeScript, Supabase Auth/Postgres, GitHub Actions, Sentry, Vercel.

## Global Constraints

- Preserve current learner data and API contracts unless a task explicitly versions them.
- `ADMIN_EMAILS` is retired after app-metadata role rollout; no student or admin emails enter source control.
- The canonical admin claim is `app_metadata.clara_role === "admin"`.
- The invite-only learner allowlist protects both the UI gate and every paid API route.
- Voice copy must disclose automatic microphone activation between virtual-call turns.
- Do not weaken CSP or route guards to make a test pass.

---

### Task 1: Patch dependencies and pin the runtime

**Files:**
- Create: `.nvmrc`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `next.config.ts`

**Interfaces:**
- Produces: `npm run audit:prod`, Node 24 runtime pin, Next.js 16.3.0.
- Consumes: existing `npm run verify` pipeline.

- [ ] **Step 1: Record the failing production audit**

Run:

```bash
npm audit --omit=dev --audit-level=high
```

Expected: non-zero with the current high-severity Next/PostCSS/Sharp and transitive findings.

- [ ] **Step 2: Upgrade the patched framework tree**

Run:

```bash
npm install next@16.3.0 eslint-config-next@16.3.0
npm audit fix
```

Expected lockfile resolutions include Sharp 0.35.3, Undici 7.29.0, PostCSS above
8.5.22, Nanoid 3.3.18, JS-YAML 4.3.1, IP Address 10.4.0, Hono 4.13.1,
Fast URI 3.1.5, and Brace Expansion 5.0.9 or newer patched equivalents.

- [ ] **Step 3: Pin Node and add the audit gate**

Create `.nvmrc`:

```text
24
```

Add to `package.json`:

```json
"engines": { "node": "24.x" },
"scripts": {
  "audit:prod": "npm audit --omit=dev --audit-level=high",
  "verify": "npm run typecheck && npm run lint:ratchet && npm test && npm run audit:prod && next build"
}
```

Change CI `node-version` from `22` to `24` and insert `npm run audit:prod` after tests.

- [ ] **Step 4: Fix the local workspace-root warning**

Add this property to `next.config.ts` without changing the build ID logic:

```ts
turbopack: { root: process.cwd() },
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm ci
npm run verify
```

Expected: audit has no high/critical findings and the full verification pipeline exits 0.

```bash
git add .nvmrc package.json package-lock.json .github/workflows/ci.yml next.config.ts
git commit -m "build: patch dependencies and pin Node 24"
```

### Task 2: Enforce invite-only learner access

**Files:**
- Create: `lib/auth-access.test.mjs`
- Modify: `lib/allowlist.ts`
- Modify: `lib/auth-server.ts`
- Modify: `app/api/me/route.ts`
- Modify: `components/auth-gate.tsx`
- Modify: `README.md`
- Modify: `PRODUCTION.md`

**Interfaces:**
- Produces: `requireAllowedUser(request: Request): Promise<Response | null>`.
- Produces: `/api/me` response `{ authed, allowed, admin }` sourced from the same policy.
- Consumes: `getAuthedUser(request)` and `isAllowed(email)`.

- [ ] **Step 1: Write failing access tests**

Add test cases that prove:

```js
assert.equal(isAllowed("student@example.com"), true);
assert.equal(isAllowed("stranger@example.com"), false);
assert.equal(accessFlags({ email: "stranger@example.com", app_metadata: {} }).allowed, false);
assert.equal(accessFlags({ email: "teacher@example.com", app_metadata: { clara_role: "admin" } }).admin, true);
```

Also assert production with missing `ALLOWED_EMAILS` denies every non-admin account.

- [ ] **Step 2: Run the focused test and confirm failure**

```bash
node --experimental-strip-types lib/auth-access.test.mjs
```

Expected: FAIL because `accessFlags` and `requireAllowedUser` do not exist and `/api/me`
currently reports every authenticated account as allowed.

- [ ] **Step 3: Implement one access policy**

Add to `lib/allowlist.ts`:

```ts
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
```

Implement `requireAllowedUser` in `lib/auth-server.ts`: preserve 503 for missing production
auth, return 401 without a valid session, return 403 with `{ error: "not_allowed" }` when
`accessFlags(user).allowed` is false, and otherwise return null.

Use it in all paid routes currently calling `requireUser`; keep `requireUser` only for
routes intentionally available to any authenticated account. The exact paid route set is
`app/api/assess/route.ts`, `app/api/call-score/route.ts`, `app/api/chat/route.ts`,
`app/api/grade/route.ts`, `app/api/news/route.ts`, `app/api/transcribe/route.ts`,
`app/api/tts/route.ts`, `app/api/virtual-call/report/route.ts`, and
`app/api/virtual-call/turn/route.ts`. Protect push subscription writes in
`app/api/push/route.ts` as well. Make `/api/me` call `accessFlags(user)`.

- [ ] **Step 4: Align UI and documentation**

Ensure `components/auth-gate.tsx` renders the existing no-access state when
`allowed === false`. Rewrite README and PRODUCTION access sections to state that adding a
student requires `ALLOWED_EMAILS` plus redeploy, while admin capability is the Supabase
`clara_role` claim.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types lib/auth-access.test.mjs
npm test
npm run typecheck
git add lib/auth-access.test.mjs lib/allowlist.ts lib/auth-server.ts app/api/me/route.ts app/api/assess/route.ts app/api/call-score/route.ts app/api/chat/route.ts app/api/grade/route.ts app/api/news/route.ts app/api/push/route.ts app/api/transcribe/route.ts app/api/tts/route.ts app/api/virtual-call/report/route.ts app/api/virtual-call/turn/route.ts components/auth-gate.tsx README.md PRODUCTION.md
git commit -m "fix: enforce invite-only learner access"
```

### Task 3: Correct guide identity and microphone consent

**Files:**
- Create: `lib/identity-consent.test.mjs`
- Modify: `lib/content/virtual-call-scenarios.ts`
- Modify: `lib/virtual-call/brain.ts`
- Modify: `components/privacy-notice.tsx`
- Modify: `components/voice-consent-sheet.tsx`
- Modify: `components/virtual-call/ai-disclosure.tsx`
- Modify: `lib/i18n.ts`

**Interfaces:**
- Produces: one student-facing identity: app Clara, AI companion Lumi.
- Produces: consent copy matching automatic turn-by-turn capture.

- [ ] **Step 1: Write failing source-contract tests**

Scan scenario and prompt sources and assert:

```js
assert(!scenarioSource.includes("I'm Clara"));
assert(brainSource.includes("You are Lumi"));
assert(privacySource.includes("automatically"));
assert(consentSource.includes("each turn"));
```

Add Spanish equivalents to the test so both languages disclose automatic activation.

- [ ] **Step 2: Run and observe failure**

```bash
node lib/identity-consent.test.mjs
```

Expected: FAIL on the two scenario introductions and the tap-only privacy statements.

- [ ] **Step 3: Update identity and disclosure copy**

Change the scenario openings to “I'm Lumi.” Keep `brain.ts` explicit that Clara is the
app and Lumi is the AI companion. Privacy and consent must state:

```text
One tap starts the call. After Lumi finishes each turn, Clara automatically opens the
microphone for your reply. It stops on silence, when you press stop or mute, when the
turn reaches 30 seconds, or when the call ends.
```

Add the equivalent natural Spanish copy and name Microsoft/ElevenLabs/OpenAI processing,
ephemeral raw audio, transcript use, and manual cloud-deletion contact.

- [ ] **Step 4: Verify and commit**

```bash
node lib/identity-consent.test.mjs
npm test
git add lib/identity-consent.test.mjs lib/content/virtual-call-scenarios.ts lib/virtual-call/brain.ts components/privacy-notice.tsx components/voice-consent-sheet.tsx components/virtual-call/ai-disclosure.tsx lib/i18n.ts
git commit -m "fix: align Lumi identity and voice consent"
```

### Task 4: Add centralized browser security headers

**Files:**
- Create: `lib/security-headers.ts`
- Create: `lib/security-headers.test.mjs`
- Modify: `next.config.ts`

**Interfaces:**
- Produces: `SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }>`.
- Consumes: Next.js `headers()` configuration.

- [ ] **Step 1: Write failing header tests**

Assert exact presence of CSP directives and headers:

```js
for (const key of [
  "Content-Security-Policy",
  "Referrer-Policy",
  "Permissions-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
]) assert(headers.has(key));
assert(csp.includes("frame-ancestors 'none'"));
assert(permissions.includes("microphone=(self)"));
```

- [ ] **Step 2: Run and confirm failure**

```bash
node --experimental-strip-types lib/security-headers.test.mjs
```

- [ ] **Step 3: Implement the header set**

Export a CSP containing:

```text
default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
media-src 'self' blob:; font-src 'self' data:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
```

Add `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: microphone=(self), camera=(), geolocation=()`,
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, and
`X-Content-Type-Options: nosniff`. Return them from `next.config.ts` for `/(.*)`.

- [ ] **Step 4: Build, smoke-test, and commit**

```bash
npm run build
node --experimental-strip-types lib/security-headers.test.mjs
git add lib/security-headers.ts lib/security-headers.test.mjs next.config.ts
git commit -m "feat: add application security headers"
```

### Task 5: Repair modal, form, and keyboard accessibility

**Files:**
- Modify: `components/voice-consent-sheet.tsx`
- Modify: `app/media/page.tsx`
- Modify: `components/practice/level-up-overlay.tsx`
- Modify: `components/reset-password-screen.tsx`
- Modify: `components/onboarding-flow.tsx`
- Modify: `components/ui/dialog.tsx`
- Create: `lib/accessibility-contract.test.mjs`

**Interfaces:**
- Consumes: existing Base UI dialog primitives from `components/ui/dialog.tsx`.
- Produces: focus-trapped, Escape-dismissible dialogs with focus restoration.

- [ ] **Step 1: Add failing accessibility contracts**

Check that password fields have matching `id`/`htmlFor`, onboarding name has a visible or
screen-reader label plus `name="studentName"` and `autoComplete="name"`, and the three
modal surfaces import the shared dialog primitive instead of declaring raw `role="dialog"`
containers.

- [ ] **Step 2: Run and confirm failures**

```bash
node lib/accessibility-contract.test.mjs
```

- [ ] **Step 3: Migrate dialogs and forms**

Use `Dialog`, `DialogContent`, `DialogTitle`, and `DialogDescription`. Set initial focus
to the primary safe action, preserve Escape and overlay dismissal only where data cannot
be lost, and restore focus to the opener. Replace the level-up clickable `div` with a
dialog containing a real Close button; keep the timer but do not require users to act
within 2.4 seconds.

Associate reset labels to `new-password` and `confirm-password`. Label onboarding name,
remove mobile `autoFocus`, and keep visible focus rings.

- [ ] **Step 4: Verify and commit**

```bash
node lib/accessibility-contract.test.mjs
npm run typecheck
npm test
git add components/voice-consent-sheet.tsx app/media/page.tsx components/practice/level-up-overlay.tsx components/reset-password-screen.tsx components/onboarding-flow.tsx components/ui/dialog.tsx lib/accessibility-contract.test.mjs
git commit -m "fix: make core dialogs and forms accessible"
```

### Task 6: Unify database admin authorization and restore instructions

**Files:**
- Create: `supabase/migration-v5-admin-role.sql`
- Modify: `supabase/current-schema.sql`
- Modify: `lib/allowlist.ts`
- Modify: `app/api/coach/route.ts`
- Modify: `README.md`
- Modify: `PRODUCTION.md`
- Modify: `lib/sync/schema.test.mjs`

**Interfaces:**
- Produces: RLS and server authorization based on `app_metadata.clara_role`.
- Consumes: authenticated Supabase JWT.

- [ ] **Step 1: Add failing schema assertions**

Assert current schema no longer contains literal admin email addresses and contains:

```sql
((select auth.jwt()) -> 'app_metadata' ->> 'clara_role') = 'admin'
```

Also assert README rebuild instructions name only `supabase/current-schema.sql`.

- [ ] **Step 2: Run and confirm failure**

```bash
node lib/sync/schema.test.mjs
```

- [ ] **Step 3: Add and mirror the migration**

Create migration SQL that drops the three email-based custom-lesson write policies and
recreates INSERT/UPDATE/DELETE policies using the claim expression above. Apply the same
definitions to `current-schema.sql`. Update coach/admin route checks to
`isAdminIdentity(user)`.

Rewrite database documentation so a new database is created only from
`current-schema.sql`; label historical migrations as audit history and never default
recovery steps.

- [ ] **Step 4: Verify and commit**

```bash
node lib/sync/schema.test.mjs
npm test
git add supabase/migration-v5-admin-role.sql supabase/current-schema.sql lib/allowlist.ts app/api/coach/route.ts README.md PRODUCTION.md lib/sync/schema.test.mjs
git commit -m "fix: unify admin roles and database recovery"
```

### Task 7: Add scrubbed error and performance observability

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `instrumentation-client.ts`
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`
- Modify: `next.config.ts`
- Modify: `app/global-error.tsx`
- Create: `lib/observability.test.mjs`
- Modify: `PRODUCTION.md`

**Interfaces:**
- Produces: Sentry initialization gated by `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`.
- Produces: scrubbed errors with release `NEXT_PUBLIC_CLARA_BUILD_ID`.

- [ ] **Step 1: Add failing observability contract**

Assert configuration contains `sendDefaultPii: false`, a `beforeSend` scrubber that
removes `authorization`, `cookie`, `email`, `transcript`, and `audio`, and a release ID.

- [ ] **Step 2: Install and configure Sentry**

```bash
npm install @sentry/nextjs
```

Initialize client/server/edge with traces sample rate `0.1` in production and `0` without
a DSN. Capture the error in `app/global-error.tsx` from an effect while retaining the
existing recovery UI. Wrap Next config with `withSentryConfig` and keep source maps
private.

- [ ] **Step 3: Document alerts and environment names**

Document `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, and
`SENTRY_ORG`/`SENTRY_PROJECT`; require alerts for error rate, `/api/assess` latency,
sync failures, and provider spend anomalies. Do not record values.

- [ ] **Step 4: Verify and commit**

```bash
node lib/observability.test.mjs
npm run verify
git add package.json package-lock.json instrumentation-client.ts sentry.server.config.ts sentry.edge.config.ts next.config.ts app/global-error.tsx lib/observability.test.mjs PRODUCTION.md
git commit -m "feat: add scrubbed production observability"
```

### Task 8: Replace instance-local throttling with durable user and global quotas

**Files:**
- Create: `lib/api-quota.ts`
- Create: `lib/api-quota.test.mjs`
- Modify: `lib/api-guard.ts`
- Create: `lib/api-guard.test.mjs`
- Create: `supabase/migration-v6-api-quotas.sql`
- Modify: `supabase/current-schema.sql`
- Modify: `app/api/assess/route.ts`
- Modify: `app/api/call-score/route.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `app/api/grade/route.ts`
- Modify: `app/api/news/route.ts`
- Modify: `app/api/transcribe/route.ts`
- Modify: `app/api/tts/route.ts`
- Modify: `app/api/virtual-call/report/route.ts`
- Modify: `app/api/virtual-call/turn/route.ts`
- Modify: `lib/sync/schema.test.mjs`
- Modify: `PRODUCTION.md`

**Interfaces:**

```ts
export type PaidRoute = "assess" | "call-score" | "chat" | "grade" | "news" |
  "transcribe" | "tts" | "virtual-call-report" | "virtual-call-turn";

export interface QuotaDecision {
  allowed: boolean;
  scope?: "user-day" | "global-minute";
  retryAfterSeconds?: number;
}

export async function consumePaidApiQuota(input: {
  userId: string;
  route: PaidRoute;
  now?: Date;
}): Promise<QuotaDecision>;
```

- [ ] **Step 1: Write failing quota and schema tests**

Prove same-origin validation remains exact, every paid route has an explicit daily-user
budget and global-minute budget, the boundary request succeeds, the next returns 429 with
`Retry-After`, windows reset, concurrent increments cannot both consume the final slot,
and callers fail closed if durable quota storage is unavailable. Assert direct learner
access to quota rows/functions is denied.

- [ ] **Step 2: Confirm current instance-local behavior fails the contract**

```bash
node --experimental-strip-types lib/api-guard.test.mjs
node --experimental-strip-types lib/api-quota.test.mjs
node lib/sync/schema.test.mjs
```

- [ ] **Step 3: Add an atomic Supabase quota function**

Create a private `api_usage_windows` table and a service-role-only
`consume_paid_api_quota` function that atomically consumes both user/day and global/minute
windows. Keep route budgets in one reviewed TypeScript map, pass only an authenticated
user UUID and bounded route ID, and delete expired windows on a scheduled/maintenance
path. Do not store email, transcript, audio, prompt, or raw IP.

- [ ] **Step 4: Guard in the correct order on every paid route**

Validate same origin, require an allowed user, then consume the durable quota before any
provider call. Return a stable 429 body and `Retry-After`; emit only bounded route/scope
metrics. Keep the old in-memory IP window only as optional first-line defense, not the
production quota source of truth.

- [ ] **Step 5: Document provider spend caps and alerts**

Record budget values, expected normal daily usage, emergency-disable procedure, provider
hard spend caps, and alert owner. Do not put provider credentials or account values in
the document.

- [ ] **Step 6: Verify and commit**

```bash
node --experimental-strip-types lib/api-guard.test.mjs
node --experimental-strip-types lib/api-quota.test.mjs
node lib/sync/schema.test.mjs
npm test
npm run typecheck
git add lib/api-quota.ts lib/api-quota.test.mjs lib/api-guard.ts lib/api-guard.test.mjs supabase/migration-v6-api-quotas.sql supabase/current-schema.sql app/api/assess/route.ts app/api/call-score/route.ts app/api/chat/route.ts app/api/grade/route.ts app/api/news/route.ts app/api/transcribe/route.ts app/api/tts/route.ts app/api/virtual-call/report/route.ts app/api/virtual-call/turn/route.ts lib/sync/schema.test.mjs PRODUCTION.md
git commit -m "feat: add durable paid API quotas"
```

## Foundation gate

- [ ] `npm ci && npm run verify` exits 0.
- [ ] Access tests prove stranger 403, allowed learner success, admin role success, and missing config fail-closed.
- [ ] Identity/consent tests contain no student-facing guide-as-Clara or tap-only microphone claim.
- [ ] Header, accessibility, schema, and observability contract tests pass.
- [ ] Durable per-user and global quotas protect every paid route and fail closed.
- [ ] `git status --short` is empty.
