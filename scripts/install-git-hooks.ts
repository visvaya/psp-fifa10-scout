// Points Git at the versioned hooks in .githooks/. Runs from `pnpm install` (prepare).
// Skips outside a Git work tree (a source archive) and under CI, where nobody commits.
import { execFileSync } from "node:child_process";

const git = (args: readonly string[]): string =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

const insideWorkTree = (): boolean => {
  try {
    return git(["rev-parse", "--is-inside-work-tree"]) === "true";
  } catch {
    return false;
  }
};

if (process.env["CI"] === undefined && insideWorkTree()) {
  git(["config", "core.hooksPath", ".githooks"]);
}
