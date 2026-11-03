// Fails when a text file contains an emoji or an em dash (U+2014).
//
// Usage: node scripts/check-text.ts [file ...]
// Without arguments it scans every file Git would commit (tracked and untracked, not
// ignored). scripts/git-hooks.ts applies the same rules to commit messages.
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

/** Problems in one text, each as "label:line: reason". */
export const findTextProblems = (text: string, label: string): string[] =>
  text
    .split("\n")
    .flatMap((line, index) =>
      [EM_DASH.test(line) ? EM_DASH_MESSAGE : null, EMOJI.test(line) ? "emoji" : null]
        .filter((reason) => reason !== null)
        .map((reason) => `${label}:${index + 1}: ${reason}`),
    );

export const findFileProblems = (file: string): string[] => {
  const normalized = file.replaceAll("\\", "/");
  const skipped =
    SKIPPED_FILES.has(normalized) ||
    BINARY_EXTENSIONS.has(path.extname(normalized).toLowerCase()) ||
    !existsSync(file);
  return skipped ? [] : findTextProblems(readFileSync(file, "utf8"), normalized);
};

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
