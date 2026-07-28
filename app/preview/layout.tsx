"use client";

import Link from "next/link";

// Isolated presentation surface for the premium-ui prototype. Not linked from
// anywhere in the product; exists so the redesign can be seen whole before any
// production route changes. The style tag hides the production header while a
// preview is mounted — the prototypes bring their own chrome.

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <style>{`body > header, body > nav { display: none !important; }`}</style>
      <div className="fixed inset-x-0 top-0 z-50 flex justify-center">
        <Link
          href="/preview"
          className="rounded-b-lg border border-t-0 border-hairline bg-card px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
        >
          Prototipo · redesign/premium-ui
        </Link>
      </div>
      {children}
    </div>
  );
}
