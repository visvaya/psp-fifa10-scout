// The game's images in line with a name (roadmap 121, owner 2026-11-14: "widać ze flaga nie jest
// wyśrodkowana w pionie"): each image's middle at the middle of the text after it. The synthetic database
// has no images, so the probe places one of each shape in a card's row, as game-image.tsx draws them.
import { expect, loadDatabase, test } from "./support.ts";

/** Each shape's middle minus the middle of the text after it, in CSS pixels. */
const offsets = (shapes: readonly string[]) =>
  shapes.map((shape) => {
    const row = document.createElement("dd");
    const image = document.createElement("span");
    image.className = shape === "square" ? "game-image" : `game-image ${shape}`;
    row.append(image, "Brazylia");
    document.querySelector(".facts")?.append(row);
    const text = document.createRange();
    text.selectNodeContents(row.lastChild ?? row);
    const [box, line] = [image.getBoundingClientRect(), text.getClientRects()[0]];
    row.remove();
    return line === undefined ? Infinity : box.top + box.height / 2 - (line.top + line.height / 2);
  });

for (const [name, viewport] of [
  ["wide", { width: 1280, height: 800 }],
  ["phone", { width: 390, height: 844 }],
] as const)
  test.describe(`game images, ${name}`, () => {
    test.use({ viewport });

    test("sit with their middle at the middle of the name after them", async ({ page }) => {
      await loadDatabase(page);
      await page.locator("[data-player-id]").first().click();
      await page.getByRole("dialog").first().locator(".facts").first().waitFor();
      const found = await page.evaluate(offsets, ["square", "flag", "kit"]);
      // Before the fix, half the x-height put them 2 to 2.5 px low.
      for (const offset of found) expect(Math.abs(offset)).toBeLessThanOrEqual(1.5);
    });
  });
