import type { Page } from "@playwright/test";
import {
  centre,
  expect,
  filterByAttributes,
  loadCareer,
  loadDatabase,
  openCardEnlarged,
  openFilters,
  PHONE,
  scrollLeftOf,
  scrollToEnd,
  showPotential,
  test,
  openSection,
} from "./support.ts";

/**
 * Waits two animation frames, so the list's ResizeObserver has measured the columns just added: before
 * that an absent data-more says nothing.
 */
const layoutSettled = async (page: Page) =>
  page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });

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
    await expect(dialog.getByRole("button", { name: "Resetuj" })).toBeInViewport();
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
    await layoutSettled(page);
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
    // With more chips the actions wrap below them, and "Cofnij" keeps the margin of the line above it
    // (owner, 2026-11-05).
    await page.getByRole("button", { name: /^Filtry/u }).click();
    const dialog = page.getByRole("dialog", { name: "Filtry" });
    await dialog.getByRole("searchbox", { name: "Nazwisko" }).fill("a");
    await dialog.getByRole("checkbox", { name: "Bramkarz" }).check();
    await page.getByRole("button", { name: "Zamknij" }).click();
    // The fold stays open.
    await expect(chip).toHaveCount(2);
    await expect(chip.first()).toBeVisible();
    const [undo, summary] = await Promise.all([
      page.locator(".chips-bar").getByRole("button", { name: "Cofnij" }).boundingBox(),
      page.getByText("Aktywne filtry (2)").boundingBox(),
    ]);
    expect(undo?.y ?? 0).toBeGreaterThan((summary?.y ?? 0) + (summary?.height ?? 0));
    expect(undo?.x).toBe(summary?.x);
    expect(undo?.x ?? 0).toBeGreaterThanOrEqual(16);
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

test.describe("phone columns", () => {
  test.use(PHONE);

  test("shows the filtered values after OVR, scrolling sideways with the name kept", async ({
    page,
  }) => {
    await loadDatabase(page);
    await filterByAttributes(page, "Przyspieszenie", "Szybkość");
    const dialog = await openFilters(page);
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

/** Runs in the page before its scripts: the root font at 32 px, as a browser's larger text sets it. */
const enlargeText = () => {
  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.style.fontSize = "32px";
  });
};

test.describe("enlarged text", () => {
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

  // On the narrowest phone with enlarged text a dialog wraps its title, buttons and facts instead of
  // scrolling sideways: there the focused "Zamknij" scrolled the chart's title and plot out of view.
  test("keeps the card and its chart without a sideways scroll", async ({ page }) => {
    await openCardEnlarged(page);
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    const sideways = () =>
      page
        .locator("dialog[open]")
        .last()
        .evaluate((dialog) => dialog.scrollWidth - dialog.clientWidth);
    await expect(card).toBeVisible();
    expect(await sideways()).toBe(0);
    await card.getByRole("button", { name: /^Pokaż krzywą rozwoju: /u }).click();
    const chart = page.getByRole("dialog", { name: /^Krzywa rozwoju: /u });
    await expect(chart.locator(".chart-plot > svg")).toBeVisible();
    expect(await sideways()).toBe(0);
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
    await loadCareer(page);
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
    await showsWhole("Zarobki rynkowe (szacunkowe)", /\d\u00a0\d{3}$/u);
  });

  // Prices run to nine digits: the fields group them as they are typed and give them the row.
  test("groups the digits of a price as it is typed, keeping the caret", async ({ page }) => {
    await loadCareer(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    const dialog = page.getByRole("dialog", { name: "Filtry" });
    await openSection(dialog, "Transfer");
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

/** The rendered width of the fade at the phone list's right edge. */
const fadeWidth = (frame: Element): number =>
  Number.parseFloat(getComputedStyle(frame, "::after").width);

test.describe("phone edge fade", () => {
  test.use(PHONE);

  // The fade keeps one width and strength wherever the list stands (owner, 2026-11-05), also with a
  // column ending just inside the edge and the next wholly beyond it, until the list reaches its end.
  test("keeps the fade the same width until the list reaches its end", async ({ page }) => {
    await loadDatabase(page);
    await filterByAttributes(page, "Przyspieszenie", "Szybkość", "Drybling", "Wytrzymałość");
    const frame = page.locator(".phone-list");
    await expect(frame).toHaveAttribute("data-more");
    await expect.poll(async () => frame.evaluate(fadeWidth)).toBe(24);
    await page.locator(".scroll").evaluate((list) => {
      const edge = list.getBoundingClientRect().left + list.clientWidth;
      const label = list.closest(".phone-list")?.querySelectorAll(".column-label")[3];
      if (label !== undefined) list.scrollBy(label.getBoundingClientRect().right - (edge - 4), 0);
    });
    await expect(frame).toHaveAttribute("data-more");
    await expect.poll(async () => frame.evaluate(fadeWidth)).toBe(24);
    await page.locator(".scroll").evaluate(scrollToEnd);
    await expect(frame).not.toHaveAttribute("data-more");
  });

  // With every column in view there is no fade: the name keeps its room up to the first column.
  test("keeps the name its room up to the first column when every column fits", async ({
    page,
  }) => {
    await loadDatabase(page);
    await showPotential(page);
    const frame = page.locator(".phone-list");
    await expect(page.locator(".player-rows-header .column-label")).toHaveCount(2);
    await layoutSettled(page);
    await expect(frame).not.toHaveAttribute("data-more");
    const [name, first] = await Promise.all([
      page.locator(".player-row-text").first().boundingBox(),
      page.locator(".player-row-cell").first().boundingBox(),
    ]);
    // The name reaches the gap before the first number column.
    const gap = (first?.x ?? 0) - (name?.x ?? 0) - (name?.width ?? 0);
    expect(gap).toBeCloseTo(8, 0);
  });
});
