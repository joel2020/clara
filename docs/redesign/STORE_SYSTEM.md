# Clara Store System

Date: 2026-07-28 · Branch: `phase1/game-redesign`
Executable gate: `lib/store.test.mjs` (43 checks, runs in the stock suite).

The store is where speaking-earned stars become Lumi's world. It was never
removed — this elevation makes it a first-class destination and gives every
purchase an explicit, honest flow.

## 1. Data model

**Catalog** — `lib/cosmetics.ts` `COSMETICS: Cosmetic[]` (module data, outside
any UI component). Fields: `id`, `type` (`outfit | pet | background | accessory
| effect`), bilingual `name`, `cost` (stars), `free` (always owned; the slot
default), `rarity` (`"legendary"`), art fields (`background`/`emoji`/`image`/
`video`/`outfit`), and the elevation's additions: `unlockLevel?`,
`availableFrom?`/`availableUntil?` (epoch ms, seasonal). New categories are new
`CosmeticType` members plus a `STORE_CATEGORIES` row — no store rewrite.
No catalog item currently sets a gate or window: the fields exist so future
items can, without ever retroactively locking existing users (see state rules).

**Player state** — existing `PlayerStats` fields only: `stars`,
`ownedCosmetics[]`, `equippedBg/Accessory/Effect/Pet/Outfit`, `lastChestDay`.
No schema change, no migration: existing balances and inventories are read
as-is (`itemState` treats missing equip fields as the slot default, matching
`usePlayer`'s `DEFAULT_PLAYER` merge).

**Pure state layer** — `lib/store.ts`: `STORE_CATEGORIES`, `slotFor` (single
source of the type→slot mapping, re-used by the persistence layer),
`DEFAULT_FOR_SLOT`, `itemState()`, `quotePurchase()`. No repo import, no clock
reads (callers pass `now`), no mutation — plain-node testable.

## 2. State rules

`itemState(item, player, {now}) → equipped | owned | available | locked`, with
`affordable` always reported and `lockedReason` (`level` or `window`) on locks.
Precedence is **equipped > owned > locked > available**: ownership always beats
a lock, so adding a level gate or closing a seasonal window can never take away
something a learner earned. Free items are always owned. Affordability never
changes status — an unaffordable item stays visible and tappable and explains
itself (dimmed, then the shortfall dialog), never silently disabled.

## 3. Economy boundary

- **One currency: stars, earned by learning** (speaking scores via
  `starRating`, plus the existing daily chest). This elevation adds **no new
  currency and no real-money path**; nothing here touches payments.
- **One spend path:** UI → confirmation dialog (`quotePurchase`: cost, balance,
  after / shortfall) → `buyCosmetic()` → `repo.savePlayerStats()` → cloud
  mirror. The UI never computes a balance itself and never spends on a bare
  tap. A stale quote (balance changed on another device) is re-checked by
  `buyCosmetic` and surfaces as an insufficient toast, not a negative balance.
- **Feedback:** success = toast + confetti + equip-on-buy (existing behavior);
  insufficient = shortfall + "gana estrellas hablando" with a direct door to
  `/today` — the store always routes desire back into learning.
- **Chest:** behavior untouched (daily, streak-scaled, weekly jackpot); its
  economy critique is a product decision deferred to the game-loop workstream.

## 4. Accessibility

Item cards are buttons with full `aria-label`s (name + state/price); equipped
and locked cards are disabled; state is never color-only (check/lock icons +
text); all controls ≥ 44px (cards, chips, dialog buttons, chest button);
category nav is an `aria-label`ed anchor list; the balance chip carries a
labeled value; the dialog is the focus-trapped base-ui Dialog; no emoji in
chrome (item-art emoji are content, kept until the character workstream
produces replacements).

## 5. Responsive behavior

390: two-column cards, sticky category chips scroll horizontally, preview
stacks above the chest card. ≥ sm: three-column cards, preview+chest side by
side, taller preview (`h-72`). The Lumi preview renders full-figure
(`object-contain` stage — head/hands/feet never crop). The category bar sticks
under the app header (`top-16`) with the section `scroll-mt` matched.

## 6. Migration safety

No persistence changes. `lib/cosmetics.ts` gained optional fields (additive)
and lost only its private `slotFor` (moved to `lib/store.ts`, same mapping,
now shared and tested). Existing users see identical balances, inventory, and
equipped state; the only behavior change is purchase confirmation (a tap that
used to spend instantly now asks first) and that unaffordable/locked items
explain themselves instead of being dead.

## 7. Future ledger proposal (not built here)

Balances are client-computed today (Dexie + cloud mirror of `PlayerStats`).
A tamper-evident economy needs a server-side ledger: an append-only
`star_transactions` table (profile_id, delta, reason, item_id?, at, unique
idempotency key), RLS-scoped like the existing per-user tables, written by a
server route that validates the earn/spend reason, with `stars` derived (or
periodically reconciled) from the ledger sum. This touches Supabase schema and
sync — deliberately out of scope for this branch's presentation-layer mandate
and sequenced after the integration lead opens persistence work. `BuyResult`
and `quotePurchase` are shaped so the UI won't change when the spend moves
server-side.
