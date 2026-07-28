import type { LucideIcon } from "lucide-react";
import { CheckCircle2, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// Designed states for the moments most apps leave raw: nothing yet, loading,
// broken. All three share one calm anatomy (icon in a washed circle → title →
// one sentence → one action) so a failure feels like part of the product, not a
// hole in it. ErrorState is presentation only — route-level error.tsx wiring
// belongs to the Phase 0 branch, which can adopt this component.

export function EmptyState({
  icon: Icon = CheckCircle2,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  /** One supporting sentence. Keep it to one. */
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <div
        className="grid size-14 place-items-center rounded-full"
        style={{ background: "var(--surface-wash)" }}
      >
        <Icon className="size-6 text-primary" strokeWidth={1.75} aria-hidden />
      </div>
      <h2 className="type-title mt-5">{title}</h2>
      {children && <p className="type-support mt-2 max-w-[36ch]">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Esto no cargó",
  children = "No es tu culpa. Revisa tu conexión e intenta de nuevo — tu progreso está guardado.",
  onRetry,
  retryLabel = "Intentar de nuevo",
  className,
}: {
  title?: string;
  children?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <EmptyState icon={RefreshCw} title={title} className={className}
      action={
        onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="size-4" aria-hidden />
            {retryLabel}
          </button>
        )
      }
    >
      {children}
    </EmptyState>
  );
}

/** Persistent-condition banner (offline, provider down). Not a toast: a state
    that lasts gets UI that stays. */
export function OfflineNote({
  children = "Sin conexión — puedes seguir practicando; todo se guarda en tu teléfono.",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-xl border border-hairline bg-card px-4 py-3",
        className,
      )}
    >
      <CloudOff className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
      <p className="type-support">{children}</p>
    </div>
  );
}

/** Layout-matching loading placeholder. Shimmer is a background-position
    animation (cheap); reduced motion renders it as a static wash. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("skeleton rounded-xl", className)}
    />
  );
}

/** A ready-made first-load skeleton for hub screens: greeting, CTA, one card. */
export function HubSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-5 py-6" role="status" aria-label="Cargando">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-40 w-full" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
