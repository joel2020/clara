"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Last-resort boundary: catches errors thrown by the root layout itself, so it
// must render its own <html> and cannot assume any CSS or provider exists.
// Plain inline styles, bilingual, one safe action.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, 'Times New Roman', serif",
          background: "#faf9f6",
          color: "#1a1a1a",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <div aria-hidden style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#f5c518" }} />
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#1f3fa8" }} />
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#c8102e" }} />
          </div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Algo salió mal</h1>
          <p style={{ fontSize: 14, color: "#555", marginTop: 8 }}>
            No fue tu culpa y tu progreso está guardado en este dispositivo. Recarga la página para
            continuar.
          </p>
          <p style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
            Something went wrong. Your progress is saved on this device — reload the page to
            continue.
          </p>
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            style={{
              marginTop: 20,
              borderRadius: 999,
              border: "none",
              background: "#1f3fa8",
              color: "#fff",
              padding: "12px 28px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Recargar · Reload
          </button>
        </div>
      </body>
    </html>
  );
}
