"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Lock, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { CharacterPreview } from "@/components/character";
import { Splash } from "@/components/splash";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { juice } from "@/components/juice";
import {
  LUMI_CITY_REMIX,
  buyCosmetic,
  equipCosmetic,
  type Cosmetic,
} from "@/lib/cosmetics";
import { popConfetti } from "@/lib/fx";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";
import { sfx } from "@/lib/sfx";
import {
  DEFAULT_FOR_SLOT,
  closetEligibility,
  quoteClosetAction,
} from "@/lib/store";
import { cn } from "@/lib/utils";

function requirement(cosmetic: Cosmetic, player: NonNullable<ReturnType<typeof usePlayer>>, lang: "es" | "en") {
  const rule = cosmetic.unlockRule;
  if (!rule || rule.type === "none") return `${cosmetic.cost} ★`;
  if (rule.type === "level") {
    return lang === "es" ? `Nivel ${rule.level} + ${cosmetic.cost} ★` : `Level ${rule.level} + ${cosmetic.cost} ★`;
  }
  if (rule.type === "completed-daily-sessions") {
    const progress = Math.min(player.completedDailySessions, rule.count);
    return lang === "es"
      ? `${progress}/${rule.count} sesiones diarias`
      : `${progress}/${rule.count} daily sessions`;
  }
  return player.unlockedMilestones.includes(rule.id)
    ? (lang === "es" ? "Llamada aprobada" : "Call passed")
    : (lang === "es" ? "Aprueba tu primera llamada" : "Pass your first call");
}

export default function ShopPage() {
  const player = usePlayer();
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Cosmetic | null>(null);
  const [busy, setBusy] = useState(false);

  if (!player) return <Splash />;

  const selected = LUMI_CITY_REMIX.find(
    (item) => item.id === (selectedId ?? player.equippedOutfit),
  ) ?? LUMI_CITY_REMIX[0];
  const selectedQuote = quoteClosetAction({
    cosmetic: selected,
    stats: player,
    eligibility: closetEligibility(player),
  });
  const previewCosmetic = selected;
  const previewOutfit = previewCosmetic.outfit;
  const selectedOwned = player.ownedCosmetics.includes(selected.id);
  const selectedEquipped = player.equippedOutfit === selected.id;
  const purchaseQuote = confirming
    ? quoteClosetAction({ cosmetic: confirming, stats: player, eligibility: closetEligibility(player) })
    : null;

  const celebrate = () => {
    sfx.correct(0);
    popConfetti();
    juice.centerBurst();
    juice.sweep();
  };

  const wearSelected = async () => {
    if (busy || selectedQuote.status !== "equip") return;
    setBusy(true);
    await equipCosmetic(selected.id);
    setBusy(false);
    sfx.tap();
    if (!selectedOwned) celebrate();
  };

  const confirmBuy = async () => {
    if (!confirming || busy) return;
    setBusy(true);
    const result = await buyCosmetic(confirming.id);
    setBusy(false);
    if (!result.ok) {
      if (result.reason === "insufficient") toast.error(t("shopInsufficient", lang));
      return;
    }
    setConfirming(null);
    celebrate();
    toast.success(t("shopPurchased", lang));
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6 sm:pt-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/profile"
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {lang === "es" ? "Volver a Yo" : "Back to Me"}
        </Link>
        <span
          className="star-chip inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold shadow-sm"
          aria-label={`${t("shopBalanceLabel", lang)}: ${player.stars}`}
        >
          <Star className="size-4" fill="currentColor" strokeWidth={0} aria-hidden />
          {player.stars}
        </span>
      </div>

      <header className="mt-5 max-w-2xl">
        <p className="type-label">Lumi City Remix</p>
        <h1 className="type-display mt-2 text-balance" style={{ fontSize: "clamp(2rem, 7vw, 3.5rem)" }}>
          {lang === "es" ? "El clóset de Lumi" : "Lumi’s Closet"}
        </h1>
        <p className="type-support mt-3 max-w-xl">
          {lang === "es"
            ? "Prueba un look, mira a Lumi en el escenario y desbloquéalo practicando."
            : "Try a look, see Lumi on stage, and unlock it through practice."}
        </p>
        <p className="mt-2 text-xs font-bold text-muted-foreground">{t("shopNoRealMoney", lang)}</p>
      </header>

      <section className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(19rem,.9fr)]">
        <div className="rounded-[2rem] border border-hairline bg-card p-3 shadow-sm sm:p-5">
          <CharacterPreview
            bgId={player.equippedBg}
            accessoryId={player.equippedAccessory}
            effectId={player.equippedEffect}
            outfit={previewOutfit}
            label={selected.name[lang]}
            className="[&>div:last-child]:h-[20rem] sm:[&>div:last-child]:h-[31rem]"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1 pb-1">
            <div>
              <p className="type-heading">{selected.name[lang]}</p>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                {requirement(selected, player, lang)}
              </p>
            </div>
            {selectedEquipped ? (
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary/10 px-5 text-sm font-bold text-primary">
                <Check className="size-4" aria-hidden />
                {lang === "es" ? "Puesto" : "Wearing"}
              </span>
            ) : selectedQuote.status === "locked" ? (
              <button
                type="button"
                disabled
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-muted px-5 text-sm font-bold text-muted-foreground"
              >
                <Lock className="size-4" aria-hidden />
                {lang === "es" ? "Todavía bloqueado" : "Still locked"}
              </button>
            ) : selectedQuote.status === "equip" ? (
              <button
                type="button"
                onClick={wearSelected}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
              >
                <Sparkles className="size-4" aria-hidden />
                {selectedOwned
                  ? (lang === "es" ? "Usar este look" : "Wear this look")
                  : (lang === "es" ? "Desbloquear y usar" : "Unlock & wear")}
              </button>
            ) : selectedQuote.balanceAfter !== undefined ? (
              <button
                type="button"
                onClick={() => setConfirming(selected)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {lang === "es" ? "Conseguir" : "Get the look"} · {selected.cost} ★
              </button>
            ) : (
              <Link
                href="/today"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {t("shopGoPractice", lang)} <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="type-label">Drop 01</p>
              <h2 className="type-heading mt-1">City Remix</h2>
            </div>
            {player.equippedOutfit !== DEFAULT_FOR_SLOT.outfit && (
              <button
                type="button"
                onClick={() => void equipCosmetic(DEFAULT_FOR_SLOT.outfit)}
                className="min-h-11 rounded-full px-3 text-xs font-bold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {t("shopRestoreDefault", lang)}
              </button>
            )}
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-3" aria-label="City Remix">
            {LUMI_CITY_REMIX.map((cosmetic) => {
              const quote = quoteClosetAction({ cosmetic, stats: player, eligibility: closetEligibility(player) });
              const chosen = cosmetic.id === selected.id;
              const equipped = cosmetic.id === player.equippedOutfit;
              const owned = player.ownedCosmetics.includes(cosmetic.id);
              return (
                <li key={cosmetic.id}>
                  <button
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => {
                      sfx.tap();
                      setSelectedId(cosmetic.id);
                    }}
                    className={cn(
                      "relative min-h-44 w-full rounded-3xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      chosen ? "border-primary shadow-md ring-2 ring-primary/20" : "border-hairline hover:border-primary/40",
                    )}
                  >
                    <div className="shop-pedestal grid h-24 place-items-center overflow-hidden rounded-2xl" aria-hidden>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${cosmetic.outfit}.png`}
                        alt=""
                        className="shop-figure h-24 w-auto object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.2)]"
                      />
                    </div>
                    <p className="mt-2 truncate text-sm font-bold">{cosmetic.name[lang]}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold text-muted-foreground">
                      {equipped
                        ? (lang === "es" ? "Puesto" : "Wearing")
                        : owned
                          ? (lang === "es" ? "Tuyo" : "Owned")
                          : quote.status === "locked"
                            ? requirement(cosmetic, player, lang)
                            : cosmetic.cost > 0
                              ? `${cosmetic.cost} ★`
                              : (lang === "es" ? "Se gana practicando" : "Earn through practice")}
                    </p>
                    {equipped && (
                      <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground" aria-label={lang === "es" ? "Puesto" : "Wearing"}>
                        <Check className="size-4" aria-hidden />
                      </span>
                    )}
                    {quote.status === "locked" && (
                      <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-background/90 text-muted-foreground" aria-hidden>
                        <Lock className="size-3.5" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <Dialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="max-w-sm">
          {confirming && purchaseQuote && (
            <>
              <DialogHeader>
                <DialogTitle>{t("shopConfirmTitle", lang)} {confirming.name[lang]}?</DialogTitle>
                <DialogDescription>
                  {purchaseQuote.status === "buy" && purchaseQuote.balanceAfter !== undefined
                    ? `${confirming.cost} ★ · ${t("shopConfirmAfter", lang)} ${purchaseQuote.balanceAfter} ★`
                    : t("shopInsufficient", lang)}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-hairline px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t("shopCancel", lang)}
                </button>
                <button
                  type="button"
                  onClick={confirmBuy}
                  disabled={busy || purchaseQuote.status !== "buy" || purchaseQuote.balanceAfter === undefined}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                >
                  {t("shopConfirmBuy", lang)} · {confirming.cost} ★
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
