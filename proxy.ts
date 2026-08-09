import { NextResponse, type NextRequest } from "next/server.js";
import { buildContentSecurityPolicy } from "./lib/security-headers.ts";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });

  // Next.js reads the request CSP to extract this nonce for framework scripts.
  // The browser receives the same policy on the response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      // HTML documents only: APIs, Next internals, known public asset folders,
      // and exact root assets stay static. Route parameters may end in a file
      // extension, so suffixes must never decide whether CSP runs.
      source:
        "/((?!api(?:/|$)|_next(?:/|$)|(?:audio|avatars|character|pets|scenes)(?:/|$)|(?:apple-touch-icon\\.png|favicon\\.ico|file\\.svg|globe\\.svg|icon-192\\.png|icon-512\\.png|manifest\\.webmanifest|next\\.svg|sw\\.js|vercel\\.svg|window\\.svg)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
