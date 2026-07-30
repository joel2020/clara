import { Headphones, RefreshCcw, ShieldCheck } from "lucide-react";
import { t, type CoachLang } from "@/lib/i18n";

export function TechnicalRecovery({
  lang,
  busy,
  onRetry,
  onContinueListening,
}: {
  lang: CoachLang;
  busy: boolean;
  onRetry: () => void;
  onContinueListening: () => void;
}) {
  return (
    <section
      className="mt-6 rounded-3xl border border-primary/20 bg-card p-6 text-center shadow-sm sm:p-8"
      aria-labelledby="technical-recovery-title"
    >
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-success/10 text-success">
        <ShieldCheck className="size-6" aria-hidden />
      </span>
      <h1
        id="technical-recovery-title"
        className="mt-4 font-display text-3xl font-semibold tracking-[-0.025em]"
      >
        {t("todayTechnicalTitle", lang)}
      </h1>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted-foreground">
        {t("todayTechnicalSafe", lang)}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium text-foreground/80">
        {t("todayTechnicalNoScore", lang)}
      </p>

      <div className="mx-auto mt-7 grid max-w-sm gap-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={busy}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 font-semibold text-background disabled:opacity-60"
        >
          <RefreshCcw className="size-4" aria-hidden />
          {t("todayTechnicalRetry", lang)}
        </button>
        <button
          type="button"
          onClick={onContinueListening}
          disabled={busy}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-hairline bg-card px-5 py-3 font-semibold text-foreground disabled:opacity-60"
        >
          <Headphones className="size-4" aria-hidden />
          {t("todayTechnicalListen", lang)}
        </button>
      </div>
    </section>
  );
}
