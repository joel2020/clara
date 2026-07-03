# Clara — English pronunciation practice

A warm, interactive pronunciation course built for a native **Colombian Spanish speaker** working toward fluent, conversational English. The instructor teaches live; Clara is the app she drills with between sessions.

Every lesson is built around the specific sounds Spanish speakers struggle with, and the core loop is simple: **hear the native model → distinguish it → say it → get scored on what the app actually heard.**

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Build for production:

```bash
npm run build && npm start
```

No accounts, no database, no environment variables — it works the moment it loads. All progress is stored locally in your browser (IndexedDB).

### The native voice is Joel's voice

The "Listen" model for every built-in word and phrase is **Joel's own cloned voice**, pre-generated with ElevenLabs and served as static MP3s from `public/audio/` (~2 MB total, works offline and in every browser). "Slow" plays the same clip at 0.65×. Custom words you add in Instructor mode fall back to the browser's `SpeechSynthesis` voice.

**Regenerating the voice clips** (after editing the curriculum, or to change the voice):

```bash
# Needs ELEVENLABS_API_KEY in .env.local (git-ignored). The Joel voice id is
# ELEVENLABS_JOEL_VOICE_ID; omit to use the default.
node scripts/generate-audio.mjs          # generate any missing clips
node scripts/generate-audio.mjs --force  # regenerate everything
```

This rewrites `lib/content/audio-manifest.ts` with the list of clips that exist; the player checks it to decide between Joel's voice and the browser fallback. Audio generation goes through the same ElevenLabs account as the `elevenlabs` MCP server (see `~/elevenlabs-mcp-server`).

> Note: ElevenLabs reads each word in isolation, so stress-pair words spelled the same (e.g. *PREsent* the noun vs *preSENT* the verb) may sound similar — the IPA and mouth hint carry that distinction, and you teach it live. Regenerate an individual clip any time it doesn't sound right.

### Install it (PWA)

Clara is an installable Progressive Web App. On iPhone: open the site in Safari → Share → **Add to Home Screen**. It launches fullscreen with its own icon, and practiced audio is cached for **offline** use (service worker in `public/sw.js`). Icons and manifest live in `public/`.

### Scoring works on iPhone too

Recording/scoring uses the browser's **Web Speech API** where available (desktop Chrome — instant and free). **iOS Safari has no Web Speech API**, so there it records with `MediaRecorder` and transcribes server-side via **ElevenLabs Scribe** (`app/api/transcribe/route.ts`, which needs `ELEVENLABS_API_KEY` set in the deployment env). The client picks the method automatically (`lib/speech/recognition.ts` → `createRecognition`). Playback (Joel's voice) works everywhere.

### Browser support

| Feature | What it does | Support |
| --- | --- | --- |
| `SpeechSynthesis` | Plays the native voice model (Listen / Slow) | Chrome, Edge, Safari |
| `SpeechRecognition` | Records her attempt and scores it | **Chrome / Edge only** |

The app **degrades gracefully**: if recognition isn't available, she can still listen and move through words; if synthesis isn't available, she can still record. A friendly banner explains what's missing and points to Chrome. The first recording will ask for **microphone permission** — that's expected.

---

## The interaction loop

For every word or phrase:

1. **See it** — the word, its IPA, and a plain-English mouth-position hint (e.g. *"Smile wide, pull your lips back, tongue high. A long 'eeee'."*).
2. **Listen** — `SpeechSynthesis` speaks it. Replay freely, or hit **Slow** to hear it at 0.55×.
3. **Record** — `SpeechRecognition` captures her speech and scores how close the transcript is to the target. She sees a clear **Got it! / Almost** result, the score, and **what it heard** — so a mismatch (especially landing on the minimal-pair twin) is visible and teachable.
4. **Track** — every attempt is saved per sound, feeding the dashboard and spaced repetition.

Every built-in lesson is a **full lesson** that runs in stages (a stepper at the top shows where you are):

1. **Learn** — a short mini-class before any drilling: what the sound is, why it trips up Spanish speakers, how to physically make it, with tappable Joel-voice examples.
2. **Ear** — minimal-pair lessons train listening first ("Which word did you hear?").
3. **Words** — the core listen → speak → score loop, SRS-ordered.
4. **Sentences** — the same sound inside real connected speech (3 sentences per lesson, each with a rhythm tip), so it transfers out of isolated words.

Stages a lesson doesn't have are skipped automatically; custom Instructor-mode lessons run drill-only.

---

## Curriculum

Lessons are organized by the contrast sets that trip up Spanish speakers. **Short i vs Long ee** is the fully-built flagship; every other lesson follows the same pattern.

1. **/ɪ/ vs /iː/** — ship/sheep, bit/beat, fill/feel, live/leave, sit/seat (minimal pairs)
2. **/b/ vs /v/** — berry/very, ban/van, boat/vote, base/vase
3. **/dʒ/ vs /j/** — jail/Yale, jet/yet, joke/yolk, jam/yam
4. **/θ/ and /ð/** — think, three, both / this, the, mother, breathe (+ think/sink, thin/tin traps)
5. **/h/** — hat, house, behind … and silent-h traps: hour, honest, honor
6. **s-cluster onsets** — speak, school, student, Spain, street (start clean, no "espeak")
7. **-ed endings** — /t/ walked · /d/ played · /ɪd/ wanted
8. **final consonant clusters** — texts, asked, world, films, helped
9. **schwa /ə/** — about, banana, the, problem, supply
10. **word stress** — PHOto vs photoGRAPHy, a REcord vs to reCORD
11. **connected speech** — "She sells seashells…", "I've been thinking about it" (rhythm & linking)

---

## Features

- **Lessons** with progress per lesson and per sound (words mastered / total).
- **Spaced repetition** (Leitner boxes): missed words resurface within the same session; mastered ones space out to days. A **Review** queue on the home screen surfaces everything currently due across all lessons.
- **Weak Sounds dashboard** — accuracy by sound category, weakest first, with all-time vs recent comparison and a dot-trend of the last attempts.
- **The game layer** (`lib/gamification.ts` — pure, unit-tested):
  - **XP & levels** — +10 per clear word (+2 for trying), combo bonuses for consecutive clears, levels that stretch as she climbs. A level ring, streak flame, and daily-goal ring live in the player bar on the home screen and dashboard.
  - **Combos** — a "3× combo" chip during sessions, higher-pitched success chimes as the streak heats up.
  - **Daily streak & goal** — practice every day to keep the flame; a configurable XP goal per day (default 40) with a toast when she crosses it.
  - **12 achievements** — from *First words* to *Flawless* (perfect lesson) and *Sound master* (every word in a sound mastered), unlocking with toasts and displayed on the dashboard.
  - **Speed round** (`/play`) — 15 rapid-fire words from everything or one sound; keep the combo alive, beat your best.
  - **Celebrations** — confetti pops on clear words, a full burst + overlay on level-ups, on-brand colors, all `prefers-reduced-motion`-aware; tiny synthesized sound effects (Web Audio, no assets) with a mute toggle in the header.
- **Instructor mode** (gated behind a header toggle, no auth):
  - Add custom words/phrases as mini-lessons (`text | ipa | mouth hint`, one per line) — they appear in her lesson list and feed the same SRS + dashboard.
  - **Recent attempts** feed — exactly what to target in the next live session (target → what was heard → score).
  - **Voice & audio** — choose the playback voice, set the default speed, or reset all local data.
- **Sentence/phrase mode** for connected speech and rhythm, alongside single-word drills.

---

## Architecture

```
app/                     Next.js App Router pages (home, lesson, review, dashboard, instructor)
components/
  practice/              The core loop: listen, distinguish, produce, session orchestration
  ui/                    shadcn/ui primitives
  ...                    lesson list, dashboard, instructor panels, header
lib/
  db/                    Data layer (see "Swapping to Supabase" below)
    types.ts             Backend-agnostic domain types
    repository.ts        DataRepository interface — the single contract
    dexie.ts             IndexedDB schema (the only Dexie-aware file)
    dexie-repository.ts  Local-first implementation
    index.ts            <- the swap point: `export const repo = new DexieRepository()`
  content/               Curriculum data (categories + lessons)
  speech/                Web Speech API wrappers: synthesis, recognition, scoring, support
  srs.ts                 Leitner spaced-repetition logic
  practice.ts            Ties scoring + SRS + persistence together for one attempt
  hooks/                 Reactive read hooks + settings provider
types/speech.d.ts        Ambient types for SpeechRecognition (not in TS's DOM lib)
```

**Design principle:** components never touch the database directly. They go through the `DataRepository` interface (writes) and the hooks in `lib/hooks/useData.ts` (reactive reads). The data layer is the only thing that knows storage exists.

### Swapping to Supabase later (cross-device sync)

The whole point of the abstraction: moving off local-first is a contained change.

1. Build a `SupabaseRepository` that implements the same `DataRepository` interface (`lib/db/repository.ts`).
2. Change one line in `lib/db/index.ts`:
   ```ts
   export const repo: DataRepository = new SupabaseRepository(client);
   ```
3. Reimplement the reactive hooks in `lib/hooks/useData.ts` with Supabase realtime or polling.

No component, no page, and no curriculum code changes. The domain types in `lib/db/types.ts` map cleanly to SQL tables (`attempts`, `progress`, `custom_lessons`, `settings`).

---

## Tech stack

- **Next.js (App Router)** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (base-ui)
- **Dexie** (IndexedDB) for local-first persistence
- **Web Speech API** for playback and recognition
- Deployable to **Vercel** out of the box

---

## Deploying to Vercel

```bash
npm i -g vercel
vercel
```

It's a standard Next.js app with no server-side secrets, so it deploys with zero configuration. Recognition requires **HTTPS** (Vercel provides it automatically) and a microphone-permission grant.

---

## Notes for the instructor

- Flip **Instructor** on (top-right) to reach the builder and the attempts feed.
- The attempts feed shows you her real misses — including when the recognizer heard the *wrong* minimal-pair word — so you know exactly what to drill live.
- Add a quick custom mini-lesson for vocabulary that's relevant to her week; it'll resurface on the same spaced-repetition schedule.
- All data lives in *her* browser. "Reset data" (Instructor → Voice & audio) wipes it. Cross-device sync is the Supabase upgrade described above.
