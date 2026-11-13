import type { Page } from "@playwright/test";
import {
  expect,
  fadeStart,
  filterByAttributes,
  loadDatabase,
  openFilters,
  PHONE,
  scrollToEnd,
  showPotential,
  test,
} from "./support.ts";

/** The players whose names hold a text, with four columns beside them that the list scrolls through. */
const showNamed = async (page: Page, name: string) => {
  await loadDatabase(page);
  await filterByAttributes(page, "Przyspieszenie", "Szybkość", "Drybling", "Wytrzymałość");
  const dialog = await openFilters(page);
  await dialog.getByRole("searchbox", { name: "Nazwisko" }).fill(name);
  await dialog.getByRole("button", { name: "Zamknij" }).click();
};

test.describe("phone name column", () => {
  test.use(PHONE);

  // The name keeps the room the first two number columns leave; scrolled sideways it narrows to its minimum,
  // and a name too long for that gives its first name as an initial.
  test("shows two number columns beside the name, then narrows the name as the list scrolls", async ({
    page,
  }) => {
    await loadDatabase(page);
    await showPotential(page);
    await filterByAttributes(page, "Szybkość");
    const row = page.locator(".player-row").first();
    const cells = row.locator(".player-row-cell");
    await expect(cells.nth(1)).toBeInViewport({ ratio: 1 });
    await expect(cells.nth(2)).not.toBeInViewport({ ratio: 1 });
    // The fade at the right edge leaves the second column clear (owner, 2026-11-05) and is solid over
    // the third, past its 8 px ramp in the gap, so none of the third's label shows cut off.
    const frame = page.locator(".phone-list");
    await expect(frame).toHaveAttribute("data-more");
    const labels = page.locator(".player-rows-header .column-label");
    const [second, third, fade] = await Promise.all([
      labels.nth(1).boundingBox(),
      labels.nth(2).boundingBox(),
      fadeStart(page),
    ]);
    expect((second?.x ?? Number.NaN) + (second?.width ?? 0)).toBeLessThanOrEqual(fade + 1);
    expect(third?.x ?? Number.NaN).toBeGreaterThanOrEqual(fade + 8 - 1);
    const name = row.locator(".player-row-text");
    const wide = (await name.boundingBox())?.width ?? Number.NaN;
    await page.locator(".scroll").evaluate((element) => {
      element.scrollTo(30, 0);
    });
    await expect.poll(async () => (await name.boundingBox())?.width).toBeCloseTo(wide - 30, 0);
    await page.locator(".scroll").evaluate(scrollToEnd);
    await expect(cells.last()).toBeInViewport();
    await expect.poll(async () => (await name.boundingBox())?.width).toBeLessThan(wide - 30);
    await expect(frame).not.toHaveAttribute("data-more");
    await expect(frame).toHaveAttribute("data-scrolled");
    // Narrowed, the name column is collapsed: styles.css shows no portrait there (owner, 2026-11-13).
    await expect(frame).toHaveAttribute("data-collapsed");
    await page.locator(".scroll").evaluate((element) => {
      element.scrollTo(0, 0);
    });
    await expect(frame).not.toHaveAttribute("data-collapsed");
  });
});

test.describe("phone name forms", () => {
  // Wide enough for the long test name to fit before the list scrolls.
  test.use({ ...PHONE, viewport: { width: 800, height: 844 } });

  // Row by row (owner, 2026-11-05): a long name keeps its full form while it fits the narrowing column
  // and gives its first name as an initial only once it does not, then back as the column widens.
  test("gives a long name its initial only once it no longer fits", async ({ page }) => {
    await showNamed(page, "bardzo");
    const name = page.locator(".player-row", { hasText: "Bardzo-Długie" });
    const [full, short] = [
      name.locator(".player-row-name-full"),
      name.locator(".player-row-name-short"),
    ];
    await expect(full).toBeVisible();
    await expect(short).toBeHidden();
    // A little scrolled, the full name still fits: it stays (before, every long name switched at once).
    await page.locator(".scroll").evaluate((element) => {
      element.scrollTo(10, element.scrollTop);
    });
    await expect(page.locator(".phone-list")).toHaveAttribute("data-scrolled");
    await expect(full).toBeVisible();
    await expect(short).toBeHidden();
    await page.locator(".scroll").evaluate(scrollToEnd);
    await expect(short).toBeVisible();
    await expect(short).toHaveText(/^G\. Numer 9 Bardzo/u);
    await page.locator(".scroll").evaluate((element) => {
      element.scrollTo(0, element.scrollTop);
    });
    await expect(short).toBeHidden();
    await expect(full).toBeVisible();
  });
});

/**
 * Scrolls the list a few pixels at a time to its end and returns the scroll positions where a long name
 * kept its full form though it did not fit beside its marks (cut off by an ellipsis instead).
 */
const cutFullNames = async (page: Page): Promise<number[]> =>
  page.locator(".scroll").evaluate(async (list) => {
    const end = list.scrollWidth - list.clientWidth;
    // One step after another, each waiting for the list to fit its names.
    const step = async (left: number, cut: readonly number[]): Promise<readonly number[]> => {
      if (left > end) return cut;
      list.scrollTo(left, list.scrollTop);
      await new Promise(requestAnimationFrame);
      const name = list.querySelector<HTMLElement>(".has-initial[data-fit='full']");
      const isCut = name !== null && name.scrollWidth > name.clientWidth;
      return step(left + 4, isCut ? [...cut, left] : cut);
    };
    return [...(await step(0, []))];
  });

test.describe("phone name forms with marks", () => {
  test.use({ ...PHONE, viewport: { width: 800, height: 844 } });

  // The own list's star takes room before the name too: the name switches to its initial as soon as
  // it no longer fits beside the star, rather than being cut off.
  test("counts the own list's star when fitting a long name", async ({ page }) => {
    await showNamed(page, "bardzo");
    await page.locator(".player-row", { hasText: "Bardzo-Długie" }).click();
    await page.getByRole("button", { name: "Dodaj do twojej listy w narzędziu" }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator(".player-row .watch-mark")).toHaveCount(1);
    expect(await cutFullNames(page)).toEqual([]);
  });
});

test.describe("phone short name forms", () => {
  test.use(PHONE);

  // Owner, 2026-11-09: "Nathan Porritt" (14 characters) was cut off by an ellipsis while longer names
  // got their initial. "Gracz Numer 20" has 14 too and no longer fits the scrolled column; "Gracz
  // Numer 2" still does and keeps its full form.
  test("gives a name of 14 characters its initial too once it no longer fits", async ({ page }) => {
    await showNamed(page, "Numer 2");
    await page.locator(".scroll").evaluate(scrollToEnd);
    const form = (kind: "full" | "short", name: string) =>
      page.locator(`.player-row-name-${kind}`).getByText(name, { exact: true });
    await expect(form("short", "G. Numer 20")).toBeVisible();
    await expect(form("short", "G. Numer 2")).toBeHidden();
    await expect(form("full", "Gracz Numer 2")).toBeVisible();
  });
});
