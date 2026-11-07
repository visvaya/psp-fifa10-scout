import type { Page } from "@playwright/test";
import {
  expect,
  expectCount,
  expectNoAxeViolations,
  expectStored,
  expectStoredSearchCleared,
  loadDatabase,
  readStored,
  test,
  writeStored,
} from "./support.ts";

/** Finds the one player and opens his card. */
const openBrozek = async (page: Page) => {
  await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
  await page.getByRole("button", { name: /^Paweł Brożek/u }).click();
  return page.getByRole("dialog", { name: "Paweł Brożek" });
};

/** Chooses an option of the list field. */
const onList = async (page: Page, option: string) => {
  await page
    .getByRole("group", { name: "Na liście", exact: true })
    .getByRole("radio", { name: option })
    .check();
};

test.describe("own watchlist", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // The list has no limit of 20 and no link to the game's wish list: it stays in the browser, comes back
  // after a reload and filters the list.
  test("keeps a player across a reload and filters by it", async ({ page }) => {
    await loadDatabase(page);
    const card = await openBrozek(page);
    await card.getByRole("button", { name: "Dodaj do twojej listy w narzędziu" }).click();
    await expect(
      card.getByRole("button", { name: "Usuń z twojej listy w narzędziu" }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
    // Not a reload before the write commits, which would restore the previous list.
    await expectStored(page, "watchlist", { schemaVersion: 2, value: [{}] });
    await page.keyboard.press("Escape");
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("");
    await expectStoredSearchCleared(page);
    await page.reload();
    await expectCount(page, "62 zawodników");

    await onList(page, "w narzędziu");
    await expectCount(page, "1 zawodnik");
    await expect(
      page.getByRole("button", { name: "Usuń filtr: Na liście: w narzędziu" }),
    ).toBeVisible();
    // The own list's star before his name, named for screen readers.
    await expect(page.getByRole("button", { name: /^Paweł Brożek/u })).toHaveAccessibleName(
      "Paweł Brożek na twojej liście w narzędziu",
    );
    await expect(page.locator(".watch-mark")).toHaveCount(1);
    // Without a career there is no game shortlist to choose.
    await expect(page.getByRole("radio", { name: "w grze" })).toHaveCount(0);
  });
});

test.describe("own watchlist, focus and store", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // With the own list filter set, a removed player leaves the list: the focus goes to the results.
  test("returns the focus to the results when the card's player left the list", async ({
    page,
  }) => {
    await loadDatabase(page);
    const card = await openBrozek(page);
    await card.getByRole("button", { name: "Dodaj do twojej listy w narzędziu" }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("");
    await onList(page, "w narzędziu");
    await expectCount(page, "1 zawodnik");
    await page.getByRole("button", { name: /^Paweł Brożek/u }).click();
    await page.getByRole("button", { name: "Usuń z twojej listy w narzędziu" }).click();
    await page.keyboard.press("Escape");
    await expectCount(page, "0 zawodników");
    await expect(page.locator("#results-title")).toBeFocused();
    await onList(page, "na żadnej");
    await expectCount(page, "62 zawodników");
  });

  // A record the app cannot read (here: of a later version) is not replaced by an empty list at the start.
  test("leaves an unreadable stored list alone until the user changes it", async ({ page }) => {
    await loadDatabase(page);
    const foreign = {
      schemaVersion: 3,
      value: [{ playerId: 1, addedAt: "2026-11-05T10:00:00.000Z" }],
    };
    await page.evaluate(writeStored, ["watchlist", foreign] as const);
    await page.reload();
    await expectCount(page, "62 zawodników");
    // The preferences are stored after the start; a write of the list would be stored before them.
    await page.getByRole("checkbox", { name: "Bramkarz" }).check();
    await expectStored(page, "preferences", {
      value: { filters: { lists: { positionGroup: ["goalkeeper"] } } },
    });
    expect(await page.evaluate(readStored, "watchlist")).toEqual(foreign);
  });
});

test.describe("own watchlist in the table", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // The name column makes room for the own list's star too, so the longest name is not cut off by it.
  test("keeps the longest name whole beside the own list's star", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("bardzo");
    const name = page.getByRole("button", { name: /Bardzo-Długie/u });
    await name.click();
    await page.getByRole("button", { name: "Dodaj do twojej listy w narzędziu" }).click();
    await page.keyboard.press("Escape");
    await expect(name.locator(".watch-mark")).toBeVisible();
    const overflow = await name.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
