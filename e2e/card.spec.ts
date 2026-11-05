import { expect, test } from "@playwright/test";
import { SYNTHETIC_DB_PATH, SYNTHETIC_SAVE_PATHS } from "../scripts/write-synthetic-db.ts";
import { expectCount, guardSecurityPolicy, loadDatabase, pickGame } from "./support.ts";
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

test.describe("offer on the card", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // The synthetic manager has no prestige or upgrades: an unlisted player costs 1.5 times his value,
  // above the offer form's limit. The user's own player gets no offer.
  test("shows what an offer needs for another club's player only", async ({ page }) => {
    await page.goto("/");
    await pickGame(page, SYNTHETIC_DB_PATH);
    await page.getByLabel("Wybierz DATA.BIN i PARAM.SFO").setInputFiles([...SYNTHETIC_SAVE_PATHS]);
    await page.getByRole("button", { name: /^Pokaż zawodników/u }).click();
    await page.getByRole("button", { name: /^Lionel Messi/u }).click();
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    await expect(value(card, "Klub przyjmie od")).toHaveText("22 500 000 €");
    await expect(value(card, "Zawodnik podpisze od")).toContainText("kontrakt 4 lata");
    await expect(card.getByText(/^Kwota przekracza limit formularza oferty/u)).toBeVisible();
    // Barcelona has 21 players and enough wide midfielders to sell him (the refusals: unit tests).
    await expect(value(card, "Klub może go sprzedać")).toHaveText("tak");
    await expect(card.getByText(/^Klub odmówi sprzedaży/u)).toBeHidden();
    await page.keyboard.press("Escape");
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await page.getByRole("button", { name: "Paweł Brożek" }).click();
    await expect(
      page.getByRole("dialog", { name: "Paweł Brożek" }).getByText("Oferta", { exact: true }),
    ).toBeHidden();
  });
});
