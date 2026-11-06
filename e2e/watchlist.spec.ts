import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  expectCount,
  expectNoAxeViolations,
  expectStoredPositionGroup,
  expectStoredSearchCleared,
  expectStoredWatchNote,
  guardSecurityPolicy,
  loadDatabase,
  PHONE,
  readStored,
  writeStored,
} from "./support.ts";

guardSecurityPolicy();

/** Finds the one player and opens his card. */
const openBrozek = async (page: Page) => {
  await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
  await page.getByRole("button", { name: /^Paweł Brożek/u }).click();
  return page.getByRole("dialog", { name: "Paweł Brożek" });
};

const NOTE = "Szybki, lewa noga";
const NOTE_FIELD = { name: "Notatka", exact: true } as const;

test.describe("own watchlist", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // The list has no limit of 20 and no link to the game's wish list: it stays in the browser with its
  // notes, comes back after a reload and filters the list.
  test("keeps a player with a note across a reload and filters by it", async ({ page }) => {
    await loadDatabase(page);
    const card = await openBrozek(page);
    const note = card.getByRole("textbox", NOTE_FIELD);
    await expect(note).toBeHidden();
    await card.getByRole("button", { name: "Dodaj do mojej listy" }).click();
    await expect(card.getByRole("button", { name: "Usuń z mojej listy" })).toBeVisible();
    await note.fill(NOTE);
    await expect(note).toHaveAttribute("maxlength", "500");
    await expectNoAxeViolations(page);
    // Not a reload before the write commits, which would restore the previous list.
    await expectStoredWatchNote(page, NOTE);
    await page.keyboard.press("Escape");
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("");
    await expectStoredSearchCleared(page);
    await page.reload();
    await expectCount(page, "62 zawodników");

    await page.getByLabel(/^Na mojej liście/u).selectOption("yes");
    await expectCount(page, "1 zawodnik");
    await page.getByRole("button", { name: /^Paweł Brożek/u }).click();
    await expect(page.getByRole("textbox", NOTE_FIELD)).toHaveValue(NOTE);
  });

  // A note is not lost by one click: the question names what goes, and "Anuluj" keeps the entry.
  test("asks before removing a player with a note, and removes one without a note at once", async ({
    page,
  }) => {
    await loadDatabase(page);
    const card = await openBrozek(page);
    const add = card.getByRole("button", { name: "Dodaj do mojej listy" });
    const remove = card.getByRole("button", { name: "Usuń z mojej listy" });
    await add.click();
    // Spaces alone are no note.
    await card.getByRole("textbox", NOTE_FIELD).fill("   ");
    await remove.click();
    await expect(remove).toBeHidden();
    await add.click();
    await card.getByRole("textbox", NOTE_FIELD).fill(NOTE);
    await remove.click();
    await expect(card.getByText(/^Usunąć zawodnika/u)).toBeVisible();
    await card.getByRole("button", { name: "Anuluj" }).click();
    await expect(remove).toBeFocused();
    await expect(card.getByRole("textbox", NOTE_FIELD)).toHaveValue(NOTE);
    await remove.click();
    await remove.click();
    await expect(add).toBeFocused();
    await expect(card.getByRole("textbox", NOTE_FIELD)).toBeHidden();
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
    await card.getByRole("button", { name: "Dodaj do mojej listy" }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("");
    await page.getByLabel(/^Na mojej liście/u).selectOption("yes");
    await expectCount(page, "1 zawodnik");
    await page.getByRole("button", { name: /^Paweł Brożek/u }).click();
    await page.getByRole("button", { name: "Usuń z mojej listy" }).click();
    await page.keyboard.press("Escape");
    await expectCount(page, "0 zawodników");
    await expect(page.locator("#results-title")).toBeFocused();
    await page.getByLabel(/^Na mojej liście/u).selectOption("no");
    await expectCount(page, "62 zawodników");
  });

  // A record the app cannot read (here: of a later version) is not replaced by an empty list at the start.
  test("leaves an unreadable stored list alone until the user changes it", async ({ page }) => {
    await loadDatabase(page);
    const foreign = {
      schemaVersion: 2,
      value: [{ playerId: 1, note: "x", addedAt: "2026-11-05T10:00:00.000Z" }],
    };
    await page.evaluate(writeStored, ["watchlist", foreign] as const);
    await page.reload();
    await expectCount(page, "62 zawodników");
    // The preferences are stored after the start; a write of the list would be stored before them.
    await page.getByRole("checkbox", { name: "Bramkarz" }).check();
    await expectStoredPositionGroup(page, "goalkeeper");
    expect(await page.evaluate(readStored, "watchlist")).toEqual(foreign);
  });
});

test.describe("own watchlist on a phone", () => {
  test.use(PHONE);

  test("shows the section and the note field within the screen", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("button", { name: "Filtry" }).tap();
    const filters = page.getByRole("dialog", { name: "Filtry" });
    await filters.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await filters.getByRole("button", { name: "Zamknij" }).tap();
    await page.getByRole("button", { name: /^Paweł Brożek/u }).tap();
    const card = page.getByRole("dialog", { name: "Paweł Brożek" });
    await card.getByRole("button", { name: "Dodaj do mojej listy" }).tap();
    const note = card.getByRole("textbox", NOTE_FIELD);
    await note.scrollIntoViewIfNeeded();
    await expect(card.getByRole("heading", { name: "Moja lista" })).toBeVisible();
    await expect(note).toBeInViewport();
    const overflow = await page.evaluate(() => {
      const body = document.querySelector(".dialog-body");
      return [
        (document.scrollingElement?.scrollWidth ?? 0) - window.innerWidth,
        (body?.scrollWidth ?? 0) - (body?.clientWidth ?? 0),
      ];
    });
    expect(overflow).toEqual([0, 0]);
    await expectNoAxeViolations(page);
  });
});
