"use client";

import Link from "next/link";
import { GraduationCap, Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/hooks/useSettings";
import { useAuth } from "@/lib/hooks/useAuth";
import { useAccess } from "@/lib/hooks/useAccess";
import { CustomLessonBuilder } from "@/components/instructor/custom-lesson-builder";
import { RecentAttempts } from "@/components/instructor/recent-attempts";
import { VoiceSettings } from "@/components/instructor/voice-settings";

export default function InstructorPage() {
  const { settings, update } = useSettings();
  const { required, user } = useAuth();
  const { admin } = useAccess();

  // Admin-only when a real auth backend exists (the DB policy enforces the same
  // list server-side); local dev without auth keeps the simple toggle.
  if (required && !admin) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <Lock className="mx-auto mb-5 size-8 text-muted-foreground" />
        <h1 className="font-display text-3xl font-medium tracking-[-0.02em]">Solo para tu profe</h1>
        <p className="mx-auto mt-3 max-w-xs text-muted-foreground">
          Las herramientas de instructor son solo para la cuenta del profesor.
        </p>
        <div className="mt-4">
          <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Volver a las lecciones
          </Link>
        </div>
      </div>
    );
  }

  if (!settings.instructorMode) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <Lock className="mx-auto mb-5 size-8 text-muted-foreground" />
        <h1 className="font-display text-3xl font-medium tracking-[-0.02em]">Instructor mode is off</h1>
        <p className="mx-auto mt-3 max-w-xs text-muted-foreground">
          Turn it on to add custom lessons and review her attempts.
        </p>
        <Button onClick={() => update({ instructorMode: true })} className="mt-6 rounded-full px-5">
          Turn on Instructor mode
        </Button>
        <div className="mt-4">
          <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Back to lessons
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-14 sm:px-6 sm:pt-16">
      <header className="mb-8 animate-fade-up">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <GraduationCap className="size-3.5" />
          Instructor
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-[-0.03em]">Teaching tools</h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          Build custom drills and see exactly what to target in your next live session.
        </p>
      </header>

      <Tabs defaultValue="attempts">
        <TabsList className="mb-6">
          <TabsTrigger value="attempts">Recent attempts</TabsTrigger>
          <TabsTrigger value="lessons">Custom lessons</TabsTrigger>
          <TabsTrigger value="voice">Voice & audio</TabsTrigger>
        </TabsList>

        <TabsContent value="attempts">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <RecentAttempts />
          </div>
        </TabsContent>

        <TabsContent value="lessons">
          <CustomLessonBuilder />
        </TabsContent>

        <TabsContent value="voice">
          <VoiceSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
