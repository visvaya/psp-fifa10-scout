// A value the game does not keep shows as a dash named "brak danych", told apart from a zero: the save
// keeps season stats only for some players (the synthetic one for Messi and Gracz Numer 1).
import type { Locator, Page } from "@playwright/test";
import { openSection, expect, expectNoAxeViolations, loadCareer, PHONE, test } from "./support.ts";

const GOALS = "Gole w lidze";

/** Shows the league goals' column with its eye and keeps the players with this name, in the panel or the dialog. */
const showGoals = async (page: Page, panel: Page | Locator, name: string) => {
  await openSection(panel, "Sezon");
  await page.getByRole("button", { name: `Pokaż kolumnę: ${GOALS}`, exact: true }).click();
  await panel.getByRole("searchbox", { name: "Nazwisko" }).fill(name);
};

test.describe("wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("marks a missing value with a dash named for screen readers, and keeps a zero", async ({
    page,
  }) => {
    await loadCareer(page);
    await showGoals(page, page, "gracz numer 1");
    const header = page.getByRole("columnheader", { name: new RegExp(`^${GOALS}`, "u") });
    const column = await header.evaluate((cell) =>
      cell instanceof HTMLTableCellElement ? cell.cellIndex : -1,
    );
    const goalsOf = (name: string) =>
      page
        .getByRole("row")
        .filter({ has: page.getByRole("rowheader", { name, exact: true }) })
        .locator("th, td")
        .nth(column);
    await expect(goalsOf("Gracz Numer 1")).toHaveText("0");
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    const missing = goalsOf("Paweł Brożek");
    await expect(missing).toHaveAccessibleName("brak danych");
    await expect(missing.locator('[aria-hidden="true"]')).toHaveText("–");
    await expectNoAxeViolations(page);
  });
});

test.describe("phone", () => {
  test.use(PHONE);

  test("marks a missing value in the rows with the same dash and name", async ({ page }) => {
    await loadCareer(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    const dialog = page.getByRole("dialog", { name: "Filtry" });
    await showGoals(page, dialog, "brozek");
    await dialog.getByRole("button", { name: "Zamknij" }).click();
    const row = page.getByRole("button", { name: /^Paweł Brożek/u });
    const cell = row.locator(".player-row-cell").filter({ hasText: GOALS });
    await expect(cell.locator('[aria-hidden="true"]')).toHaveText("–");
    // The label's words are bound by non-breaking spaces.
    await expect(row).toHaveAccessibleName(/Gole\sw\slidze brak danych$/u);
    await expectNoAxeViolations(page);
    // A zero stays a zero.
    await page.getByRole("button", { name: "Filtry" }).click();
    await dialog.getByRole("searchbox", { name: "Nazwisko" }).fill("gracz numer 1");
    await dialog.getByRole("button", { name: "Zamknij" }).click();
    await expect(
      page
        .getByRole("button", { name: /^Gracz Numer 1\b/u })
        .locator(".player-row-cell")
        .filter({ hasText: GOALS }),
    ).toHaveText(`${GOALS}0`);
  });
});
