import type { KnipConfig } from "knip";

// Written in TypeScript rather than JSON so every exception carries its reason.
const config: KnipConfig = {
  entry: ["scripts/*.ts"],
  project: ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
  // scripts/git-hooks.ts runs commitlint through `pnpm exec` from the commit-msg hook, which
  // knip cannot see. Removing the package would silently stop enforcing commit messages.
  ignoreDependencies: ["@commitlint/cli"],
};

export default config;
