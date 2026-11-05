// The line under each name on the phone rows: position, age and club, shortened whole part by part.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { filterByAttributes, guardSecurityPolicy, loadDatabase, PHONE } from "./support.ts";

guardSecurityPolicy();

interface LineState {
  readonly parts: number;
  readonly swap: string | null;
}

/** Each shown line's count of whole parts and its fade marker. */
const lineStates = (page: Page): Promise<LineState[]> =>
  page.locator(".player-row-meta").evaluateAll((all) =>
    all.map((line) => ({
      parts: Number(line.getAttribute("data-parts")),
      swap: line.getAttribute("data-swap"),
    })),
  );

/** Some line has fewer parts than before and a new fade marker: its fade replayed. */
const someLineFaded = (before: readonly LineState[], after: readonly LineState[]): boolean =>
  after.some(
    ({ parts, swap }, index) =>
      parts < (before[index]?.parts ?? 0) && swap !== null && swap !== before[index]?.swap,
  );

test.describe("phone name lines", () => {
  test.use(PHONE);

  // A row already shown fades its new line in when it loses a part, as a name does (owner, 2026-11-05).
  test("fades the line under a name in when it loses a part", async ({ page }) => {
    await loadDatabase(page);
    await filterByAttributes(page, "Przyspieszenie", "Szybkość", "Drybling", "Wytrzymałość");
    await expect(page.locator(".player-row-meta").first()).toHaveAttribute("data-parts");
    const before = await lineStates(page);
    await page.locator(".scroll").evaluate((list) => {
      list.scrollTo(list.scrollWidth, list.scrollTop);
    });
    await expect.poll(async () => someLineFaded(before, await lineStates(page))).toBe(true);
  });
});
