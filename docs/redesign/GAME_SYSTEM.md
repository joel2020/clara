# Clara game system

## Product loop

Clara's game layer exists to make effective practice easier to start and more
satisfying to continue:

1. Home presents one primary action: today's guided session.
2. The learner reviews due material, learns the next honest curriculum unit,
   and completes a speaking exchange.
3. Each real attempt produces immediate feedback, XP, and up to three stars.
4. XP advances a durable level; stars are the single spendable currency.
5. Daily missions and the learning path make progress visible.
6. Completing the balanced daily route reveals the daily store chest.
7. The next lesson or review remains clear.

Standard learning is unlimited. Clara has no hearts, lives, or energy system
that blocks a motivated learner.

## Economy

- **XP** measures long-term activity and level progression. Passing, accuracy,
  and sustained correct practice earn more than a miss.
- **Stars** are the only spendable currency. They come from demonstrated
  learning and are spent on cosmetic customization.
- **Streak** measures calendar consistency. A missed day never blocks learning;
  banked freezes can protect a streak.
- **Daily missions** balance talk, review, and new material. Completing all
  three awards one XP bonus.
- **Achievements** recognize real practice, mastery, levels, and consistency.

Existing progress, XP, stars, streaks, inventory, and achievements are
preserved. No Phase 1 migration resets learner state.

## Reward intensity

- A normal attempt uses compact score, XP, and star feedback.
- A daily-goal, mission, or achievement completion may use a short card,
  character reaction, and sound.
- Level, chapter, and major streak milestones may use the full celebration
  layer.

Celebrations are event-driven, never required to proceed, and are suppressed
by `prefers-reduced-motion`.

## Learning path truth

The map is generated from authored lessons already present in Clara. It does
not advertise unbuilt C1–C2 worlds. Nodes visually distinguish completed,
current, available/practiced, and locked states; review due work is surfaced
through the dedicated review action on Home and Today.

## Persistence and integrity

Player state is account-scoped locally and mirrored to the authenticated cloud
profile through the existing Phase 0 sync path. Store purchases use the same
repository path and never spend on a card tap: the learner previews and
confirms first. Cross-account isolation, durable attempt sync, voice consent,
and exam integrity remain release invariants.

The current cloud model stores the resulting balance and inventory snapshot.
A server-side append-only star transaction ledger remains a future hardening
step before paid currency or real-money commerce; Phase 1 does not introduce
either.

## Navigation

Mobile navigation is intentionally limited to five destinations:

- Hoy
- Camino
- Hablar
- Tienda
- Yo

Practice drills remain accessible through the daily route and secondary
exploration area instead of competing with the next best action.

## Accessibility

Progress uses text and icons in addition to color. Interactive targets are at
least 44 pixels tall where practical. Motion respects reduced-motion settings;
audio does not autoplay on initial load and remains subordinate to speaking
and listening exercises.
