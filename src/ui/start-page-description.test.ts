// The description of the tool is static HTML in index.html, so search engines read it without running a script.
// These checks read that file as a crawler would.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NBSP } from "./typeset.ts";

const ROOT = path.join(import.meta.dirname, "..", "..");
const html = readFileSync(path.join(ROOT, "index.html"), "utf8");
const about = /<section id="about"[\s\S]*?<\/section>/u.exec(html)?.[0] ?? "";
// What a crawler reads: the text between the tags, with the non-breaking spaces as the plain ones people search for.
const text = about.replaceAll(/<[^>]*>/gu, "");
const plain = text.replaceAll(NBSP, " ");
const images = [...about.matchAll(/<img\b[^>]*>/gu)].map((match) => match[0]);
const attribute = (tag: string, name: string): string | undefined =>
  new RegExp(String.raw`\s${name}="([^"]*)"`, "u").exec(tag)?.[1];

describe("the description in index.html", () => {
  it("tells what the tool does, which files it needs, privacy, questions and the disclaimer", () => {
    for (const heading of ["Co robi", "Jakie pliki i skąd", "Prywatność", "Najczęstsze pytania"]) {
      expect(about).toMatch(new RegExp(`<h3>${heading.replaceAll(" ", "[ \u00a0]")}</h3>`, "u"));
    }
    expect(about).toContain("<h2");
    expect(plain).toMatch(/Pliki nie opuszczają urządzenia/u);
    expect(plain).toMatch(/nie jest związany z Electronic Arts, FIFA ani Sony/u);
  });

  it("shows each screenshot with a Polish alt text, its size and lazy loading, captioned as sample data", () => {
    expect(images).toHaveLength(3);
    for (const image of images) {
      expect(attribute(image, "alt")?.length).toBeGreaterThan(20);
      expect(Number(attribute(image, "width"))).toBeGreaterThan(0);
      expect(Number(attribute(image, "height"))).toBeGreaterThan(0);
      expect(attribute(image, "loading")).toBe("lazy");
      expect(existsSync(path.join(ROOT, "public", attribute(image, "src") ?? "-"))).toBe(true);
    }
    expect(about.match(/\(przykładowe dane\)<\/figcaption>/gu)).toHaveLength(images.length);
  });
});
