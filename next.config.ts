import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { SECURITY_HEADERS } from "./lib/security-headers.ts";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  // A different service-worker script URL per Git commit makes open PWA tabs
  // discover every deployment, even when public/sw.js itself is unchanged.
  env: {
    NEXT_PUBLIC_CLARA_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.NEXT_PUBLIC_CLARA_BUILD_ID ??
      "local",
  },
  async headers() {
    return [{ source: "/(.*)", headers: [...SECURITY_HEADERS] }];
  },
};

const sentryBuildEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: {
    name:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.NEXT_PUBLIC_CLARA_BUILD_ID ??
      "local",
  },
  silent: true,
  sourcemaps: {
    disable: !sentryBuildEnabled,
    deleteSourcemapsAfterUpload: true,
  },
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
