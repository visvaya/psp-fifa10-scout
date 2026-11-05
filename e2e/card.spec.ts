import { expect, test } from "@playwright/test";
import { expectCount, guardSecurityPolicy, loadDatabase } from "./support.ts";
import type { Locator } from "@playwright/test";

guardSecurityPolicy();

/** The value the card shows for a label. */
const value = (card: Locator, label: string) =>
  card
    .locator(".facts > div")
    .filter({
      has: card
        .page()
        .getByRole("term")
        .filter({ hasText: new RegExp(`^${label}$`, "u") }),
    })
    .getByRole("definition");

test.describe("player card", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // Every value one can filter by also shows on the card.
  test("shows the profile values the filters offer", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await expectCount(page, "1 zawodnik");
    await page.getByRole("button", { name: "Paweł Brożek" }).click();
    const card = page.getByRole("dialog", { name: "Paweł Brożek" });
    await expect(value(card, "Reputacja międzynarodowa")).toHaveText("1 z 5");
    await expect(value(card, "Szybkość nauki")).toHaveText("3 z 5");
    await expect(value(card, "Wiek zakończenia kariery")).toHaveText("35 lat");
    await expect(value(card, "Typ budowy")).toHaveText("typ 2");
    await expect(value(card, "Typ rozwoju")).toHaveText("typ 1");
    await expect(value(card, "Styl rozwoju")).toHaveText("styl 2");
    await expect(value(card, "Siła klubu")).toHaveText("66");
    await expect(value(card, "Reprezentant kraju")).toHaveText("nie");
    await expect(value(card, "Cechy")).toHaveText("brak");
    await page.keyboard.press("Escape");
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("messi");
    await page.getByRole("button", { name: /^Lionel Messi/u }).click();
    await expect(value(page.getByRole("dialog"), "Cechy")).toHaveText("Drybler techniczny");
  });
});
