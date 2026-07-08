"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Star, Gift, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";
import { sfx } from "@/lib/sfx";
import { popConfetti } from "@/lib/fx";
import { juice } from "@/components/juice";
import { LumiScene } from "@/components/lumi-scene";
import { Splash } from "@/components/splash";
import {
  cosmeticsByType,
  isOwned,
  buyCosmetic,
  equipCosmetic,
  openChest,
  chestAvailable,
  chestReward,
  type Cosmetic,
  type CosmeticType,
} from "@/lib/cosmetics";

export default function ShopPage() {
  const player = usePlayer();
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const [chestMsg, setChestMsg] = useState<number | null>(null);

  if (!player) return <Splash />;

  const equippedFor = (type: CosmeticType) =>
    type === "background" ? player.equippedBg : type === "accessory" ? player.equippedAccessory : player.equippedEffect;

  const onTap = async (c: Cosmetic) => {
    const owned = isOwned(player, c.id);
    const equipped = equippedFor(c.type) === c.id;
    if (equipped) return;
    if (owned) {
      sfx.tap();
      await equipCosmetic(c.id);
      return;
    }
    if (player.stars < c.cost) {
      sfx.wrong();
      return;
    }
    const res = await buyCosmetic(c.id);
    if (res.ok) {
      sfx.correct(0);
      popConfetti();
      juice.centerBurst();
      juice.sweep();
    }
  };

  const claimChest = async () => {
    const reward = await openChest();
    if (reward > 0) {
      sfx.correct(3);
      popConfetti();
      juice.centerBurst(`+${reward} ★`);
      juice.sweep();
      setChestMsg(reward);
    }
  };

  const canChest = chestAvailable(player);

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          {t("navLessons", lang)}
        </Link>
        <span className="star-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold shadow-sm">
          <Star className="size-4" style={{ fill: "currentColor" }} strokeWidth={0} />
          {player.stars}
        </span>
      </div>

      <section className="mt-5 animate-fade-up">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{t("shopTitle", lang)}</h1>
        <p className="mt-2 max-w-md text-muted-foreground">{t("shopIntro", lang)}</p>
      </section>

      {/* Live preview + daily chest */}
      <div className="mt-6 grid gap-4 sm:grid-cols-[1.1fr_1fr]">
        <LumiScene
          bgId={player.equippedBg}
          accessoryId={player.equippedAccessory}
          effectId={player.equippedEffect}
          className="h-64 shadow-sm ring-1 ring-black/5"
        />
        <div className="flex flex-col justify-center rounded-3xl border border-hairline bg-card p-6 text-center">
          <span className={cn("mx-auto text-5xl", canChest && "animate-chest")} aria-hidden>🎁</span>
          <p className="mt-3 font-display text-lg font-semibold">{t("chestTitle", lang)}</p>
          {chestMsg !== null ? (
            <p className="mt-1 text-sm font-medium text-success">
              {t("chestGot", lang)} {chestMsg} ★!
            </p>
          ) : canChest ? (
            <button
              type="button"
              onClick={claimChest}
              className="star-chip mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold shadow-sm transition-transform active:scale-95"
            >
              <Gift className="size-4" />
              {t("chestOpen", lang)} · +{chestReward(player)} ★
            </button>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{t("chestBack", lang)}</p>
          )}
        </div>
      </div>

      {/* Cosmetic sections */}
      {(["background", "accessory", "effect"] as CosmeticType[]).map((type) => (
        <section key={type} className="mt-10">
          <h2 className="border-b border-hairline pb-3 font-display text-sm font-semibold uppercase tracking-[0.16em]">
            {t(type === "background" ? "shopBackgrounds" : type === "accessory" ? "shopAccessories" : "shopEffects", lang)}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cosmeticsByType(type).map((c) => {
              const owned = isOwned(player, c.id);
              const equipped = equippedFor(type) === c.id;
              const affordable = player.stars >= c.cost;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onTap(c)}
                  disabled={equipped || (!owned && !affordable)}
                  className={cn(
                    "group relative flex flex-col rounded-2xl border p-2.5 text-left transition-all active:scale-[0.98]",
                    equipped ? "border-primary bg-primary/[0.06]" : "border-hairline hover:border-primary/40",
                    !owned && !affordable && "opacity-55",
                  )}
                >
                  <Swatch cosmetic={c} />
                  <div className="mt-2 flex items-center justify-between gap-1">
                    <span className="truncate text-sm font-medium">{c.name[lang]}</span>
                  </div>
                  <div className="mt-1">
                    {equipped ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        <Check className="size-3.5" /> {t("shopEquipped", lang)}
                      </span>
                    ) : owned ? (
                      <span className="text-xs font-medium text-muted-foreground">{t("shopEquip", lang)}</span>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-bold",
                          affordable ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {!affordable && <Lock className="size-3" />}
                        <Star className="size-3" style={{ fill: "currentColor" }} strokeWidth={0} />
                        {c.cost}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// A small visual chip for each cosmetic: the background gradient, the emoji prop,
// or a labeled effect tile.
function Swatch({ cosmetic }: { cosmetic: Cosmetic }) {
  if (cosmetic.type === "background") {
    return <div className="h-16 w-full rounded-xl ring-1 ring-black/5" style={{ background: cosmetic.background }} aria-hidden />;
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
  none: "∅",
};
