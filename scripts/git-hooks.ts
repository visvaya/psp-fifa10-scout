// Shared Git hook logic, invoked by .githooks/*.
//
// Usage: node scripts/git-hooks.ts pre-commit
//        node scripts/git-hooks.ts commit-msg <message-file>
//
// The commit format itself is checked by commitlint (commitlint.config.mjs); this file adds
// what commitlint cannot express: commit identity, co-author and generated-by lines,
// forbidden characters and absolute local paths.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { findFileProblems, findTextProblems } from "./check-text.ts";

/** E-mail addresses allowed as author and committer when the checkout opts in. */
const OWNER_EMAILS = ["84781703+visvaya@users.noreply.github.com"];

const FORBIDDEN_MESSAGE_LINES = [/^co-authored-by:/im, /^\W*generated (?:with|by)\s/im];

// Only source files: documentation may legitimately cite a path.
const CODE_FILE = /\.(?:mjs|js|jsx|ts|tsx)$/;
const ABSOLUTE_PATH = /["'`](?:[A-Za-z]:\\|\/home\/|\/Users\/)/;

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

export const hasAbsolutePath = (file: string, content: string): boolean =>
  CODE_FILE.test(file) && ABSOLUTE_PATH.test(content);

/** The maintainer opts in per checkout (`git config hooks.requireOwnerIdentity true`), so a
 * contributor's own identity is not rejected in a fork. */
const ownerIdentityRequired = (): boolean => {
  try {
    return git(["config", "--bool", "--get", "hooks.requireOwnerIdentity"]) === "true";
  } catch {
    return false;
  }
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
  const leaked = staged.filter((file) => hasAbsolutePath(file, stagedContent(file)));
  if (leaked.length > 0) fail(`Absolute local paths found in:\n  ${leaked.join("\n  ")}`);
  const textProblems = staged.flatMap(findFileProblems);
  if (textProblems.length > 0) fail(`Forbidden characters found:\n${textProblems.join("\n")}`);
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
