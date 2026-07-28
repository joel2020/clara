# Clara — Premium Design Direction

Date: 2026-07-28 · Branch: `redesign/premium-ui` · Follows: `CLARA-UI-UX-DIAGNOSIS.md`

The positioning this direction serves:

> **Clara helps Colombian Spanish speakers build the English communication skills
> required to qualify for English-speaking jobs.**

Not "a better Duolingo". Not A0→C2 for everyone. The anti-toy: a serious, warm,
Colombian, employment-anchored English coach with a real human voice. Every visual
decision below exists to make that positioning visible within seconds of opening the app.

---

## 1. Brand position — how Clara should *look like what it is*

**Colombian origin without cliché.** Colombia lives in the details, never the wallpaper:
the 3px tricolor bar (already the app's best signature), tricolor dots as label
ornaments, warm Andean-daylight paper tones, Colombian Spanish in the copy voice
(*plata, sin afán, el finde*). No flags as illustration, no coffee-and-toucans scenery,
no folkloric pattern fills. The one place richer Colombian imagery belongs is
*narrative*: workplace scenario art that starts in Medellín and ends on a U.S. call
floor — geography as the learner's journey, not decoration.

**Professional ambition.** The reference class is not language apps — it is the products
an ambitious 22-35-year-old already respects: fintech onboarding, a well-set magazine, a
good CV. Editorial serif display (Fraunces stays), disciplined ink-on-paper contrast,
data set in mono like a well-designed pay stub. The app should feel like *equipment for
getting hired*, with warmth in the voice rather than rounded-cartoon softness.

**Human teaching.** Joel is the product's face and voice; the design treats him as a
person, not a chat avatar: consistent photographic treatment (one duotone/warm grade),
presence states in conversation (listening / thinking / speaking), his voice attached to
teaching moments. Synthetic characters never impersonate humanness: Lumi (if retained as
the warmth sink) is explicitly a drawn companion, in one illustrated style that shares
Clara's palette — never anime-adjacent renders next to his photograph.

**Spoken-English confidence.** The microphone is the hero control of the whole product —
one unmistakable mic pill, one speaking-state animation, one feedback anatomy
(what you said → what landed → the one thing to fix). Audio-first surfaces look
audio-first: waveforms, syllable stress marks, the eq-bars indicator — sound made visible.

**Employability, always visible.** The job goal is the spine of the interface: home says
what today contributes to the goal ("Hoy: 5 frases de tu entrevista"), progress is
phrased as distance-to-hireable ("Nivel entrevista" over "B2 · 80"), and the BPO funnel
(support track → call sim → interview → report) is presented as *the* track, not
scattered routes. The earned report is styled like a document worth printing — because a
recruiter may actually read it.

**Warmth + credibility + adult learning + premium quality.** Warmth comes from language,
photography, and generous rhythm — not from mascot spam or candy gradients. Credibility
comes from honesty made visible: estimated vs earned states styled differently
(hairline/ghost vs solid/inked), numbers that only exist once they mean something.
Premium comes from consistency: one register, one icon system, one motion language,
executed everywhere.

### Prohibited (the costume rack)

Generic SaaS dashboard styling · cartoon-child aesthetics · flags beyond the bar/dots
signature · emoji as production icons · purple-AI gradients · glassmorphism without a
job · Duolingo path/mascot imitation · random cinematic decoration (letterbox cutscenes,
light-ray spins) · overloaded dashboards · gamification that infantilizes (chest-shakes,
gacha sparkle, free-currency drops). The existing "anime study-game layer" and "arcade
polish" CSS layers are scheduled for removal, not refinement.

---

## 2. Design principles (govern every future decision)

1. **One confident next step.** Every screen has exactly one dominant action; everything
   else is visibly subordinate. If two elements compete, one is wrong.
2. **Progress must mean something.** No number appears before it has a denominator worth
   trusting; estimated and earned are visually distinct; zeros are replaced by promises
   ("En 2 semanas: tu primera conversación con Joel").
3. **Spanish supports; it does not compete.** One language leads per surface (the
   learner's setting), the other appears as *gloss*, styled as gloss — smaller, muted,
   never doubled labels.
4. **Human warmth over synthetic spectacle.** Joel's photo and voice, real scenario
   art, one drawn companion — never effects standing in for feeling.
5. **The job stays on screen.** Every major surface can answer "¿qué tiene que ver esto
   con conseguir trabajo?" in one glance.
6. **Reward effort like an adult.** Celebration is a stamp, not a slot machine: one
   signature moment (tricolor stamp/underline), quiet everywhere else, honest everywhere.
7. **Calm during failure.** Errors, empty mics, dead networks get the same warm
   editorial voice as success — designed states, never raw strings, never blame.
8. **Motion communicates state.** Animation exists to say *listening, thinking, saved,
   earned, next* — if a motion says nothing, it goes. Reduced-motion is a first-class
   rendering, not a kill switch.

---

## 3. Information architecture

### Target model (four spaces + immersive sessions)

| Space | Job | Answers |
|---|---|---|
| **Hoy** (home = today, merged) | Start the one right session; see why it matters today | What now? Why? What next? |
| **Camino** | The ladder: units, exams, the job track, what's blocked and why | How am I improving? What's blocking me? How close to the goal? |
| **Hablar** | All conversation with Joel: scenarios, la llamada, duets | Where do I practice speaking? |
| **Yo** | Identity, progress detail, streak, stars, Lumi/shop, settings entry | Who am I here, what have I built? |

Immersive sessions (lesson player, drills, talk session, call, exam, placement) are
*modal experiences* launched from those spaces — full-screen, no tabs, one exit.

### What this dissolves

- **Inicio vs Hoy** — one surface. Home *is* today (greeting + today's objective +
  start). The current Home hero/HUD/quests stack merges into it.
- **/listen /build /shadow /play /radio /duet as destinations** — become *modes of one
  practice engine*, dealt by Hoy ("Paso 2: Oído — 8 frases") and by weak-skill callouts
  in Camino/Yo. Radio folds into Hablar or Yo as a passive extra; Duet into Hablar.
- **/mundo + /dashboard + /profile** — one **Yo** with sections (perfil, progreso,
  sonidos, constancia, Lumi). Dashboard's per-sound insight becomes a Yo section in the
  learner's language.
- **/call + /exam + /report** — presented inside Camino as the job track's stations
  (practice the call → prove the level → earn the report), while remaining reachable
  from Hablar (la llamada) where it is also a speaking mode.

### Route-level reality on this branch

Deleting/merging routes touches business logic and Phase 0 surfaces, so **this branch
implements the target IA as presentation only**: the four-tab navigation, Hoy's merged
presentation, shared practice/session shells, and Yo's unified presentation as preview
surfaces + reusable components. The route mergers themselves (redirects, state moves,
deleted pages) are specified below as an integration proposal.

**Integration proposal (post-Phase-0, separate PRs):**
1. `/today` content renders at `/`; `/today` 301s to `/`. (Move `TodaySession`
   composition into `app/page.tsx`; no logic change — both read the same stores.)
2. `/mundo`, `/dashboard` fold into `/profile` (rename presented as "Yo"); old routes
   redirect. Dexie/live-query hooks move untouched.
3. Drill routes stay as URLs (deep links, PWA shortcuts) but leave nav; their pages
   render the shared `PracticeShell` with mode param; Hoy links carry `?session=today`
   context.
4. `/radio`, `/media` demote to cards inside Yo/Hablar pending Phase 0's content-policy
   decision on media.
5. Required interface from business logic (documented, not built here): a
   `todayPlan()` selector that returns the ordered session steps with per-step drill
   modes — exists today inside `/today`'s page logic; needs extraction to be reused by
   the merged home.

---

## 4. Navigation

### Mobile (≤ lg): bottom tab bar, 4 tabs

```
[ Hoy ]  [ Camino ]  [ Hablar ]  [ Yo ]
```

- 4 destinations, 56px row + safe-area inset, labels always visible, active = color +
  filled icon variant + 2px top indicator (not color-only).
- **Hoy** is the leftmost and the app's start state. There is exactly one
  "start learning" entry in the whole chrome.
- **Hablar** gives direct access to speaking practice from anywhere — one tap.
- Tab bar shows on the four spaces and their subsections; immersive sessions hide it
  (keep current `SHOW_ON` mechanism, inverted to an explicit immersive list).
- Tap targets ≥ 48px; `aria-current="page"`; tabs are `<nav aria-label>`ed links.
- The tablet gap closes: tab bar persists through `lg` (1024px) instead of dying at 768.

### Desktop (≥ lg): left rail or top nav with the same four + secondary cluster

Same four primary items in the header (Hoy · Camino · Hablar · Yo), wordmark left,
secondary cluster right: sound toggle, settings gear. **Instructor toggle moves out of
the shared header** into `/coach` (visible only there for admins) — learners never see
coach chrome. Desktop content: the mobile column centered at a comfortable measure
(~720px) with real margins; no desktop-specific features this phase.

### Secondary/demoted

Settings: gear in header (all sizes) + row in Yo. Shop/Lumi: section of Yo. Review
(repaso): dealt by Hoy as warmup; also a card in Camino when the queue is non-empty —
never a tab.

---

## 5. The core daily loop (the screen-by-screen ideal)

1. **Open Clara** → Hoy: "Buenos días, Valentina." + today's promise in one sentence
   ("Hoy: 5 frases para atender una llamada — 12 min") + one button: **Empezar**.
   Below, quiet: streak state, yesterday's win ("Ayer dominaste 'I can help with
   that'"). Nothing else competes.
2. **Understand the objective** → the session intro card names the payoff in job terms,
   with Joel's voice available ("¿Por qué esto? En una llamada real, el saludo decide
   el tono.").
3. **Do the highest-value activity** → the session shell walks warmup → learn → speak
   with one persistent progress spine; drills feel like one product because they share
   the shell.
4. **Receive useful feedback** → one feedback anatomy everywhere: what you said (their
   words, honored), what landed (green inked), the one thing to fix (articulatory tip,
   Joel's voice), then *use it again* immediately.
5. **See credible progress** → session end shows the delta that matters: "3 frases
   nuevas dominadas · Nivel entrevista: 34 → 36" — phrased toward the goal, styled as
   earned (stamped), never a rain of stars.
6. **Know the next action** → the end card names tomorrow: "Mañana: la llamada de
   Carolina — vas a manejar una cliente molesta." One button: done.
7. **Reason to return** → the promise made at (6) is the notification and the next
   day's (1). The loop closes narratively, not with a chest.

Every component in the design system exists to serve one of those seven moments; any
element that serves none of them is decoration and gets removed.

---

## 6. What premium means here, concretely

Within seconds of opening: a name-personalized Spanish greeting set in a confident
serif, one job-anchored promise for today, one button, Joel's human presence, the
tricolor signature — on warm paper with editorial spacing, nothing shaking, nothing
begging. That is the whole test: **calm, personal, employed-adjacent, Colombian, one
next step.** The rest of this system is the discipline to keep every other screen from
diluting that first impression.
