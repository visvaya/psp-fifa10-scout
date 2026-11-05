import { expect, test } from "@playwright/test";
import { SYNTHETIC_DB_PATH, SYNTHETIC_SAVE_PATHS } from "../scripts/write-synthetic-db.ts";
import {
  centre,
  fadeStart,
  filterByAttributes,
  guardSecurityPolicy,
  loadDatabase,
  PHONE,
  pickGame,
  showPotential,
} from "./support.ts";

guardSecurityPolicy();

test.describe("phone", () => {
  test.use(PHONE);

  test("keeps the start screen within the viewport, before and after loading a game", async ({
    page,
  }) => {
    const pageHeight = async () =>
      page.evaluate(() => document.scrollingElement?.scrollHeight ?? 0);
    await page.goto("/");
    await expect(page.getByLabel("Wybierz obraz ISO lub fifa.db")).toBeEnabled();
    expect(await pageHeight()).toBe(844);
    await loadDatabase(page);
    await page.getByRole("button", { name: "Pliki" }).click();
    await expect(page.getByText(/^Wczytano: /u)).toBeVisible();
    expect(await pageHeight()).toBe(844);
  });

  test("filters in a full-screen dialog and opens a card", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    const dialog = page.getByRole("dialog", { name: "Filtry" });
    await dialog.getByRole("checkbox", { name: "Napastnik" }).check();
    // The reset button stays at the bottom of the long panel, in reach without scrolling.
    await expect(dialog.getByRole("button", { name: "Wyczyść filtry" })).toBeInViewport();
    await dialog.getByRole("button", { name: "Zamknij" }).click();
    await expect(page.getByRole("button", { name: "Filtry (1)" })).toBeFocused();
    await page.getByRole("button", { name: /^Paweł Brożek/u }).click();
    const card = page.getByRole("dialog", { name: "Paweł Brożek" });
    await expect(card).toBeVisible();
    // A tap inside keeps the card; a tap on the backdrop beside it closes it, as a click does.
    await card.getByRole("heading", { name: "Paweł Brożek" }).tap();
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    await page.touchscreen.tap(Math.max(1, (box?.x ?? 8) / 2), 420);
    await expect(card).toBeHidden();
  });

  test("labels the numbers above the rows, each over its column", async ({ page }) => {
    await loadDatabase(page);
    await showPotential(page);
    const labels = page.locator(".player-rows-header .column-label");
    await expect(labels).toHaveText(["OVR", "POT"]);
    // Both fit: no shadow tells of further columns.
    await expect(page.locator(".phone-list")).not.toHaveAttribute("data-more");
    const numbers = page.locator(".player-row").first().locator(".rating");
    const [labelCentres, numberCentres] = await Promise.all([
      Promise.all([0, 1].map(async (index) => centre(labels.nth(index)))),
      Promise.all([0, 1].map(async (index) => centre(numbers.nth(index)))),
    ]);
    labelCentres.forEach((label, index) => {
      expect(Math.abs(label - (numberCentres[index] ?? Number.NaN))).toBeLessThan(1);
    });
  });

  // Only the list scrolls: if the page scrolled instead, the virtual list would not draw the rows the user
  // scrolls to and would leave blank space below them.
  test("scrolls the list, not the page", async ({ page }) => {
    await loadDatabase(page);
    const pageHeight = await page.evaluate(() => document.scrollingElement?.scrollHeight);
    expect(pageHeight).toBe(page.viewportSize()?.height);
    const list = page.locator(".scroll");
    await list.evaluate((element) => {
      element.scrollTo(0, element.scrollHeight);
    });
    expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    // The last row is drawn once the list reaches its end.
    await expect(page.locator(".player-row").last()).toBeInViewport();
  });
});

test.describe("phone list with filters", () => {
  test.use(PHONE);

  test("folds the active filter chips into one line", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    await page
      .getByRole("dialog", { name: "Filtry" })
      .getByRole("checkbox", { name: "Napastnik" })
      .check();
    await page.getByRole("button", { name: "Zamknij" }).click();
    const chip = page.getByRole("button", { name: /^Usuń filtr: /u });
    await expect(chip).toBeHidden();
    await page.getByText("Aktywne filtry (1)").click();
    await expect(chip).toBeVisible();
  });

  test("keeps an attribute's field while its value is retyped after the dialog reopens", async ({
    page,
  }) => {
    await loadDatabase(page);
    const open = async () => {
      await page.getByRole("button", { name: /^Filtry/u }).click();
      return page.getByRole("dialog", { name: "Filtry" });
    };
    let dialog = await open();
    await dialog.getByText("Atrybuty", { exact: true }).click();
    await dialog.getByLabel("Dodaj atrybut").selectOption({ label: "Przyspieszenie" });
    await dialog.getByRole("group", { name: "Przyspieszenie" }).getByLabel("od").fill("10");
    await dialog.getByRole("button", { name: "Zamknij" }).click();
    dialog = await open();
    await dialog.getByText("Atrybuty", { exact: true }).click();
    const from = dialog.getByRole("group", { name: "Przyspieszenie" }).getByLabel("od");
    // Clearing the value to type a new one must not take the field away.
    await from.fill("");
    await expect(from).toBeVisible();
    await from.fill("20");
    await expect(from).toHaveValue("20");
  });
});

const scrollToEnd = (element: Element) => {
  element.scrollTo(element.scrollWidth, 0);
};
const scrollLeftOf = (element: Element) => element.scrollLeft;

test.describe("phone columns", () => {
  test.use(PHONE);

  test("shows the filtered values after OVR, scrolling sideways with the name kept", async ({
    page,
  }) => {
    await loadDatabase(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    const dialog = page.getByRole("dialog", { name: "Filtry" });
    await dialog.getByText("Atrybuty", { exact: true }).click();
    await dialog.getByLabel("Dodaj atrybut").selectOption({ label: "Przyspieszenie" });
    await dialog.getByRole("group", { name: "Przyspieszenie" }).getByLabel("od").fill("10");
    await dialog.getByLabel("Dodaj atrybut").selectOption({ label: "Szybkość" });
    await dialog.getByRole("group", { name: "Szybkość" }).getByLabel("od").fill("10");
    await dialog
      .getByRole("group", { name: "Ocena na pozycji" })
      .getByRole("combobox", { name: "Ocena na pozycji" })
      .selectOption({ label: "Środkowy obrońca (CB)" });
    await dialog.getByRole("button", { name: "Zamknij" }).click();
    await expect(page.locator(".player-rows-header .column-label")).toHaveText([
      "OVR",
      "OVR CB",
      "Różnica CB",
      "Przyspieszenie",
      "Szybkość",
    ]);
    // More than fits: the list scrolls sideways, the labels with it, and the name stays at the left.
    const list = page.locator(".scroll");
    await list.evaluate(scrollToEnd);
    const scrolled = await list.evaluate(scrollLeftOf);
    expect(scrolled).toBeGreaterThan(0);
    const header = page.locator(".player-rows-header");
    await expect.poll(async () => header.evaluate(scrollLeftOf)).toBe(scrolled);
    const name = await page.locator(".player-row-name").first().boundingBox();
    expect(name?.x ?? Number.NaN).toBeLessThan(20);
    const lastCell = page.locator(".player-row").first().locator(".player-row-cell").last();
    await expect(lastCell).toBeInViewport();
  });
});

test.describe("phone columns with large text", () => {
  test.use(PHONE);

  // With enlarged text the kept name must not cover the screen, or the numbers scroll under it.
  test("keeps room for the numbers beside the name with large text", async ({ page }) => {
    // Tall enough for rows under the enlarged toolbar.
    await page.setViewportSize({ width: 320, height: 1400 });
    await loadDatabase(page);
    await filterByAttributes(page, "Szybkość");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "32px";
    });
    const row = page.locator(".player-row").first();
    const name = await row.locator(".player-row-text").boundingBox();
    expect(name?.width ?? Number.NaN).toBeLessThanOrEqual(320 * 0.45 + 1);
    await page.locator(".scroll").evaluate(scrollToEnd);
    await expect(row.locator(".player-row-cell").last()).toBeInViewport();
  });
});

/** Runs in the page before its scripts: the root font at 32 px, as a browser's larger text sets it. */
const enlargeText = () => {
  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.style.fontSize = "32px";
  });
};

test.describe("phone name column", () => {
  test.use(PHONE);

  // The name keeps the room the first two number columns leave; scrolled sideways it narrows to its minimum,
  // and a name too long for that gives its first name as an initial.
  test("shows two number columns beside the name, then narrows the name as the list scrolls", async ({
    page,
  }) => {
    await loadDatabase(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    const dialog = page.getByRole("dialog", { name: "Filtry" });
    await dialog.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    await dialog.getByText("Atrybuty", { exact: true }).click();
    await dialog.getByLabel("Dodaj atrybut").selectOption({ label: "Szybkość" });
    await dialog.getByRole("group", { name: "Szybkość" }).getByLabel("od").fill("10");
    await dialog.getByRole("button", { name: "Zamknij" }).click();
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
    await page.locator(".scroll").evaluate((element) => {
      element.scrollTo(element.scrollLeft, element.scrollHeight);
    });
    const short = page
      .locator(".player-row", { hasText: "Bardzo-Długie" })
      .locator(".player-row-name-short");
    await expect(short).toBeVisible();
    await expect(short).toHaveText(/^G\. Numer 9 Bardzo/u);
    await page.locator(".scroll").evaluate((element) => {
      element.scrollTo(0, element.scrollTop);
    });
    await expect(short).toBeHidden();
  });
});

test.describe("enlarged text", () => {
  test.use(PHONE);

  // A row is 4rem: with a 32 px root font the list must place rows by 128 px, not the 64 px of the default.
  test("places the rows by their height when the text is enlarged", async ({ page }) => {
    await page.addInitScript(enlargeText);
    await page.setViewportSize({ width: 390, height: 1600 });
    await loadDatabase(page);
    const list = page.locator(".scroll");
    await list.evaluate((element) => {
      element.scrollTo(0, 128 * 20);
    });
    const row = page.locator('.player-rows li[aria-posinset="21"]');
    await expect(row).toBeInViewport();
    const [rowBox, listBox] = await Promise.all([row.boundingBox(), list.boundingBox()]);
    expect(Math.abs((rowBox?.y ?? Number.NaN) - (listBox?.y ?? Number.NaN))).toBeLessThan(4);
  });
});

test.describe("open dialog", () => {
  test.use(PHONE);

  // A swipe that reaches the end of a dialog must not move the list behind it.
  // iOS Safari also drags the whole page (its overscroll bounce), so the document is locked too.
  test("locks the list and the page while a dialog is open", async ({ page }) => {
    await loadDatabase(page);
    const [list, root] = [page.locator(".scroll"), page.locator("html")];
    await expect(list).toHaveCSS("overflow-y", "auto");
    await page.locator(".player-row").first().click();
    const card = page.getByRole("dialog");
    await expect(list).toHaveCSS("overflow-y", "hidden");
    await expect(root).toHaveCSS("overflow-y", "hidden");
    // WebKit in Playwright does not report overscroll-behavior, so the dialog's containment is not checked.
    await card.getByRole("button", { name: "Zamknij" }).click();
    await expect(list).toHaveCSS("overflow-y", "auto");
    await expect(root).toHaveCSS("overflow-y", "visible");
  });
});

test.describe("career prices on a phone", () => {
  test.use(PHONE);

  // A price runs to millions, wider than its label: the column fits the longest amount in full.
  test("shows whole prices and wages in their columns", async ({ page }) => {
    await page.goto("/");
    await pickGame(page, SYNTHETIC_DB_PATH);
    await page.getByLabel("Wybierz DATA.BIN i PARAM.SFO").setInputFiles([...SYNTHETIC_SAVE_PATHS]);
    await page.getByRole("button", { name: /^Pokaż zawodników/u }).click();
    // The most expensive player first: his amount is the longest.
    const showsWhole = async (sortBy: string, amount: RegExp) => {
      await page.getByLabel("Sortuj według").selectOption({ label: sortBy });
      const cell = page.locator(".player-row").first().locator(".player-row-cell").last();
      await expect(cell).toHaveText(amount);
      expect(await cell.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
    };
    await showsWhole("Cena", /\d\u00a0\d{3}\u00a0\d{3}$/u);
    await showsWhole("Zarobki rynkowe (szacunek)", /\d\u00a0\d{3}$/u);
  });

  // Prices run to nine digits: the fields group them as they are typed and give them the row.
  test("groups the digits of a price as it is typed, keeping the caret", async ({ page }) => {
    await page.goto("/");
    await pickGame(page, SYNTHETIC_DB_PATH);
    await page.getByLabel("Wybierz DATA.BIN i PARAM.SFO").setInputFiles([...SYNTHETIC_SAVE_PATHS]);
    await page.getByRole("button", { name: /^Pokaż zawodników/u }).click();
    await page.getByRole("button", { name: "Filtry" }).click();
    const dialog = page.getByRole("dialog", { name: "Filtry" });
    await dialog.getByText("Kariera", { exact: true }).click();
    const from = dialog.getByRole("group", { name: "Cena (€)", exact: true }).getByLabel("od");
    await from.pressSequentially("100000000");
    await expect(from).toHaveValue("100\u00a0000\u00a0000");
    expect(await from.evaluate((input) => input.scrollWidth <= input.clientWidth)).toBe(true);
    // A digit typed after the first one stays there, and so does the caret, once the field regroups.
    await from.press("Home");
    await from.press("ArrowRight");
    await from.pressSequentially("23");
    await expect(from).toHaveValue("12\u00a0300\u00a0000\u00a0000");
    // A key that meets a separator deletes the digit beyond it, and the caret stays at the edit.
    // (Polish groups from five digits: 1000 has no separator.)
    const caretAt = async (position: number) =>
      from.evaluate((input: HTMLInputElement, at) => {
        input.setSelectionRange(at, at);
      }, position);
    await from.fill("10000");
    await expect(from).toHaveValue("10\u00a0000");
    await caretAt(3);
    await from.press("Backspace");
    await expect(from).toHaveValue("1000");
    await from.pressSequentially("5");
    await expect(from).toHaveValue("15\u00a0000");
    await from.fill("10000");
    await caretAt(2);
    await from.press("Delete");
    await expect(from).toHaveValue("1000");
    await from.pressSequentially("7");
    await expect(from).toHaveValue("10\u00a0700");
    await from.fill("");
    await expect(from).toHaveValue("");
  });
});
