// The description of the tool is static HTML in index.html, so search engines read it without running a script.
// These checks read that file as a crawler would.
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { describeStartPage, startDescription } from "./test-support/start-description.ts";
import { NBSP } from "./typeset.ts";

const ROOT = path.join(import.meta.dirname, "..", "..");
const { blocks, images } = startDescription();
const textsOf = (tag: string): string[] =>
  blocks.filter((block) => block.tag === tag).map((block) => block.text.replaceAll(NBSP, " "));
const plain = blocks.map((block) => block.text.replaceAll(NBSP, " ")).join(" ");

describe("reading the description", () => {
  it("takes the text of its blocks and the attributes of its images, whatever markup lies between", () => {
    const html = `<section id="other"><p>outside</p></section>
      <section id="about"><h2 id="t">Title</h2>
        <p>One <code>two</code>
          three <a href="x" title="a > b">four</a>.</p>
        <section><li>nested</li></section>
        <img src="a.webp" alt="Alt text" width="10" />
      </section><p>after</p>`;
    expect(describeStartPage(html)).toEqual({
      blocks: [
        { tag: "h2", text: "Title" },
        { tag: "p", text: "One two three four." },
        { tag: "li", text: "nested" },
      ],
      images: [{ src: "a.webp", alt: "Alt text", width: "10" }],
    });
  });

  it("finds the description in index.html: a heading, many blocks and every image", () => {
    expect(textsOf("h2")).toEqual(["O narzędziu"]);
    expect(blocks.length).toBeGreaterThan(15);
    expect(images).toHaveLength(3);
  });
});

describe("the description in index.html", () => {
  it("tells what the tool does, which files it needs, privacy, questions and the disclaimer", () => {
    expect(textsOf("h3")).toEqual([
      "Co robi",
      "Jakie pliki i skąd",
      "Prywatność",
      "Jak to wygląda",
      "Najczęstsze pytania",
    ]);
    expect(plain).toMatch(/Pliki nie opuszczają urządzenia/u);
    expect(plain).toMatch(/nie jest związany z Electronic Arts, FIFA ani Sony/u);
  });

  it("shows each screenshot with a Polish alt text, its size and lazy loading, captioned as sample data", () => {
    for (const image of images) {
      expect(image["alt"]?.length).toBeGreaterThan(20);
      expect(Number(image["width"])).toBeGreaterThan(0);
      expect(Number(image["height"])).toBeGreaterThan(0);
      expect(image["loading"]).toBe("lazy");
      expect(existsSync(path.join(ROOT, "public", image["src"] ?? "-"))).toBe(true);
    }
    const captions = textsOf("figcaption");
    expect(captions).toHaveLength(images.length);
    expect(captions.every((caption) => caption.endsWith("(przykładowe dane)"))).toBe(true);
  });
});
