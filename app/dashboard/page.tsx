import { WeakSounds } from "@/components/weak-sounds";
import { Achievements } from "@/components/achievements";
import { PlayerBar } from "@/components/player-bar";
import { InsightsPanel } from "@/components/insights-panel";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-14 sm:px-6 sm:pt-20">
      <header className="mb-8 animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Progress</p>
        <h1 className="mt-5 font-display text-4xl font-medium tracking-[-0.03em] sm:text-5xl">Your progress</h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
          Accuracy by sound, weakest first. Tap any sound to drill it — recent shows how the last attempts went.
        </p>
      </header>

      <div className="mb-12">
        <PlayerBar />
      </div>

      <InsightsPanel />

      <WeakSounds />

      <section className="mt-14">
        <Achievements />
      </section>
    </div>
  );
}
