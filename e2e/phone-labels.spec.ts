// The labels over the phone rows' numbers: sorting by them, and showing a focused one.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  fadeStart,
  filterByAttributes,
  guardSecurityPolicy,
  loadDatabase,
  PHONE,
  showPotential,
} from "./support.ts";

guardSecurityPolicy();

/** Filters by acceleration and sprint speed, which adds their two columns. */
const filterBySpeed = async (page: Page) => filterByAttributes(page, "Przyspieszenie", "Szybkość");

const scrollLeftOf = (element: Element) => element.scrollLeft;

test.describe("phone column labels", () => {
  test.use(PHONE);

  // As in the wide table: a tap on a column's label sorts by it, another tap turns the order round.
  test("sorts by a column when its label is tapped", async ({ page }) => {
    await loadDatabase(page);
    await showPotential(page);
    const sortBy = page.getByLabel("Sortuj według");
    const potential = page.getByRole("button", { name: /^POT/u });
    await potential.tap();
    await expect(sortBy).toHaveValue("potential");
    await expect(potential).toHaveAccessibleName("POT, malejąco");
    await potential.tap();
    await expect(potential).toHaveAccessibleName("POT, rosnąco");
    await expect(page.getByRole("button", { name: "rosnąco", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^OVR/u })).toHaveAccessibleName("OVR");
    // The players' column has its label too, and it sorts by name.
    await page.getByRole("button", { name: "Zawodnik" }).tap();
    await expect(sortBy).toHaveValue("name");
  });
});

test.describe("phone label focus", () => {
  test.use(PHONE);

  // A label partly off screen, with more columns after it, shows clear of the right edge's fade.
  test("keeps a focused label clear of the fade at the right edge", async ({ page }) => {
    await loadDatabase(page);
    await filterBySpeed(page);
    await page.getByLabel("Sortuj według").selectOption("height");
    const labels = page.locator(".player-rows-header .column-label");
    await expect(labels).toHaveCount(4);
    await labels.nth(2).focus();
    await expect(page.locator(".phone-list")).toHaveAttribute("data-more");
    await expect
      .poll(async () => {
        const box = await labels.nth(2).boundingBox();
        return (box?.x ?? Infinity) + (box?.width ?? 0) <= (await fadeStart(page)) + 1;
      })
      .toBe(true);
  });
});

test.describe("phone label focus on narrow screens", () => {
  test.use({ ...PHONE, viewport: { width: 320, height: 844 } });

  // On a narrow screen a long label may not fit beside the name: it shows from its start.
  test("shows a focused label too wide for the room from its start", async ({ page }) => {
    await loadDatabase(page);
    await filterByAttributes(page, "Świadomość taktyczna");
    await page.getByLabel("Sortuj według").selectOption("height");
    const label = page.getByRole("button", { name: /^Świadomość taktyczna/u });
    await label.focus();
    const nameEnd = async () => {
      const box = await page.locator(".player-rows-grid > :first-child").boundingBox();
      return (box?.x ?? 0) + (box?.width ?? 0);
    };
    await expect
      .poll(async () => (await label.boundingBox())?.x ?? 0)
      .toBeGreaterThanOrEqual(await nameEnd());
  });

  // The kept name narrows as the list scrolls: a label that fits beside the narrowed name shows whole,
  // clear of both the name and the fade.
  test("shows a focused label whole once the name has narrowed", async ({ page }) => {
    await page.setViewportSize({ width: 365, height: 844 });
    await loadDatabase(page);
    // OVR and POT first, so the name keeps a wide column until the list scrolls.
    await showPotential(page);
    await filterByAttributes(page, "Świadomość taktyczna");
    await page.getByLabel("Sortuj według").selectOption("height");
    // The sorted column arrives a moment later (a deferred value); focus once it is there.
    await expect(page.locator(".player-rows-header .column-label")).toHaveCount(4);
    const label = page.getByRole("button", { name: /^Świadomość taktyczna/u });
    await label.focus();
    const edges = async () => {
      const [box, name, fade] = await Promise.all([
        label.boundingBox(),
        page.locator(".player-rows-grid > :first-child").boundingBox(),
        fadeStart(page),
      ]);
      return {
        clearOfName: (box?.x ?? 0) >= (name?.x ?? 0) + (name?.width ?? 0),
        clearOfFade: (box?.x ?? 0) + (box?.width ?? 0) <= fade + 1,
      };
    };
    await expect.poll(edges).toEqual({ clearOfName: true, clearOfFade: true });
  });

  // A label off screen that gets the focus scrolls into view, and the rows with it, or the label would
  // stay hidden or stand over another column's values.
  test("moves the rows along when a label off screen gets the focus", async ({ page }) => {
    await loadDatabase(page);
    await filterBySpeed(page);
    await page.locator(".player-rows-header .column-label").last().focus();
    const [header, list] = [page.locator(".player-rows-header"), page.locator(".scroll")];
    // Whole on screen, measured: WebKit's viewport check misjudges a label in the scrolled header.
    const label = page.locator(".player-rows-header .column-label").last();
    await expect
      .poll(async () => {
        const box = await label.boundingBox();
        return (box?.x ?? Infinity) + (box?.width ?? 0);
      })
      .toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
    await expect
      .poll(async () => list.evaluate(scrollLeftOf))
      .toBe(await header.evaluate(scrollLeftOf));
  });
});
