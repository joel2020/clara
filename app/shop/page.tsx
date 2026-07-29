"use client";

import { useState } from "react";
import { Star, Gift, Check, Lock, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/section-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";
import { sfx } from "@/lib/sfx";
import { popConfetti } from "@/lib/fx";
import { juice } from "@/components/juice";
import { LumiScene } from "@/components/lumi-scene";
import { SceneArt } from "@/components/scene-art";
import { SceneVideo } from "@/components/scene-video";
import { Splash } from "@/components/splash";
import {
  cosmeticsByType,
  buyCosmetic,
  equipCosmetic,
  openChest,
  chestAvailable,
  chestReward,
  chestIsJackpot,
  type Cosmetic,
} from "@/lib/cosmetics";
import { STORE_CATEGORIES, DEFAULT_FOR_SLOT, itemState, quotePurchase, slotFor } from "@/lib/store";

// The store: where speaking-earned stars become Lumi's world. All spending
// still flows through the one authoritative path (buyCosmetic → repo →
// cloud mirror); this page derives every card from the pure state layer and
// never spends without an explicit confirmation.

export default function ShopPage() {
  const player = usePlayer();
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const [chestMsg, setChestMsg] = useState<number | null>(null);
  /** The item awaiting purchase confirmation (or insufficient-balance info). */
  const [confirming, setConfirming] = useState<Cosmetic | null>(null);
  const [busy, setBusy] = useState(false);

  if (!player) return <Splash />;

  const onTap = async (c: Cosmetic) => {
    const s = itemState(c, player);
    if (s.status === "equipped" || s.status === "locked") return;
    if (s.status === "owned") {
      sfx.tap();
      await equipCosmetic(c.id);
      return;
    }
    // Available: never spend on a bare tap — quote it and ask.
    sfx.tap();
    setConfirming(c);
  };

  const confirmBuy = async () => {
    if (!confirming || busy) return;
    setBusy(true);
    const res = await buyCosmetic(confirming.id);
    setBusy(false);
    setConfirming(null);
    if (res.ok) {
      sfx.correct(0);
      popConfetti();
      juice.centerBurst();
      juice.sweep();
      toast.success(t("shopPurchased", lang));
    } else if (res.reason === "insufficient") {
      // The balance changed between quote and confirm (another device, a sync).
      sfx.wrong();
      toast.error(`${t("shopInsufficient", lang)} ${quotePurchase(confirming, player).shortfall} ★`);
    }
  };

  const claimChest = async () => {
    const jackpot = chestIsJackpot(player);
    const reward = await openChest();
    if (reward > 0) {
      sfx.correct(3);
      popConfetti();
      juice.centerBurst(`+${reward} ★`);
      juice.sweep();
      if (jackpot) {
        sfx.finish();
        setTimeout(() => juice.sweep(), 250);
      }
      setChestMsg(reward);
    }
  };

  const canChest = chestAvailable(player);
  const quote = confirming ? quotePurchase(confirming, player) : null;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-28 pt-6 sm:px-6">
      {/* Title + balance: one heading, one number that matters here. */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="type-label">{t("navTienda", lang)}</p>
          <h1 className="type-display mt-2" style={{ fontSize: "clamp(1.75rem, 6vw, 2.25rem)" }}>
            {t("shopTitle", lang)}
          </h1>
        </div>
        <span
          className="star-chip inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold shadow-sm"
          aria-label={`${t("shopBalanceLabel", lang)}: ${player.stars}`}
        >
          <Star className="size-4" style={{ fill: "currentColor" }} strokeWidth={0} aria-hidden />
          {player.stars}
        </span>
      </div>
      <p className="type-support mt-2 max-w-md">{t("shopIntro", lang)}</p>

      {/* Live preview + daily chest. The preview is the point: she's dressing
          HER Lumi, and every equip updates it instantly. */}
      <div className="mt-6 grid gap-4 sm:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="type-label mb-2">{t("shopPreviewTitle", lang)}</p>
          <LumiScene
            bgId={player.equippedBg}
            accessoryId={player.equippedAccessory}
            effectId={player.equippedEffect}
            petId={player.equippedPet}
            className="h-64 shadow-sm ring-1 ring-black/5 sm:h-72"
          />
        </div>
        <div className="flex flex-col justify-center rounded-3xl border border-hairline bg-card p-6 text-center">
          <span
            className="mx-auto grid size-14 place-items-center rounded-full"
            style={{ background: "var(--surface-wash)" }}
            aria-hidden
          >
            <Gift className={cn("size-6 text-primary", canChest && "animate-pop-in")} strokeWidth={1.75} />
          </span>
          <p className="type-heading mt-3">{t("chestTitle", lang)}</p>
          {chestMsg !== null ? (
            <p className="mt-1 text-sm font-medium text-success">
              {t("chestGot", lang)} {chestMsg} ★
            </p>
          ) : canChest ? (
            <button
              type="button"
              onClick={claimChest}
              className="star-chip mx-auto mt-3 inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-sm font-bold shadow-sm transition-transform active:scale-95"
            >
              <Gift className="size-4" aria-hidden />
              {t("chestOpen", lang)} · +{chestReward(player)} ★
            </button>
          ) : (
            <p className="type-support mt-1">{t("chestBack", lang)}</p>
          )}
        </div>
      </div>

      {/* Category navigation: sticky chips, anchor per section. */}
      <nav
        aria-label={t("navTienda", lang)}
        className="sticky top-16 z-30 -mx-5 mt-8 border-b border-hairline bg-background/92 px-5 py-2 backdrop-blur sm:-mx-6 sm:px-6"
      >
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {STORE_CATEGORIES.map((cat) => (
            <a
              key={cat.type}
              href={`#store-${cat.type}`}
              className="shrink-0 rounded-full border border-hairline bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/30"
            >
              {cat.label[lang]}
            </a>
          ))}
        </div>
      </nav>

      {/* One section per category. */}
      {STORE_CATEGORIES.map((cat) => {
        const equippedId = player[slotFor(cat.type)] ?? DEFAULT_FOR_SLOT[cat.type];
        const canRestore = equippedId !== DEFAULT_FOR_SLOT[cat.type];
        return (
          <section key={cat.type} id={`store-${cat.type}`} className="mt-10 scroll-mt-28">
            <div className="flex items-center justify-between gap-3">
              <SectionHeader bordered label={cat.label[lang]} className="flex-1" />
              {canRestore && (
                <button
                  type="button"
                  onClick={() => {
                    sfx.tap();
                    void equipCosmetic(DEFAULT_FOR_SLOT[cat.type]);
                  }}
                  className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {/* Outfit/background reset to a real look; the rest reset to "none". */}
                  {cat.type === "outfit" || cat.type === "background"
                    ? t("shopRestoreDefault", lang)
                    : t("shopRemove", lang)}
                </button>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cosmeticsByType(cat.type).map((c) => {
                const s = itemState(c, player);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onTap(c)}
                    disabled={s.status === "equipped" || s.status === "locked"}
                    aria-label={`${c.name[lang]} — ${
                      s.status === "equipped"
                        ? t("shopEquipped", lang)
                        : s.status === "owned"
                          ? t("shopEquip", lang)
                          : s.status === "locked" && s.lockedReason?.type === "level"
                            ? `${t("shopLockedLevel", lang)} ${s.lockedReason.level}`
                            : `${c.cost} ★`
                    }`}
                    className={cn(
                      "group relative flex flex-col rounded-2xl p-2.5 text-left transition-all active:scale-[0.98]",
                      c.rarity === "legendary"
                        ? "rim-legendary"
                        : cn(
                            "border",
                            s.status === "equipped"
                              ? "border-primary bg-primary/[0.06]"
                              : "border-hairline hover:border-primary/40",
                          ),
                      c.rarity === "legendary" && s.status === "equipped" && "ring-2 ring-primary",
                      s.status === "available" && !s.affordable && "opacity-60",
                      s.status === "locked" && "opacity-50",
                    )}
                  >
                    <div className="relative">
                      <Swatch cosmetic={c} />
                      {c.rarity === "legendary" && (
                        <span className="star-chip absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide shadow-sm">
                          <Sparkles className="size-2.5" aria-hidden />
                          {t("rarityLegendary", lang)}
                        </span>
                      )}
                    </div>
                    <span className="mt-2 truncate text-sm font-medium">{c.name[lang]}</span>
                    <span className="mt-1">
                      {s.status === "equipped" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                          <Check className="size-3.5" aria-hidden /> {t("shopEquipped", lang)}
                        </span>
                      ) : s.status === "owned" ? (
                        <span className="text-xs font-medium text-muted-foreground">{t("shopEquip", lang)}</span>
                      ) : s.status === "locked" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <Lock className="size-3" aria-hidden />
                          {s.lockedReason?.type === "level"
                            ? `${t("shopLockedLevel", lang)} ${s.lockedReason.level}`
                            : "—"}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs font-bold",
                            s.affordable ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          <Star className="size-3" style={{ fill: "currentColor" }} strokeWidth={0} aria-hidden />
                          {c.cost}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Purchase confirmation — nothing is spent on a bare tap. */}
      <Dialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="max-w-sm">
          {confirming && quote && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">
                  {quote.sufficient
                    ? `${t("shopConfirmTitle", lang)} ${confirming.name[lang]}?`
                    : confirming.name[lang]}
                </DialogTitle>
                <DialogDescription>
                  {quote.sufficient ? (
                    <>
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                        <Star className="size-3.5" style={{ fill: "currentColor" }} strokeWidth={0} aria-hidden />
                        {quote.cost}
                      </span>{" "}
                      · {t("shopConfirmAfter", lang)}{" "}
                      <span className="font-semibold text-foreground">{quote.after} ★</span>
                    </>
                  ) : (
                    <>
                      {t("shopInsufficient", lang)}{" "}
                      <span className="font-semibold text-foreground">{quote.shortfall} ★</span>.{" "}
                      {t("shopInsufficientCta", lang)}
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-hairline bg-card px-5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  {t("shopCancel", lang)}
                </button>
                {quote.sufficient ? (
                  <button
                    type="button"
                    onClick={confirmBuy}
                    disabled={busy}
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {t("shopConfirmBuy", lang)} · {quote.cost} ★
                  </button>
                ) : (
                  <Link
                    href="/today"
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    {t("shopGoPractice", lang)}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// A small visual chip for each cosmetic: the background gradient, the emoji prop,
// or a labeled effect tile. (Emoji here are the items' own art, not chrome.)
function Swatch({ cosmetic }: { cosmetic: Cosmetic }) {
  if (cosmetic.type === "background") {
    return (
      <div className="relative h-16 w-full overflow-hidden rounded-xl ring-1 ring-black/5" style={{ background: cosmetic.background }} aria-hidden>
        {cosmetic.video ? (
          <SceneVideo base={cosmetic.video} className="h-full w-full object-cover" />
        ) : (
          <SceneArt bgId={cosmetic.id} />
        )}
      </div>
    );
  }
  if (cosmetic.type === "outfit" && cosmetic.outfit) {
    return (
      <div className="shop-pedestal grid h-16 w-full place-items-center rounded-xl" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${cosmetic.outfit}.png`} alt="" className="shop-figure h-16 w-auto object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.22)]" />
      </div>
    );
  }
  if (cosmetic.image) {
    return (
      <div className="shop-pedestal grid h-16 w-full place-items-center rounded-xl" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cosmetic.image} alt="" className="shop-figure h-14 w-auto drop-shadow-[0_6px_8px_rgba(0,0,0,0.22)]" />
      </div>
    );
  }
  if (cosmetic.type === "pet") {
    return (
      <div className="shop-pedestal grid h-16 w-full place-items-center rounded-xl text-3xl" aria-hidden>
        <span className="shop-figure drop-shadow-[0_5px_6px_rgba(0,0,0,0.28)]">{cosmetic.emoji ?? "∅"}</span>
      </div>
    );
  }
  return (
    <div className="grid h-16 w-full place-items-center rounded-xl bg-muted text-3xl" aria-hidden>
      {cosmetic.emoji ?? (cosmetic.effect ? EFFECT_PREVIEW[cosmetic.effect] : "∅")}
    </div>
  );
}

const EFFECT_PREVIEW: Record<string, string> = {
  hearts: "💕",
  petals: "🌸",
  snow: "❄️",
  sparkle: "✨",
  confetti: "🎉",
  stars: "⭐",
  bubbles: "🫧",
  notes: "🎵",
  leaves: "🍃",
  rainbow: "🌈",
  coins: "🌟",
  diamonds: "💎",
  fireworks: "🎆",
  none: "∅",
};
