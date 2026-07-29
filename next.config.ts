import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A different service-worker script URL per Git commit makes open PWA tabs
  // discover every deployment, even when public/sw.js itself is unchanged.
  env: {
    NEXT_PUBLIC_CLARA_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.NEXT_PUBLIC_CLARA_BUILD_ID ??
      "local",
  },
};

export default nextConfig;
