import Link from "next/link";
import { Lumi } from "@/components/lumi";

// Branded bilingual 404 — the default English Next.js page read as broken to
// a Spanish-speaking learner (audit P2).
export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <div className="h-28 w-24">
        <Lumi mood="think" priority />
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">404</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">Esta página no existe</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Puede que el enlace esté viejo o mal escrito. · This page doesn&apos;t exist — the link may
        be old or mistyped.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Volver al inicio · Back home
      </Link>
    </div>
  );
}
