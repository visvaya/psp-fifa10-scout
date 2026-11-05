import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  expectCount,
  expectNoAxeViolations,
  expectStoredWatchNote,
  guardSecurityPolicy,
  loadDatabase,
} from "./support.ts";

guardSecurityPolicy();

/** Finds the one player and opens his card. */
const openBrozek = async (page: Page) => {
  await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
  await page.getByRole("button", { name: "Paweł Brożek" }).click();
  return page.getByRole("dialog", { name: "Paweł Brożek" });
};

test.describe("own watchlist", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // The list has no limit of 20 and no link to the game's wish list: it stays in the browser with its
  // notes, comes back after a reload and filters the list.
  test("keeps a player with a note across a reload and filters by it", async ({ page }) => {
    await loadDatabase(page);
    const card = await openBrozek(page);
    await expect(card.getByLabel("Notatka")).toBeHidden();
    await card.getByRole("button", { name: "Dodaj do mojej listy" }).click();
    await expect(card.getByRole("button", { name: "Usuń z mojej listy" })).toBeVisible();
    await card.getByLabel("Notatka").fill("Szybki, lewa noga");
    await expect(card.getByLabel("Notatka")).toHaveAttribute("maxlength", "500");
    await expectNoAxeViolations(page);
    // Not a reload before the write commits, which would restore the previous list.
    await expectStoredWatchNote(page, "Szybki, lewa noga");
    await page.keyboard.press("Escape");
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("");
    await page.reload();
    await expectCount(page, "62\u00a0zawodników");

    await page.getByLabel(/^Na mojej liście/u).selectOption("yes");
    await expectCount(page, "1\u00a0zawodnik");
    await page.getByRole("button", { name: "Paweł Brożek" }).click();
    await expect(page.getByRole("dialog").getByLabel("Notatka")).toHaveValue("Szybki, lewa noga");
    await page.getByRole("button", { name: "Usuń z mojej listy" }).click();
    await expect(page.getByLabel("Notatka")).toBeHidden();
    await page.keyboard.press("Escape");
    await expectCount(page, "0\u00a0zawodników");
    await page.getByLabel(/^Na mojej liście/u).selectOption("no");
    await expectCount(page, "62\u00a0zawodników");
  });
});
