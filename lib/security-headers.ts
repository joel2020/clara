interface ContentSecurityPolicyOptions {
  nonce: string;
  supabaseUrl?: string;
  sentryDsn?: string;
  isDevelopment?: boolean;
}

const CSP_NONCE = /^[A-Za-z0-9+/_-]+={0,2}$/;

function supabaseConnectSources(rawUrl: string | undefined): string[] {
  if (!rawUrl || rawUrl !== rawUrl.trim()) return [];

  try {
    const url = new URL(rawUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return [];
    }

    const websocketUrl = new URL(url.origin);
    websocketUrl.protocol = "wss:";
    return [url.origin, websocketUrl.origin];
  } catch {
    return [];
  }
}

function sentryConnectSources(rawDsn: string | undefined): string[] {
  if (!rawDsn || rawDsn !== rawDsn.trim()) return [];

  try {
    const url = new URL(rawDsn);
    const isOfficialIngestHost = /^o\d+\.ingest(?:\.[a-z]{2})?\.sentry\.io$/i.test(url.hostname);
    if (
      url.protocol !== "https:" ||
      !url.username ||
      url.password ||
      url.port ||
      !isOfficialIngestHost ||
      !/^\/\d+$/.test(url.pathname) ||
      url.search ||
      url.hash
    ) {
      return [];
    }

    return [url.origin];
  } catch {
    return [];
  }
}

export function buildContentSecurityPolicy({
  nonce,
  supabaseUrl,
  sentryDsn,
  isDevelopment = process.env.NODE_ENV === "development",
}: ContentSecurityPolicyOptions): string {
  if (!CSP_NONCE.test(nonce)) throw new Error("Invalid CSP nonce");

  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDevelopment) scriptSources.push("'unsafe-eval'");

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.youtube.com",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "worker-src 'self'",
    `connect-src ${[
      "'self'",
      ...supabaseConnectSources(supabaseUrl),
      ...sentryConnectSources(sentryDsn),
    ].join(" ")}`,
    "frame-src https://www.youtube-nocookie.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
  // Promote includeSubDomains/preload only after every production subdomain is
  // inventoried and verified HTTPS-only; both flags create domain-wide risk.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];
