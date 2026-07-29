import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local git worktrees (.gitignored). Without this, a worktree's own .next
    // build output gets linted — 500+ errors from generated bundles that CI,
    // which checks out a clean tree, never sees. That divergence makes the
    // lint ratchet meaningless locally.
    ".worktrees/**",
    // Harness-managed worktrees live under .claude/worktrees (same failure
    // mode as above). Only that subdirectory: .claude/agents/** stays linted
    // where applicable and stays tracked.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
