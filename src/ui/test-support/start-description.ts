// Reads the description of the tool out of index.html for the tests, as the page's own text: a tokenizer that
// walks the markup character by character (no tag stripping by pattern), so headings, paragraphs, list items,
// questions, captions and the images' attributes come out as a crawler would read them.
import { readFileSync } from "node:fs";
import path from "node:path";

const INDEX_HTML = path.join(import.meta.dirname, "..", "..", "..", "index.html");
const SECTION_ID = "about";
const TEXT_BLOCK_TAGS = new Set(["h2", "h3", "li", "p", "summary", "figcaption"]);

interface DescriptionBlock {
  readonly tag: string;
  /** The text with the markup's white space collapsed to single spaces; non-breaking spaces stay. */
  readonly text: string;
}

export interface StartDescription {
  readonly blocks: readonly DescriptionBlock[];
  /** The attributes of each image, by name. */
  readonly images: readonly Readonly<Record<string, string>>[];
}

interface Tag {
  readonly name: string;
  readonly closing: boolean;
  readonly attributes: Readonly<Record<string, string>>;
}

const collapse = (text: string): string => text.replaceAll(/[ \t\r\n]+/gu, " ").trim();

/** The tag that starts at `html[start]` (a "<") and the index after its ">"; quoted values may hold a ">". */
const readTag = (html: string, start: number): { readonly tag: Tag; readonly end: number } => {
  let quote = "";
  let end = start + 1;
  while (end < html.length && (quote !== "" || html[end] !== ">")) {
    const char = html[end] ?? "";
    if (quote === "" && (char === '"' || char === "'")) quote = char;
    else if (char === quote) quote = "";
    end += 1;
  }
  const inside = html.slice(start + 1, end);
  const closing = inside.startsWith("/");
  const name = (closing ? inside.slice(1) : inside).split(/[\s/]/u)[0]?.toLowerCase() ?? "";
  const attributes = Object.fromEntries(
    [...inside.matchAll(/([\w-]+)="([^"]*)"/gu)].map((match) => [match[1] ?? "", match[2] ?? ""]),
  );
  return { tag: { name, closing, attributes }, end: end + 1 };
};

type Token = { readonly text: string } | { readonly tag: Tag };

/** The page as text and tags, in order. */
const tokenize = (html: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < html.length) {
    if (html[index] === "<") {
      const { tag, end } = readTag(html, index);
      tokens.push({ tag });
      index = end;
    } else {
      const next = html.indexOf("<", index);
      const stop = next === -1 ? html.length : next;
      tokens.push({ text: html.slice(index, stop) });
      index = stop;
    }
  }
  return tokens;
};

const startsSection = (tag: Tag): boolean =>
  !tag.closing && tag.name === "section" && tag.attributes["id"] === SECTION_ID;

/** The tokens inside the description section, up to the tag that closes it (sections may nest). */
const sectionTokens = (tokens: readonly Token[]): Token[] => {
  const first = tokens.findIndex((token) => "tag" in token && startsSection(token.tag));
  if (first === -1) return [];
  let depth = 1;
  const inside: Token[] = [];
  for (const token of tokens.slice(first + 1)) {
    if ("tag" in token && token.tag.name === "section") depth += token.tag.closing ? -1 : 1;
    if (depth === 0) break;
    inside.push(token);
  }
  return inside;
};

/** The blocks and images of the description section of an HTML text. */
export const describeStartPage = (html: string): StartDescription => {
  const blocks: DescriptionBlock[] = [];
  const images: Record<string, string>[] = [];
  let open: { readonly tag: string; text: string } | null = null;
  for (const token of sectionTokens(tokenize(html))) {
    if ("text" in token) {
      if (open !== null) open.text += token.text;
    } else if (token.tag.name === "img" && !token.tag.closing) {
      images.push({ ...token.tag.attributes });
    } else if (TEXT_BLOCK_TAGS.has(token.tag.name)) {
      if (!token.tag.closing) {
        open = { tag: token.tag.name, text: "" };
      } else if (open?.tag === token.tag.name) {
        blocks.push({ tag: open.tag, text: collapse(open.text) });
        open = null;
      }
    }
  }
  return { blocks, images };
};

/** The description in the page's index.html; fails when the section is gone, so no test goes quiet. */
export const startDescription = (): StartDescription => {
  const description = describeStartPage(readFileSync(INDEX_HTML, "utf8"));
  if (description.blocks.length === 0) throw new Error(`index.html has no #${SECTION_ID} section`);
  return description;
};
