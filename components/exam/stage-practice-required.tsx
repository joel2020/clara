import Link from "next/link";
import { Lumi } from "@/components/lumi";
import type { ExamCheckpoint } from "@/lib/db/types";
import { LATAM_PRONUNCIATION_PRIOR } from "@/lib/speech/latam-prior";
import { pronunciationCue } from "@/lib/i18n";

export function StagePracticeRequired({ focus, attempts }: { focus?: ExamCheckpoint["focus"]; attempts: number }) {
  const href = focus ? `/lesson/${encodeURIComponent(focus.lessonId)}?focus=${encodeURIComponent(focus.itemId)}` : "/today";
  const prior = focus ? LATAM_PRONUNCIATION_PRIOR[focus.feature as keyof typeof LATAM_PRONUNCIATION_PRIOR] : undefined;
  return (
    <div className="text-center" data-exam-terminal="practice-required">
      <Lumi frame="bust" mood="encourage" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Práctica necesaria</p>
      <h2 className="mt-3 font-display text-2xl font-semibold">Vamos a entrenar este sonido</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Llegaste a tres intentos en este objetivo. El examen quedó incompleto: no cuenta como intento, no cambia tu nivel y no entrega premios.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">This sitting is incomplete. Practice the sound, then return for a fresh exam.</p>
      {focus && (
        <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Objetivo · Focus</p>
          <p lang="en" className="mt-2 font-display text-xl font-semibold">{focus.itemText}</p>
          <p className="mt-2 text-sm font-semibold">{prior?.target ?? focus.feature}</p>
          {prior && <><p className="mt-1 text-sm">{pronunciationCue(prior.cueKey, "es")}</p><p className="mt-1 text-xs text-muted-foreground">{pronunciationCue(prior.cueKey, "en")}</p></>}
          <p lang="en" className="mt-2 text-xs text-muted-foreground">{focus.mouthHint}</p>
          <p className="mt-2 text-xs text-muted-foreground">{attempts} intentos acústicos válidos · {attempts} valid acoustic attempts</p>
        </div>
      )}
      <Link href={href} className="mt-6 block rounded-2xl bg-primary px-5 py-3.5 text-center text-sm font-semibold text-primary-foreground">
        Practicar este sonido · Practice this sound
      </Link>
    </div>
  );
}
