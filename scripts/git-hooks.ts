// Shared Git hook logic, invoked by .githooks/*.
//
// Usage: node scripts/git-hooks.ts pre-commit
//        node scripts/git-hooks.ts commit-msg <message-file>
//
// The commit format itself is checked by commitlint (commitlint.config.mjs); this file adds
// what commitlint cannot express: commit identity, co-author and generated-by lines, and the
// rules of check-text.ts (forbidden characters, absolute local paths) on the staged content.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { findContentProblems, findTextProblems, isScanned } from "./check-text.ts";

/** E-mail addresses allowed as author and committer when the checkout opts in. */
const OWNER_EMAILS = ["84781703+visvaya@users.noreply.github.com"];

// A prefix such as "# " still counts: git keeps comment lines with -m and -F.
const FORBIDDEN_MESSAGE_LINES = [/^\W*co-authored-by\s*:/im, /^\W*generated (?:with|by)\s/im];

const fail = (message: string): never => {
  process.stderr.write(`\n[git hook] ${message}\n\n`);
  process.exit(1);
};

const git = (args: readonly string[]): string =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

const identityEmail = (ident: string): string => /<([^>]*)>/.exec(ident)?.[1]?.toLowerCase() ?? "";

export const isOwnerIdentity = (ident: string): boolean =>
  OWNER_EMAILS.some((email) => email.toLowerCase() === identityEmail(ident));

/**
 * git commit -v puts the diff below this whole line, after its comment character (# unless
 * core.commentChar says otherwise), and drops everything from it on.
 */
const SCISSORS = /^\S -{24} >8 -{24}$/mu;

/**
 * Problems in a commit message. Comment lines count: git keeps them with -m and -F (its default
 * cleanup strips them only from an edited message); the diff below a scissors line does not. The
 * text is checked untrimmed, so no character at its ends escapes the check.
 */
export const commitMessageProblems = (raw: string): string[] => {
  const scissors = SCISSORS.exec(raw);
  const message = scissors === null ? raw : raw.slice(0, scissors.index);
  const attribution = FORBIDDEN_MESSAGE_LINES.some((pattern) => pattern.test(message));
  return [
    ...(attribution ? ["co-author or generated-by line; remove it"] : []),
    ...findTextProblems(message, "commit message"),
  ];
};

/** The maintainer opts in per checkout (`git config hooks.requireOwnerIdentity true`), so a
 * contributor's own identity is not rejected in a fork. Only an unset key (exit status 1) means
 * no; an invalid value stops the hook rather than turning the check off. */
const ownerIdentityRequired = (): boolean => {
  const result = spawnSync("git", ["config", "--bool", "--get", "hooks.requireOwnerIdentity"], {
    encoding: "utf8",
  });
  if (result.status === 1) return false;
  if (result.status !== 0) {
    // A git that cannot start leaves no stderr, only the error.
    fail(
      `git config hooks.requireOwnerIdentity failed: ${String(result.error ?? result.stderr).trim()}`,
    );
  }
  return result.stdout.trim() === "true";
};

const checkIdentity = (): void => {
  if (!ownerIdentityRequired()) return;
  for (const role of ["GIT_AUTHOR_IDENT", "GIT_COMMITTER_IDENT"]) {
    if (!isOwnerIdentity(git(["var", role]))) fail(`${role} is not the owner's identity.`);
  }
};

const stagedContent = (file: string): string =>
  execFileSync("git", ["show", `:${file}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// pnpm is a .cmd shim on Windows, which Node starts only through a shell. The command is one
// string because passing an args array together with `shell: true` is deprecated (DEP0190).
const runPnpm = (command: string): number | null =>
  spawnSync(`pnpm ${command}`, { stdio: "inherit", shell: true }).status;

const preCommit = (): void => {
  checkIdentity();
  const staged = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
    .split("\0")
    .filter(Boolean);
  if (staged.length === 0) return;
  // The staged content, not the working tree: that is what the commit records.
  const problems = staged
    .filter(isScanned)
    .flatMap((file) => findContentProblems(stagedContent(file), file));
  if (problems.length > 0) fail(`Forbidden content found:\n${problems.join("\n")}`);
  if (runPnpm("verify:fast") !== 0) fail("pnpm verify:fast failed.");
};

const commitMsg = (file: string): void => {
  // Git passes a path inside .git; quoted in case the checkout path has spaces.
  if (runPnpm(`exec commitlint --edit "${file}"`) !== 0) fail("commitlint rejected the message.");
  const problems = commitMessageProblems(readFileSync(file, "utf8"));
  if (problems.length > 0) fail(problems.join("\n"));
};

if (import.meta.main) {
  const [hook, argument] = process.argv.slice(2);
  if (hook === "pre-commit") preCommit();
  else if (hook === "commit-msg" && argument !== undefined) commitMsg(argument);
  else fail(`Unknown hook invocation: ${process.argv.slice(2).join(" ")}`);
}
