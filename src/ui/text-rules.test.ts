// The writing rules of docs/ui-text.md, checked on every fixed UI text (texts built by a function are
// checked where their own tests call them).
import { describe, expect, it } from "vitest";
import { startDescription } from "./test-support/start-description.ts";
import { WARNING_TEXT } from "./text-help.ts";
import { tie } from "./typeset.ts";

const stringsIn = (value: unknown): readonly string[] => {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap(stringsIn);
};

/** The description of the tool, static HTML in index.html: each block's text and each image's alt text. */
const descriptionStrings = (): readonly string[] => {
  const { blocks, images } = startDescription();
  return [...blocks.map((block) => block.text), ...images.map((image) => image["alt"] ?? "")];
};

/**
 * Every UI text module (text.ts and text-*.ts beside it), found by name, so a new module cannot slip past
 * the rules: a hand-kept list had left some out.
 */
const TEXT_MODULES = import.meta.glob<Readonly<Record<string, unknown>>>(
  ["./text.ts", "./text-*.ts", "!./*.test.ts"],
  { eager: true },
);

const STRINGS = stringsIn([...Object.values(TEXT_MODULES), descriptionStrings()]);

/** Address pronouns from a capital letter, though not at the start of a sentence. */
const CAPITAL_PRONOUN =
  /(?<!^|[.?:]\s)(?<!\p{L})(?:Twój|Twoja|Twoje|Twojego|Twojej|Twoim|Twoją|Tobie|Ciebie|Cię|Ty)(?!\p{L})/u;

const CLICHES =
  /najwyższ|innowacyjn|rewolucyjn|bezproblemow|seamless|next-gen|na wyższy poziom|(?<!\p{L})Odkryj/iu;

describe("UI texts", () => {
  it("covers the text modules", () => {
    expect(Object.keys(TEXT_MODULES)).toContain("./text-level-up.ts");
    expect(Object.keys(TEXT_MODULES)).not.toContain("./text-rules.test.ts");
    expect(STRINGS.length).toBeGreaterThan(200);
    // The rules reach the description of the start page, not an empty reading of it.
    expect(descriptionStrings().length).toBeGreaterThan(15);
  });

  it.each([
    [
      "ties one-letter words, abbreviations and numbers to the next word",
      (text: string) => tie(text) !== text,
    ],
    // The "!" button's mark is a sign, not a sentence (owner, 2026-11-07: "czerwonawy wykrzyknik").
    ["has no exclamation mark", (text: string) => text !== WARNING_TEXT.mark && text.includes("!")],
    ["writes an ellipsis as one character", (text: string) => text.includes("...")],
    ["addresses the reader in lower case", (text: string) => CAPITAL_PRONOUN.test(text)],
    ["uses no stock phrases", (text: string) => CLICHES.test(text)],
    ["puts the percent sign right after the number", (text: string) => /\d\s+%/u.test(text)],
  ])("%s", (_rule, breaks) => {
    expect(STRINGS.filter(breaks)).toEqual([]);
  });
});
