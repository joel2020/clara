"use client";

import { Globe2, Phone, Target } from "lucide-react";
import { compareLevel, LEVELS, type Level } from "@/lib/placement";
import { scenariosForLevel, type VirtualCallScenario } from "@/lib/content/virtual-call-scenarios";
import { t, type CoachLang, type StringKey } from "@/lib/i18n";
import type { CorrectionMode } from "@/lib/virtual-call/session";
import { cn } from "@/lib/utils";
import { AiDisclosure } from "./ai-disclosure";

// The picker. Everything she needs to choose well is on the card itself —
// what the call is, what she will be able to do afterwards, how long it runs,
// and where the situation differs from home. No card is hidden behind a
// "learn more".

const LENGTH_LABEL: Record<VirtualCallScenario["length"], StringKey> = {
  short: "vcallDurationShort",
  standard: "vcallDurationStandard",
};

const MODES: { mode: CorrectionMode; label: StringKey; sub: StringKey }[] = [
  { mode: "natural", label: "vcModeNatural", sub: "vcModeNaturalSub" },
  { mode: "practice", label: "vcModePractice", sub: "vcModePracticeSub" },
];

export function ScenarioPicker({
  level,
  lang,
  mode,
  onModeChange,
  onStart,
  disabled,
  notice,
  highlightId,
}: {
  level: Level;
  lang: CoachLang;
  mode: CorrectionMode;
  onModeChange: (mode: CorrectionMode) => void;
  onStart: (scenario: VirtualCallScenario) => void;
  /** True when the mic is unavailable or the device is offline. */
  disabled: boolean;
  /** Why the calls are disabled, when they are. */
  notice?: string;
  /** A deep-linked scenario, lifted to the top of the list and marked. */
  highlightId?: string;
}) {
  const ranked = scenariosForLevel(level, LEVELS);
  const scenarios = highlightId
    ? [...ranked].sort((a, b) => Number(b.id === highlightId) - Number(a.id === highlightId))
    : ranked;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-10 sm:px-6 sm:pt-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {t("vcallEyebrow", lang)}
      </p>
      <h1 className="mt-3 font-display text-[2rem] font-medium leading-[1.08] tracking-[-0.03em] sm:text-4xl">
        {t("vcallTitle", lang)}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">{t("vcallIntro", lang)}</p>
      <AiDisclosure lang={lang} className="mt-5" />

      {notice && (
        <p role="status" className="mt-4 rounded-2xl border border-warn/45 bg-warn/[0.08] px-4 py-3 text-sm">
          {notice}
        </p>
      )}

      <fieldset className="mt-8 min-w-0">
        <legend className="font-display text-sm font-semibold uppercase tracking-[0.16em]">{t("vcMode", lang)}</legend>
        {/* Native radios: full keyboard behaviour, no re-implemented roving focus. */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {MODES.map((option) => (
            <label
              key={option.mode}
              className={cn(
                "flex min-w-0 cursor-pointer gap-3 rounded-2xl border p-3.5 transition-colors has-[:focus-visible]:border-primary",
                mode === option.mode ? "border-primary/50 bg-primary/[0.05]" : "border-hairline bg-card",
              )}
            >
              <input
                type="radio"
                name="vcall-mode"
                value={option.mode}
                checked={mode === option.mode}
                onChange={() => onModeChange(option.mode)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0">
                <span className="block font-medium">{t(option.label, lang)}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                  {t(option.sub, lang)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <h2 className="mt-10 font-display text-sm font-semibold uppercase tracking-[0.16em]">{t("vcallChoose", lang)}</h2>

      {scenarios.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-hairline px-4 py-8 text-center text-sm text-muted-foreground">
          {t("vcallNoScenarios", lang)}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {scenarios.map((scenario) => (
            <li key={scenario.id}>
              <ScenarioCard
                scenario={scenario}
                lang={lang}
                fits={compareLevel(scenario.level, level) <= 0}
                highlighted={scenario.id === highlightId}
                disabled={disabled}
                onStart={() => onStart(scenario)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScenarioCard({
  scenario,
  lang,
  fits,
  highlighted,
  disabled,
  onStart,
}: {
  scenario: VirtualCallScenario;
  lang: CoachLang;
  fits: boolean;
  highlighted: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  const headingId = `vcall-scenario-${scenario.id}`;
  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "min-w-0 rounded-2xl border bg-card p-4 transition-colors focus-within:border-primary/40 sm:p-5",
        highlighted ? "border-primary/50 ring-1 ring-primary/25" : "border-hairline",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h3 id={headingId} className="min-w-0 font-display text-lg font-medium tracking-[-0.01em]">
          {scenario.title[lang]}
        </h3>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]",
            fits ? "border-primary/40 bg-primary/[0.06] text-primary" : "border-warn/50 bg-warn/[0.08] text-foreground",
          )}
        >
          <span className="sr-only">{t("vcallLevelLabel", lang)}: </span>
          {scenario.level}
          <span className="sr-only"> — {t(fits ? "vcallFitsLevel" : "vcallAboveLevel", lang)}</span>
        </span>
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{scenario.description[lang]}</p>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex min-w-0 gap-2">
          <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            <Target className="size-3.5" aria-hidden />
            {t("vcallObjective", lang)}
          </dt>
          <dd className="min-w-0 break-words">{scenario.objective[lang]}</dd>
        </div>
        <div className="flex min-w-0 gap-2">
          <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            <Phone className="size-3.5" aria-hidden />
            {t("vcallDurationLabel", lang)}
          </dt>
          <dd className="min-w-0">{t(LENGTH_LABEL[scenario.length], lang)}</dd>
        </div>
      </dl>

      {scenario.culturalNote && (
        <p className="mt-3 flex gap-2 rounded-xl bg-secondary/70 px-3 py-2.5 text-sm leading-relaxed">
          <Globe2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            <span className="font-medium">{t("vcallCultural", lang)}: </span>
            {scenario.culturalNote[lang]}
          </span>
        </p>
      )}

      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <Phone className="size-4" aria-hidden />
        {t("vcallCall", lang)}
        <span className="sr-only"> — {scenario.title[lang]}</span>
      </button>
    </article>
  );
}
