// Fails when a text file contains an emoji, an em dash (U+2014), a control character or an absolute
// local path.
//
// Usage: node scripts/check-text.ts [file ...]
// Without arguments it scans every file Git would commit (tracked and untracked, not
// ignored). scripts/git-hooks.ts applies the same rules to staged files, and all but the path
// rule to commit messages.
//
// Characters are built with String.fromCodePoint so this file passes its own check.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const chars = (...codes: readonly number[]): string =>
  codes.map((code) => String.fromCodePoint(code)).join("");

const EM_DASH = new RegExp(chars(0x2014), "u");

// Text symbols that Unicode also lists as pictographic: (c), (R), TM and the plain arrows
// U+2194-U+2199. Everything else pictographic counts as an emoji.
const TEXT_SYMBOLS = chars(0xa9, 0xae, 0x2122, 0x2194, 0x2195, 0x2196, 0x2197, 0x2198, 0x2199);
const EMOJI = new RegExp(
  `\\p{Emoji_Presentation}|(?![${TEXT_SYMBOLS}])\\p{Extended_Pictographic}`,
  "u",
);

const SKIPPED_FILES = new Set(["pnpm-lock.yaml", "LICENSE"]);
const BINARY_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff2"]);

const EM_DASH_MESSAGE = "em dash (U+2014); use an en dash (U+2013) or a middle dot (U+00B7)";

// C0 control characters but the tab and the carriage return (a CRLF line ending), and DEL. They never
// belong in source or notes; one usually means an escape got lost on the way into the file.
const ALLOWED_CONTROLS = new Set([0x09, 0x0d]);

const isControl = (code: number): boolean =>
  (code < 0x20 && !ALLOWED_CONTROLS.has(code)) || code === 0x7f;

const controlMessage = (line: string): string | null => {
  // Control characters are single UTF-16 units, so the units are enough.
  const code = Array.from({ length: line.length }, (_, index) => line.charCodeAt(index)).find(
    isControl,
  );
  return code === undefined
    ? null
    : `control character U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
};

// A drive letter not preceded by a word character (so neither a URL scheme nor a YAML key such as "e2e:\n"
// in a string counts), or a home directory. A path like this names the author's machine and has no meaning
// in a checkout elsewhere.
const ABSOLUTE_PATH = /(?<!\w)[A-Za-z]:[\\/]|\/home\/|\/Users\//;
const ABSOLUTE_PATH_MESSAGE = "absolute local path; use a relative path";

type LineCheck = (line: string) => string | null;

const TEXT_CHECKS: readonly LineCheck[] = [
  (line) => (EM_DASH.test(line) ? EM_DASH_MESSAGE : null),
  (line) => (EMOJI.test(line) ? "emoji" : null),
  controlMessage,
];

const FILE_CHECKS: readonly LineCheck[] = [
  ...TEXT_CHECKS,
  (line) => (ABSOLUTE_PATH.test(line) ? ABSOLUTE_PATH_MESSAGE : null),
];

const findProblems = (text: string, label: string, checks: readonly LineCheck[]): string[] =>
  text.split("\n").flatMap((line, index) =>
    checks
      .map((check) => check(line))
      .filter((reason) => reason !== null)
      .map((reason) => `${label}:${index + 1}: ${reason}`),
  );

/** Problems in one text, such as a commit message, each as "label:line: reason". */
export const findTextProblems = (text: string, label: string): string[] =>
  findProblems(text, label, TEXT_CHECKS);

/** Whether a file's content is scanned at all: binary files, the lockfile and the licence are not. */
export const isScanned = (file: string): boolean => {
  const normalized = file.replaceAll("\\", "/");
  return (
    !SKIPPED_FILES.has(normalized) && !BINARY_EXTENSIONS.has(path.extname(normalized).toLowerCase())
  );
};

/** Problems in the content of a scanned file: the text rules plus absolute local paths. */
export const findContentProblems = (content: string, file: string): string[] =>
  findProblems(content, file.replaceAll("\\", "/"), FILE_CHECKS);

export const findFileProblems = (file: string): string[] =>
  isScanned(file) && existsSync(file) ? findContentProblems(readFileSync(file, "utf8"), file) : [];

const listFiles = (args: readonly string[]): readonly string[] =>
  args.length > 0
    ? args
    : execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
        encoding: "utf8",
      })
        .split("\0")
        .filter(Boolean);

if (import.meta.main) {
  const problems = listFiles(process.argv.slice(2)).flatMap(findFileProblems);
  if (problems.length > 0) {
    process.stderr.write(`Forbidden characters found:\n${problems.join("\n")}\n`);
    process.exit(1);
  }
}
