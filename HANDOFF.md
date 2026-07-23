# Clara — Session Handoff

Paste the prompt below into a fresh Claude Code session (run from `~/clara`) to
continue where the last session left off. Last updated: 2026-07-23.

---

```
Continue work on Clara — my gamified American-English pronunciation app for
native Colombian-Spanish speakers (students: Mariana, Valentina; I'm Joel,
teacher/admin). Local repo: ~/clara. Live: clara-joel-carias-projects.vercel.app
Repo: github.com/joel2020/clara (auto-deploys on push to main). Read my memory
file clara-pronunciation-app.md for full history before starting.

CURRENT STATE (all shipped + verified live as of 2026-07-23):
- Secure multi-user Supabase Auth + server-side allowlist (lib/allowlist.ts).
- Per-user RLS is LIVE (anon key reads nothing — verified). Analytics events
  table live. Coach cockpit reads across students via SUPABASE_SERVICE_ROLE_KEY.
- Full curriculum A0 -> C2, including the new C1-C2 "mastery" tier
  (lib/content/conversation-4.ts: diplomatic, idioms, professional, persuade,
  abstract, humor) with ElevenLabs Joel-voice audio + 6 Higgsfield cinematic
  scene loops + a Joel "teaching" avatar clip.
- Login screen: bigger uncropped Lumi + in-app "resend confirmation" button.

OPEN ITEMS (in priority order):
1. PRODUCTION-READINESS GATE — confirm a real signed-in user can READ their own
   data under RLS. Anon lockout is verified; a real login (Mariana) confirming
   her stars/progress load is the one thing that proves RLS didn't lock real
   users out. If it fails, the data is intact — it's a policy/binding fix.
2. LOGIN: email confirmation is ON (mailer_autoconfirm:false) so new accounts
   must confirm via email before first sign-in. I want it turned OFF in Supabase
   (Auth -> Email provider -> Confirm email) since the allowlist is the real
   gate. Help me do this / confirm joelcarias23@gmail.com can then log in.
3. onboarding.level is local-only — sync it to a cloud column so the coach can
   show each student's CEFR level.

KEY CONSTRAINTS (do not violate):
- Never use emojis in any written output or drafted copy.
- Act directly, don't ask permission for routine steps.
- Vercel commits MUST be authored 46899218+joel2020@users.noreply.github.com
  (else deploy blocks). End commit bodies with the Claude co-author line.
- Never commit/print secrets (.env.local is gitignored, has only anon key).
- Audio = ElevenLabs (Joel voice); images = OpenAI gpt-image-1; video =
  Higgsfield MCP + ffmpeg (mp4 libx264 crf30 + webm vp9 + jpg poster).
- The connected Supabase MCP is pinned to my Elite Funding CRM project, NOT
  Clara (nwjtvlvzbfrlzgxiqzgd) — it can't run Clara DDL; use the SQL editor.
- I don't want accounts created or passwords typed on my behalf.

Start by reading clara-pronunciation-app.md, then tell me the plan for item 1.
```
