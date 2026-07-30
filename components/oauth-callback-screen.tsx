"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CharacterIllustration } from "@/components/character";
import { supabase } from "@/lib/db/supabase";

// Where Google sends the user back to. The Supabase client runs with
// detectSessionInUrl:false (magic links and OAuth redirects break out of the
// installed iOS PWA, so nothing is auto-consumed), which means the returned
// token has to be exchanged here by hand — both the PKCE `?code=` shape and the
// implicit `#access_token` hash.
//
// On success this replaces the URL with "/" so the token never lingers in the
// address bar or history; AuthGate then sees a session and renders the app (or
// the "no access" screen if the Google account isn't allow-listed).

export function OAuthCallbackScreen() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const sb = supabase();
      if (!sb) {
        if (active) setError("auth_unavailable");
        return;
      }
      try {
        const url = new URL(window.location.href);
        // Google reports a refusal (closed window, denied consent) as a param.
        const denied = url.searchParams.get("error_description") ?? url.searchParams.get("error");
        const code = url.searchParams.get("code");
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (denied) {
          if (active) setError(denied);
          return;
        }
        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          if (active && error) setError(error.message);
        } else if (accessToken && refreshToken) {
          const { error } = await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (active && error) setError(error.message);
        } else {
          if (active) setError("missing_token");
          return;
        }
        // Success: drop the token from the URL and hand over to the app.
        if (active && !error) window.location.replace("/");
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "unknown");
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 py-10">
      <div className="hero-calm pointer-events-none absolute inset-0" aria-hidden />
      <div className="flag-bar absolute inset-x-0 top-0 h-[3px]" aria-hidden />

      <div className="relative z-10 w-full max-w-sm text-center">
        {/* Waiting on Google is a loading state (`thinking`); a failed
            hand-back is not a Clara moment, so the card carries it alone. */}
        {!error && (
          <div className="mx-auto h-40 w-36 px-1">
            <CharacterIllustration state="thinking" frame="threeQuarter" preload />
          </div>
        )}

        {!error ? (
          <p className="mt-4 text-sm text-muted-foreground">Entrando · Signing you in…</p>
        ) : (
          <div className="mt-4 rounded-3xl border border-hairline bg-card p-6">
            <p className="text-sm text-muted-foreground">
              No pudimos completar el inicio de sesión con Google. Intenta de nuevo o entra con tu
              correo y contraseña.
              <br />
              Couldn&apos;t finish signing in with Google. Try again, or use your email and password.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Volver · Back
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
