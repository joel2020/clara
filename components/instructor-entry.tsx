"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSettings } from "@/lib/hooks/useSettings";

// Quiet entry point to Instructor mode — only shown when the toggle is on, so the
// learner's view stays focused on practice.

export function InstructorEntry() {
  const { settings } = useSettings();
  if (!settings.instructorMode) return null;

  return (
    <Link
      href="/instructor"
      className="group mt-12 flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="font-medium uppercase tracking-[0.14em]">Instructor tools</span>
      <span className="h-px flex-1 bg-hairline" />
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
