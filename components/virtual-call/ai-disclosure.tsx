import { Bot } from "lucide-react";
import { t, type CoachLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// The standing AI disclosure. It is a component rather than a string so it
// cannot quietly go missing from one of the screens: the picker shows it before
// the call starts, and the call header pins it for the whole call. Never
// collapsible, never behind a toggle.

export function AiDisclosure({ lang, className }: { lang: CoachLang; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-xl border border-warn/45 bg-warn/[0.09] px-3 py-2 text-xs font-medium leading-snug text-foreground",
        className,
      )}
    >
      <Bot className="mt-px size-3.5 shrink-0 text-warn" aria-hidden />
      <span className="min-w-0">{t("vcallDisclosure", lang)}</span>
    </p>
  );
}
