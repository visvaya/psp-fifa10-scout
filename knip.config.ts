import type { KnipConfig } from "knip";

// Written in TypeScript rather than JSON so every exception carries its reason.
const config: KnipConfig = {
  entry: ["scripts/*.ts"],
  // Every script is an entry, so without this knip would never report an export no other file uses.
  includeEntryExports: true,
  project: ["src/**/*.{ts,tsx}", "scripts/**/*.ts", "e2e/**/*.ts"],
  // scripts/git-hooks.ts runs commitlint through `pnpm exec` from the commit-msg hook, which
  // knip cannot see. Removing the package would silently stop enforcing commit messages.
  ignoreDependencies: ["@commitlint/cli"],
  // The deploy job runs wrangler from deploy/, a separate package with its own lockfile.
  ignoreBinaries: ["wrangler"],
};

export default config;
