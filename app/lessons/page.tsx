"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LessonList } from "@/components/lesson-list";
import { SectionHeader } from "@/components/ui/section-header";
import { InstructorEntry } from "@/components/instructor-entry";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";

// The full curriculum as browsable lists. The home screen stays focused on
// today's actions; this page (and the Map) is where she explores everything.

export default function LessonsPage() {
  const { settings } = useSettings();
  const lang = settings.coachLanguage;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("navHome", lang)}
      </Link>

      <h1 className="mt-5 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
        {t("lessonsHeading", lang)}
      </h1>

      <section className="mt-8">
        <SectionHeader label={t("trackConversation", lang)} sub={t("trackConversationSub", lang)} bordered />
        <LessonList track="conversation" />
      </section>

      <section className="mt-14">
        <SectionHeader label={t("trackSounds", lang)} sub={t("trackSoundsSub", lang)} bordered />
        <LessonList track="sounds" />
      </section>

      <InstructorEntry />
    </div>
  );
}
