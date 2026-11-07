import type { Page } from "@playwright/test";
import {
  expect,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  expectStored,
  loadDatabase,
  PHONE,
  test,
  writeStored,
} from "./support.ts";

const NOTE_FIELD = { name: "Notatka (nie dodaje do listy)" } as const;
const NOTE = "Szybki, lewa noga\nDo obserwacji w zimie";

const brozekButton = (page: Page) => page.getByRole("button", { name: /^Paweł Brożek/u });

/** Finds the one player and opens his card. */
const openBrozek = async (page: Page) => {
  await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
  await brozekButton(page).click();
  return page.getByRole("dialog", { name: "Paweł Brożek" });
};

/** Notes of two players the synthetic database lacks: one with his stored name, one without. */
const missing = [
  {
    playerId: 990_001,
    text: "Obrońca z ligi czeskiej",
    name: "Jan Nowak",
    changedAt: "2026-11-01T10:00:00.000Z",
  },
  { playerId: 990_002, text: "Z listy", name: null, changedAt: "2026-10-01T10:00:00.000Z" },
];

test.describe("notes on players", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // A note belongs to the player, not to the own list: writing one does not add him, and leaving the
  // list does not delete it.
  test("keeps a note of a player off the list, and after he leaves the list", async ({ page }) => {
    await loadDatabase(page);
    const card = await openBrozek(page);
    const note = card.getByRole("textbox", NOTE_FIELD);
    await expect(note).toHaveValue("");
    await note.fill(NOTE);
    await expect(note).toHaveAttribute("maxlength", "20000");
    const add = card.getByRole("button", { name: "Dodaj do twojej listy w narzędziu" });
    await expect(add).toBeVisible();
    await expectNoAxeViolations(page);
    await expectStored(page, "notes", {
      schemaVersion: 1,
      value: [{ text: NOTE, name: "Paweł Brożek" }],
    });
    await add.click();
    await card.getByRole("button", { name: "Usuń z twojej listy w narzędziu" }).click();
    await expect(add).toBeVisible();
    await expect(note).toHaveValue(NOTE);
    // Emptied, the note is gone.
    await note.fill("");
    await expectStored(page, "notes", { value: [] });
  });
});

test.describe("notes view", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // The notes view lists every note, newest first, by the player's name, its first line and its date;
  // a player in the database opens his card, one missing shows the stored name.
  test("lists the notes and opens a player's card from them", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("button", { name: "Notatki" }).click();
    const notes = page.getByRole("dialog", { name: "Notatki" });
    await expect(notes.getByText(/^Nie masz jeszcze notatek/u)).toBeVisible();
    await expectNoAxeViolations(page);
    await notes.getByRole("button", { name: "Zamknij" }).click();

    const stored = { schemaVersion: 1, value: missing.slice(0, 1) };
    await page.evaluate(writeStored, ["notes", stored] as const);
    await page.reload();
    const card = await openBrozek(page);
    await card.getByRole("textbox", NOTE_FIELD).fill(NOTE);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Notatki" }).click();
    const items = notes.getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Paweł Brożek");
    await expect(items.nth(0)).toContainText("Szybki, lewa noga");
    await expect(items.nth(0)).not.toContainText("Do obserwacji");
    await expect(items.nth(1)).toContainText("Jan Nowak");
    await expect(items.nth(1).getByRole("button", { name: "Jan Nowak", exact: true })).toHaveCount(
      0,
    );
    await expectNoAxeViolations(page);

    const name = notes.getByRole("button", { name: "Paweł Brożek" });
    await name.click();
    const opened = page.getByRole("dialog", { name: "Paweł Brożek" });
    await expect(opened.getByRole("textbox", NOTE_FIELD)).toHaveValue(NOTE);
    await page.keyboard.press("Escape");
    await expect(opened).toBeHidden();
    await expect(name).toBeFocused();
    // Emptied, the note leaves the view under the card: the focus goes back into the view.
    await name.click();
    await opened.getByRole("textbox", NOTE_FIELD).fill("");
    await page.keyboard.press("Escape");
    await expect(opened).toBeHidden();
    await expect(notes.getByRole("button", { name: "Zamknij" })).toBeFocused();
  });
});

test.describe("notes view, removing", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // A note of a player the database lacks cannot open his card, so the view removes it, after a
  // question; the focus moves on to the next note, or to the empty view.
  test("removes a note of a player missing from the database", async ({ page }) => {
    await loadDatabase(page);
    await page.evaluate(writeStored, ["notes", { schemaVersion: 1, value: missing }] as const);
    await page.reload();
    await page.getByRole("button", { name: "Notatki" }).click();
    const notes = page.getByRole("dialog", { name: "Notatki" });
    const removeNowak = notes.getByRole("button", { name: "Usuń notatkę: Jan Nowak" });
    await removeNowak.click();
    await expect(notes.getByText("Usunąć notatkę: Jan Nowak?")).toBeVisible();
    await expectNoAxeViolations(page);
    await notes.getByRole("button", { name: /^Anuluj/u }).click();
    await expect(removeNowak).toBeFocused();
    await removeNowak.click();
    await notes.getByRole("button", { name: "Usuń", exact: true }).click();
    await expect(notes.getByRole("listitem")).toHaveCount(1);
    await expect(
      notes.getByRole("button", { name: "Usuń notatkę: Zawodnik nr 990002" }),
    ).toBeFocused();
    await expectStored(page, "notes", { value: [{ playerId: 990_002 }] });
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(notes.getByText(/^Nie masz jeszcze notatek/u)).toBeFocused();
    await expectStored(page, "notes", { value: [] });
  });

  // Notes kept by the list before they had a record of their own move there, none lost.
  test("moves the notes of a stored list of the earlier version", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    const id = Number(await brozekButton(page).getAttribute("data-player-id"));
    const list = {
      schemaVersion: 1,
      value: [{ playerId: id, note: NOTE, addedAt: "2026-11-05T10:00:00.000Z" }],
    };
    await page.evaluate(writeStored, ["watchlist", list] as const);
    await page.reload();
    await expectStored(page, "notes", { value: [{ playerId: id, text: NOTE }] });
    const card = await openBrozek(page);
    await expect(card.getByRole("textbox", NOTE_FIELD)).toHaveValue(NOTE);
    await expect(
      card.getByRole("button", { name: "Usuń z twojej listy w narzędziu" }),
    ).toBeVisible();
  });
});

test.describe("notes on a phone", () => {
  test.use(PHONE);

  test("opens the notes beside the filters and fits the note field in the card", async ({
    page,
  }) => {
    await loadDatabase(page);
    await page.getByRole("button", { name: "Filtry" }).tap();
    const filters = page.getByRole("dialog", { name: "Filtry" });
    await filters.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await filters.getByRole("button", { name: "Zamknij" }).tap();
    await brozekButton(page).tap();
    const card = page.getByRole("dialog", { name: "Paweł Brożek" });
    const note = card.getByRole("textbox", NOTE_FIELD);
    await note.scrollIntoViewIfNeeded();
    await expect(note).toBeInViewport();
    await note.fill(NOTE);
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await card.getByRole("button", { name: "Zamknij" }).tap();

    await page.evaluate(writeStored, ["notes", { schemaVersion: 1, value: missing }] as const);
    await page.reload();
    const button = page.getByRole("button", { name: "Notatki" });
    await expect(button).toBeInViewport();
    await button.tap();
    const notes = page.getByRole("dialog", { name: "Notatki" });
    const items = notes.getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Jan Nowak");
    await expect(items.nth(1)).toContainText("Zawodnik nr 990002");
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });
});
