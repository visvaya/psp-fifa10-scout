// The writing rules of docs/ui-text.md, checked on every fixed UI text (texts built by a function are
// checked where their own tests call them).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ATTRIBUTE_GROUP_LABELS,
  ATTRIBUTE_LABELS,
  CLUB_STATUS_LABELS,
  FILTER_SECTION_LABELS,
  FLAG_LABELS,
  LIST_LABELS,
  MY_CLUB_LABELS,
  POSITION_GROUP_LABELS,
  RANGE_LABELS,
  TEXT,
} from "./text.ts";
import { FILTER_SETS_TEXT } from "./text-filter-sets.ts";
import { CODE_NAMES } from "./text-code-names.ts";
import { FIELD_HELP } from "./text-help.ts";
import { GROUP_STAT_PREFIXES } from "./text-range-labels.ts";
import { OFFER_TEXT } from "./text-offer.ts";
import { tie } from "./typeset.ts";

const stringsIn = (value: unknown): readonly string[] => {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap(stringsIn);
};

// Only the ASCII white space of the markup collapses: a non-breaking space is text.
const collapse = (text: string): string => text.replaceAll(/[ \t\r\n]+/gu, " ").trim();

/**
 * The description of the tool is static HTML in index.html: the text of each heading, paragraph, list item,
 * question and caption, and each image's alt text, with its white space collapsed as a browser shows it.
 */
const descriptionStrings = (): readonly string[] => {
  const html = readFileSync(path.join(import.meta.dirname, "..", "..", "index.html"), "utf8");
  const about = /<section id="about"[\s\S]*?<\/section>/u.exec(html)?.[0] ?? "";
  const blocks = [
    ...about.matchAll(/<(h2|h3|li|p|summary|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gu),
  ].map((block) => collapse((block[2] ?? "").replaceAll(/<[^>]*>/gu, "")));
  const alts = [...about.matchAll(/\salt="([^"]*)"/gu)].map((alt) => alt[1] ?? "");
  return [...blocks, ...alts];
};

const STRINGS = stringsIn([
  ATTRIBUTE_GROUP_LABELS,
  ATTRIBUTE_LABELS,
  CLUB_STATUS_LABELS,
  FILTER_SECTION_LABELS,
  FLAG_LABELS,
  GROUP_STAT_PREFIXES,
  LIST_LABELS,
  MY_CLUB_LABELS,
  POSITION_GROUP_LABELS,
  RANGE_LABELS,
  TEXT,
  FILTER_SETS_TEXT,
  OFFER_TEXT,
  FIELD_HELP,
  CODE_NAMES,
  descriptionStrings(),
]);

/** Address pronouns from a capital letter, though not at the start of a sentence. */
const CAPITAL_PRONOUN =
  /(?<!^|[.?:]\s)(?<!\p{L})(?:Twój|Twoja|Twoje|Twojego|Twojej|Twoim|Twoją|Tobie|Ciebie|Cię|Ty)(?!\p{L})/u;

const CLICHES =
  /najwyższ|innowacyjn|rewolucyjn|bezproblemow|seamless|next-gen|na wyższy poziom|(?<!\p{L})Odkryj/iu;

describe("UI texts", () => {
  it("covers the text modules", () => {
    expect(STRINGS.length).toBeGreaterThan(200);
  });

  it.each([
    [
      "ties one-letter words, abbreviations and numbers to the next word",
      (text: string) => tie(text) !== text,
    ],
    ["has no exclamation mark", (text: string) => text.includes("!")],
    ["writes an ellipsis as one character", (text: string) => text.includes("...")],
    ["addresses the reader in lower case", (text: string) => CAPITAL_PRONOUN.test(text)],
    ["uses no stock phrases", (text: string) => CLICHES.test(text)],
    ["puts the percent sign right after the number", (text: string) => /\d\s+%/u.test(text)],
  ])("%s", (_rule, breaks) => {
    expect(STRINGS.filter(breaks)).toEqual([]);
  });
});
