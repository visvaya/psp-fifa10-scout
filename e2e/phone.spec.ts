import { expect, test } from "@playwright/test";
import { centre, guardSecurityPolicy, loadDatabase, PHONE } from "./support.ts";

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
    await dialog.getByRole("checkbox", { name: "Napastnicy" }).check();
    await dialog.getByRole("button", { name: "Zamknij" }).click();
    await expect(page.getByRole("button", { name: "Filtry (1)" })).toBeFocused();
    await page.getByRole("button", { name: /^Paweł Brożek/u }).click();
    await expect(page.getByRole("dialog", { name: "Paweł Brożek" })).toBeVisible();
  });

  test("labels the numbers above the rows, each over its column", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    await page.getByRole("button", { name: "Zamknij" }).click();
    const labels = page.locator(".player-rows-header > span");
    await expect(labels).toHaveText(["OVR", "POT"]);
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
      .getByRole("checkbox", { name: "Napastnicy" })
      .check();
    await page.getByRole("button", { name: "Zamknij" }).click();
    const chip = page.getByRole("button", { name: /^Usuń filtr: /u });
    await expect(chip).toBeHidden();
    await page.getByText("Aktywne filtry (1)").click();
    await expect(chip).toBeVisible();
  });

  test("shows a filtered attribute before OVR when nothing else takes that place", async ({
    page,
  }) => {
    await loadDatabase(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    const dialog = page.getByRole("dialog", { name: "Filtry" });
    await dialog.getByText("Atrybuty", { exact: true }).click();
    await dialog.getByLabel("Dodaj atrybut").selectOption({ label: "Przyspieszenie" });
    await dialog.getByRole("group", { name: "Przyspieszenie" }).getByLabel("od").fill("10");
    await dialog.getByRole("button", { name: "Zamknij" }).click();
    await expect(page.locator(".player-rows-header > span")).toHaveText(["Przyspieszenie", "OVR"]);
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
