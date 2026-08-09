# Coffee visual-learning Preview evidence

Evidence date: 2026-08-09

Release scope: café story → object discovery → speaking → pronunciation feedback

Release decision: **Preview validation in progress; production promotion is not approved.**

## Pilot candidate deployment record

| Field | Evidence |
| --- | --- |
| Immutable Preview | `https://clara-8i2pys6sb-joel-carias-projects.vercel.app` |
| Deployment ID | `dpl_4WYtUu3t9aWnAYGyXGSrRVHHwAtp` |
| State / target | `READY` / Preview (`target: null`) |
| Exact commit | `a6e00aec7eec5ef4966f8419a272f4016ea707fc` |
| Branch | `codex/clara-production-foundation` |
| Project runtime | Node `24.x` |
| Remote build | Passed; Vercel reported 18 seconds |
| Runtime error scan | Immediate scan of the preceding 30-minute window found no error clusters |
| Production action | None: no production deploy, promotion, alias, or domain change |

The clean worktree and exact commit were checked before deployment. The immutable lesson
route returned HTTP 200 through Vercel's authenticated Preview fetch.

The prior immutable deployment
`https://clara-5k7zds0mr-joel-carias-projects.vercel.app` at commit `5eb2a20` remains
available as historical evidence but is superseded by the pilot candidate above.

## Local release gate

`npm run verify` passed on Node `24.19.0` before deployment:

- typecheck passed;
- lint ratchet remained at zero errors;
- 55 contract-test files completed 23,993 checks;
- 7 Vitest files completed 52 component tests;
- contextual asset and initial payload budgets passed;
- production dependency audit reported zero vulnerabilities at the configured gate;
- the Next.js production build passed.

## Environment and data boundary

The Vercel Preview environment contains the Supabase, chat, speech, reminder, cron, and
allowlist variable names required by the existing admin health check. Values were neither
printed nor committed. No Preview variable name contains `HIGGSFIELD`; Higgsfield remains
an offline asset-production tool only.

The Supabase ref embedded in the pilot candidate's deployed public client is
`nwjtvlvzbfrlzgxiqzgd`. The official Auth health endpoint for that ref returned HTTP 200
using the deployed public credential without printing or storing its value. This verifies
app-linked Supabase Auth reachability.

The connected Supabase Management tool currently exposes only
`bqkzumrkithcebvhiqps`. Because the refs do not match, no SQL or data operation was run
against the connected project. Database SQL connectivity, project metadata, and advisors
for the app-linked ref remain pending through the connector.

## Preview browser gate

The pilot candidate was independently opened at 390×844. It rendered the expected Google
sign-in gate, exposed an accessible DOM, and produced no browser console warnings or
errors. No new screenshot was recorded for that probe.

The four screenshots below belong to the earlier immutable Preview at commit `5eb2a20`.
That route loaded successfully at all four requested browser viewports, and the Google
sign-in screen rendered without horizontal overflow. The automation did not start OAuth
or transmit account credentials. They remain useful historical authentication-gate
evidence but are not screenshots of the current pilot candidate. Preview feature
screenshots of story, selected-coffee discovery, speaking, passing/retry feedback, and
image/audio fallbacks remain blocked on an authenticated test session.

| Requested viewport | Preview result | Evidence |
| --- | --- | --- |
| 320×568 | Sign-in gate; no horizontal overflow (`innerWidth=320`, `scrollWidth=305`) | `screenshots/preview-login-320x568.jpg` |
| 390×844 | Sign-in gate; no horizontal overflow (`innerWidth=390`, `scrollWidth=390`) | `screenshots/preview-login-390x844.jpg` |
| 768×1024 | Sign-in gate; no horizontal overflow (`innerWidth=768`, `scrollWidth=768`) | `screenshots/preview-login-768x1024.jpg` |
| 1440×900 | Sign-in gate; no horizontal overflow (`innerWidth=1440`, `scrollWidth=1440`) | `screenshots/preview-login-1440x900.jpg` |

Separate local-development browser captures exercised story, discovery, speaking, and a
second phrase. They are diagnostic evidence only and are not represented here as Preview
passes.

## Manual and learner gates

The following are not complete and must not be inferred from automated checks:

- real iPhone Safari and Android Chrome coverage;
- desktop WebKit coverage where required;
- one real screen-reader pass;
- the complete human keyboard, 200% zoom, reduced-motion, constrained-network, and
  real-device checklist;
- six adult LATAM learner sessions;
- the hard gate of at least five unaided completions with no unresolved P0 issue.

Authenticated Preview feature capture is also pending because the app-level Google sign-in
gate prevented lesson entry during the automated session.

The pilot template deliberately records every participant as pending. It contains no
names, emails, recordings, transcripts, quotations, or sensitive demographics.
