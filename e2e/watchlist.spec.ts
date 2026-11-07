import type { Page } from "@playwright/test";
import {
  expect,
  expectCount,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  expectStored,
  expectStoredSearchCleared,
  loadDatabase,
  PHONE,
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
    await expectStored(page, "watchlist", { value: [{ note: NOTE }] });
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
      "Paweł Brożek na mojej liście",
    );
    await expect(page.locator(".watch-mark")).toHaveCount(1);
    // Without a career there is no game shortlist to choose.
    await expect(page.getByRole("radio", { name: "w grze" })).toHaveCount(0);
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
    await onList(page, "w narzędziu");
    await expectCount(page, "1 zawodnik");
    await page.getByRole("button", { name: /^Paweł Brożek/u }).click();
    await page.getByRole("button", { name: "Usuń z mojej listy" }).click();
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
      schemaVersion: 2,
      value: [{ playerId: 1, note: "x", addedAt: "2026-11-05T10:00:00.000Z" }],
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
    await page.getByRole("button", { name: "Dodaj do mojej listy" }).click();
    await page.keyboard.press("Escape");
    await expect(name.locator(".watch-mark")).toBeVisible();
    const overflow = await name.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
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
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });
});
