# Clara Daily Classroom and Character System

Date: 2026-07-29  
Status: approved design  
Product promise: **Clara is Joel’s free English classroom—available every day.**

## 1. Purpose and audience

Clara extends Joel’s teaching for young adults in Medellín who want practical
American English for jobs, travel, friendships, entertainment, interviews, and
everyday conversation. It is free. There are no payments, subscriptions,
premium tiers, advertisements, trials, punitive hearts, or energy limits.

The redesign prioritizes one useful, enjoyable 10–15 minute session that a
learner can understand, interrupt, resume, and finish. Game systems make
learning visible; they do not manufacture pressure or substitute for teaching.

## 2. Decisions and hierarchy

- Joel is the real instructor, program creator, and source of authentic teaching
  explanations and approved humorous reactions.
- Clara is the sole learner-facing guide, practice partner, lesson host, and
  progress interpreter. She does not claim to be Joel.
- Lumi is retired from learner-facing screens. Existing Lumi code and pose
  mappings may inform migration mechanics, but Lumi art does not define Clara.
- Learners may choose and customize adult learner avatars. The initial pair is a
  young woman and a young man, both visibly in their 20s and grounded in
  contemporary Medellín. They are not alternate teachers.
- The current youthful anime artwork is not reused as Clara’s final identity.

## 3. Delivery approach

Use a vertical slice. Ship the complete daily loop first while establishing only
the character assets required for four representative contexts:

1. Mobile dashboard
2. Today-session introduction
3. Speaking-feedback screen
4. Store preview

The character library expands only after the master sheet and these four
contexts pass review. Character production must not delay improvements to the
core learning loop.

## 4. Daily learning loop

### 4.1 Dashboard preview

The first mobile viewport contains:

- Personalized greeting
- One practical objective
- Real-life outcome
- Estimated time
- Included activity types
- Expected learning-earned reward
- One dominant **Start today’s session** or **Continue today’s session** action
- Simple progress indicator when resumed

Supporting readiness, review, consistency, path, XP, streak, currency, store,
and exploration content follows in that order and does not compete with the
primary action.

### 4.2 Session sequence

The orchestrated session uses a flexible six-part shape:

1. Retrieve one small amount of due or weak language
2. Learn or refresh a small language target in context
3. Hear natural American English
4. Speak with understandable, non-punitive feedback
5. Use the target in a realistic situation
6. Review the most useful mistake and finish

Time allocation is approximately two minutes retrieval, three minutes input and
listening, three minutes controlled speaking, three to four minutes realistic
transfer, and one minute review. Empty categories donate time rather than
creating filler.

Every activity transition is short. The interface shows current step, overall
progress, remaining-time estimate, and saved state. The learner is never forced
through unrelated navigation.

### 4.3 Completion

Completion shows:

- What was practiced
- One evidenced improvement
- One mistake worth reviewing
- XP and stars earned
- Progress toward the next practical goal
- A short reaction from Clara
- An optional, frequency-capped approved Joel reaction
- Tomorrow’s suggested objective
- An explicit **Done for today** stopping point

The session completion reward is idempotent and awarded once.

## 5. Daily Session Orchestrator

Add one bounded domain module that coordinates existing systems without
duplicating their responsibilities.

### 5.1 Inputs

- Learner name and onboarding profile
- CEFR level and placement evidence
- General or job path
- Learner goals
- Review-due items
- Weak sounds and vocabulary
- Recent mistakes and performance
- Speaking confidence evidence
- Completed lessons and prerequisites
- Unfinished daily session
- Available content, audio, and scenarios

### 5.2 Output

A stable daily plan containing:

- Version, account scope, local day, and deterministic seed
- Practical objective and real-life outcome
- Estimated duration and assistance level
- Ordered activity descriptors and selection reasons
- Current checkpoint and per-activity status
- Valid learning evidence and technical-skip evidence
- Completion summary
- One-time reward state
- Created, updated, started, and completed timestamps

The plan stores IDs, bounded metadata, and scores. It stores no raw audio.

### 5.3 Responsibility boundary

The orchestrator selects, orders, checkpoints, resumes, and summarizes.
Existing lesson, SRS, review, speech, practice, gamification, sync, and analytics
modules remain responsible for teaching content, scoring, mastery changes,
attempt rewards, and durable mirroring.

## 6. Personalization and adaptation

Candidate activities are ranked by:

- Review urgency
- Practical relevance to the current path and goal
- Confidence that an item is a real weakness
- CEFR and prerequisite fit
- Recency
- Repetition fatigue
- Transfer value

A deterministic daily seed keeps the plan stable during the day. Existing
unfinished plans resume rather than recompose.

Assistance changes meaningfully:

- Beginners receive Spanish instructions, translations, concrete examples, and
  more rehearsal.
- Intermediate learners receive selective Spanish support.
- Advanced learners default to English and reveal hints on request.
- Low-confidence speakers rehearse before a realistic scenario.
- Higher-confidence speakers receive less preparation and fewer hints.

Speaking confidence changes scaffolding, not pronunciation standards.
Technical recognition failures are excluded from weakness, mastery, streak, and
reward calculations. Sparse history produces an honestly labeled level-based
session; Clara never invents a weakness.

## 7. Persistence, sync, and migration

Add a versioned account-scoped `DailySession` store in Dexie and a corresponding
cloud table protected by per-user RLS. Add durable outbox support for session
upserts or an equivalent idempotent retry path.

Write the local checkpoint before navigation or transition. On conflict,
completed activity evidence wins and rewards cannot double-apply. Offline
progress remains usable and visibly queued for synchronization.

Existing learners have no historical daily-session row. On first use, compose a
new session from existing progress. Do not rewrite placement, attempts, SRS
rows, XP, stars, streaks, cosmetics, paths, or completed lessons.

## 8. Failure and comeback behavior

Handle microphone denial, silence, uncertain recognition, upstream scoring
failure, offline state, and synchronization failure as distinct states.

- Invalid evidence is not scored.
- Technical failures never become learner mistakes.
- Progress remains safe.
- The learner may retry or continue with a non-speaking alternative when
  educationally valid.
- Speaking can be revisited later without withholding overall session credit.
- Failed cloud writes queue automatically and remain visible.

After a missed day, welcome the learner back and offer a shorter recovery
session centered on the most important review. Do not use shame, threats, or
loss-aversion language.

## 9. Clara character design system

Create `CHARACTER_DESIGN_SYSTEM.md` during implementation as the authoritative
future-production guide.

### 9.1 Identity

- Clearly adult, presenting approximately 25–29
- Colombian or broadly Latin American without costume shorthand
- Natural adult body proportions and expressive hands/posture
- Medium warm skin, brown eyes, warm dark-brown hair
- Contemporary, capable, conversational presence
- Base wardrobe uses teal, ink, coral, and warm-gold accents

Clara is observant, encouraging, warm, and competent. She is not childish,
maternal, flirtatious, performatively cheerful, or a copy of another
language-learning mascot.

### 9.2 Illustration technique

Use premium editorial 2.5D illustration:

- Clean hand-drawn contours with selective line weight
- Natural facial anatomy
- Softly modeled upper-left key light and warm bounce
- Restrained paper-like texture
- Readable silhouettes
- Consistent face, anatomy, materials, palette, and lighting across every state

Avoid stock-vector aesthetics, cheap 3D gloss, chibi/anime proportions,
excessive cuteness, sexualization, and rendering-style drift.

### 9.3 Master-sheet gate

Before creating the production pose library, create and formally approve one
transparent master sheet showing:

- Front, three-quarter, and profile construction
- Facial landmarks and defining features
- Adult proportion guide
- Hands and gesture language
- Base wardrobe and materials
- Palette and lighting
- Seven expressions
- Full-body, three-quarter, bust, and 48px avatar checks

No outfit or pose expansion occurs before master-sheet approval. Temporary or
inconsistent AI images are not final assets.

### 9.4 Seven states

1. Welcome: open stance and eye contact; full or three-quarter framing
2. Teaching: focused expression and open-palm gesture; three-quarter or bust
3. Listening: attentive head tilt and calm face; bust
4. Encouraging: small nod and supportive expression; bust
5. Thinking: reflective gaze; three-quarter
6. Celebrating: grounded joy; full or three-quarter
7. Store preview: neutral stance; full body

Each state documents intended screens, emotional purpose, accessible meaning,
motion opportunity, and reduced-motion still.

### 9.5 Framing and accessibility

Every transparent asset defines intrinsic safe areas and a focal anchor. Default
to containment. Preserve head, hair, face, gesture hands, feet, and meaningful
clothing details. Only approved bust assets may crop the body.

Use meaningful alt text only when Clara communicates information; use empty alt
text when decorative. Motion is optional micro-movement. Reduced motion uses
the exact matching still.

## 10. Adult learner avatars and store

The learner may select an adult woman or adult man avatar without changing
curriculum, difficulty, assessment, or access. Both use the same premium
rendering standard and appear in their 20s.

The initial young-man direction is confident contemporary Medellín streetwear:

- Everyday nea: relaxed original graphic tee, straight jeans, clean sneakers,
  and subtle chain
- Urban night: boxy overshirt, dark cargos, original baseball cap, and high-top
  sneakers
- Football-day colorway without copied club marks
- Job-ready knitted polo, tapered trousers, clean sneakers, and understated
  watch

“Nea” informs confidence, silhouette, styling, and humor. It must not imply
criminality, poverty, aggression, or costume parody.

Both avatars share the same non-gender-restricted catalog:

- Hairstyles
- Original baseball caps: solid, two-tone, curved-brim, minimal graphic, and
  Medellín-inspired colorways
- Glasses and jewelry
- Tops, jackets, trousers, and sneakers
- Profile frames, lesson backgrounds, and celebration effects
- Pets including dogs, cats, birds, rabbits, Colombian wildlife companions, and
  playful fantasy pets

Use no copied sports-team or fashion-brand logos. A live full-body preview shows
avatar, outfit, baseball cap, and pet together. Compatibility tests prevent
clipping across hair, head, body, and responsive frames.

The store states **No real money · Earned through learning.** Items are cosmetic
or supportive and never affect learning validity or access.

## 11. Medellín humor

Humor should feel like Joel’s classroom and young-adult Medellín, not generic
gamification copy.

- Clara uses light observational humor and occasional local phrasing.
- Joel uses a reviewed reaction bank tied to meaningful successes, recovery,
  mastery, or comeback.
- Cultural listening content may use affectionate paisa archetypes, situations,
  and register differences.
- At most one strong reaction appears per session, selected with a low
  probability and cooldown.
- No jokes appear during consent, microphone trouble, account problems,
  technical failures, or corrective explanation.
- Humor never ridicules a learner’s English.
- Slang includes a plain-Spanish meaning and register note when useful.

Workflow: draft candidate → Colombian-Spanish review → Joel approval for any
line attributed to him → learner-safety/readability check → release. Do not
present invented lines as authentic Joel quotes before approval.

## 12. Rewards, missions, notifications, and store

Keep XP, stars, missions, streaks, achievements, path progress, customization,
and learning-earned streak protection. Tie rewards to meaningful speaking,
review, improvement, mastery, and session completion.

Notifications, if enabled, remain specific and optional. Examples refer to
ready review, an unfinished interview answer, or a short speaking task. Avoid
generic pressure and respect opt-out choices.

## 13. Instructor visibility

Extend the admin-only coach view with:

- Active learners and last practice date
- Sessions started and completed
- Current CEFR level and path
- Speaking participation
- Ranked weak sounds and vocabulary
- Review need
- Learners who may need help
- Synchronization and technical failures

Maintain API authorization, database RLS, and account isolation. Never expose
one student’s information to another.

## 14. Privacy-conscious instrumentation

Add bounded structured events for:

- Daily session started
- Activity completed
- Session resumed
- Session completed
- Speaking attempted
- Review completed
- Next-day return
- Seven-day return
- Session abandoned
- Categorized technical failure

Store IDs, counts, durations, statuses, and failure categories. Do not store raw
voice content or unrestricted transcript text in analytics.

Define:

- Daily active learner
- Daily session completion rate
- Next-day return rate
- Seven-day return rate
- Average meaningful practice time
- Speaking participation rate
- Review completion rate
- Technical failure rate

Meaningful completed learning, not maximum time in app, is the optimization
target.

## 15. Verification

### 15.1 Automated

Add focused tests for:

- Candidate ranking and stable daily composition
- CEFR/path assistance
- Weakness-confidence thresholds
- Technical-failure exclusion
- Checkpoint and exact resume behavior
- Offline durability and conflict merge
- Idempotent completion rewards
- Comeback sessions
- Humor probability, cooldown, and restricted contexts
- Event schema and privacy bounds
- Account and instructor isolation
- Store compatibility, virtual-only currency, and cosmetic-only effects

Run the complete test suite, type-check, lint ratchet, and production build.

### 15.2 Browser

Verify:

- New Google-account learner and existing learner
- Beginner, intermediate, and advanced placement
- Interrupted and resumed session
- Offline and failed synchronization
- Speech-recognition failure and microphone denial
- Muted audio and reduced motion
- Spanish accents and punctuation
- Privacy and voice consent
- Account isolation and instructor restrictions
- Store with no real money
- 320px, 375px, 390px, and 430px mobile widths
- Tablet and desktop
- Browser console
- Chrome and available Safari/Firefox coverage

Capture before-and-after mobile and desktop screenshots for the dashboard, Today
introduction, speaking feedback, and store preview. Instructional content must
remain visually primary.

### 15.3 Release

Do not deploy until safe automated and browser checks pass. After deployment,
run authenticated production smoke tests and review console/network failures.
Document any physical iPhone microphone, Safari PWA/OAuth, notification, or
other real-device checks that remain owner-assisted.

## 16. Deliverables

1. This approved design
2. Detailed implementation plan
3. Daily-loop architecture and code
4. Clara master character sheet and essential assets
5. `CHARACTER_DESIGN_SYSTEM.md`
6. Adult learner avatars and store customization
7. Medellín humor candidate bank and approval status
8. Database migrations
9. Tests and verification results
10. Mobile and desktop before/after screenshots
11. Production deployment status
12. Remaining educational risks
13. Real-device tests still needed
14. Seven-day pilot plan for Joel’s former students

## 17. Explicit exclusions

- Payments, subscriptions, trials, premium tiers, advertisements, or real-money
  purchases
- Punitive hearts, artificial energy limits, or guilt-heavy return messaging
- Fake proficiency claims or keyword matching presented as language assessment
- Generic AI content replacing proven curriculum
- Rewriting or resetting existing learner progress
- Copying another language-learning product’s mascot or identity
- Expanding character cosmetics before the master identity and four
  representative contexts are approved

