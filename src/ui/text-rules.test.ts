// The writing rules of docs/ui-text.md, checked on every fixed UI text (texts built by a function are
// checked where their own tests call them).
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
import { OFFER_TEXT } from "./text-offer.ts";
import { tie } from "./typeset.ts";

const stringsIn = (value: unknown): readonly string[] => {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap(stringsIn);
};

const STRINGS = stringsIn([
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
  FILTER_SETS_TEXT,
  OFFER_TEXT,
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
  ])("%s", (_rule, breaks) => {
    expect(STRINGS.filter(breaks)).toEqual([]);
  });
});
