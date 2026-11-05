import { expect, test } from "@playwright/test";
import { SYNTHETIC_DB_PATH, SYNTHETIC_SAVE_PATHS } from "../scripts/write-synthetic-db.ts";
import {
  cardValue,
  expectCount,
  expectNoAxeViolations,
  guardSecurityPolicy,
  loadDatabase,
  pickGame,
} from "./support.ts";

guardSecurityPolicy();

test.describe("player card", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // Every value one can filter by also shows on the card.
  test("shows the profile values the filters offer", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await expectCount(page, "1 zawodnik");
    await page.getByRole("button", { name: "Paweł Brożek" }).click();
    const card = page.getByRole("dialog", { name: "Paweł Brożek" });
    await expect(cardValue(card, "Reputacja międzynarodowa")).toHaveText(/1 z 5 gwiazdek$/u);
    await expect(cardValue(card, "Szybkość nauki")).toHaveText(/3 z 5 gwiazdek$/u);
    // Full and empty stars: 3 of 5 for learning.
    await expect(
      card
        .locator(".facts > div")
        .filter({ hasText: /^Szybkość nauki/u })
        .locator(".stars > *"),
    ).toHaveClass([/star-full/u, /star-full/u, /star-full/u, /star-empty/u, /star-empty/u]);
    await expect(cardValue(card, "Wiek zakończenia kariery")).toHaveText("35 lat");
    await expect(cardValue(card, "Typ budowy")).toHaveText("typ 2");
    await expect(cardValue(card, "Typ rozwoju")).toHaveText("wczesny");
    await expect(cardValue(card, "Styl rozwoju")).toHaveText("dobry");
    await expect(cardValue(card, "Siła klubu")).toHaveText("66");
    await expect(cardValue(card, "Reprezentant kraju")).toHaveText("nie");
    await expect(cardValue(card, "Cechy")).toHaveText("brak");
    await page.keyboard.press("Escape");
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("messi");
    await page.getByRole("button", { name: /^Lionel Messi/u }).click();
    await expect(cardValue(page.getByRole("dialog"), "Cechy")).toHaveText("Drybler techniczny");
  });

  // The OVR hides weak attributes: each group shows its average and range, and an uneven profile in text.
  test("shows each attribute group's average, range and uneven profile", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await page.getByRole("button", { name: "Paweł Brożek" }).click();
    const card = page.getByRole("dialog", { name: "Paweł Brożek" });
    // Tackling 92 and marking 46; the technique's range is narrower than its threshold.
    const defending = card.getByRole("region", { name: "Obrona" });
    await expect(defending).toContainText(/Średnia\s69,0, zakres\s46–92\s\(rozrzut\s46\)/u);
    await expect(defending.getByText("Nierówny profil")).toBeVisible();
    const technique = card.getByRole("region", { name: "Technika" });
    await expect(technique).toContainText(/Średnia\s46,8, zakres\s38–50\s\(rozrzut\s12\)/u);
    await expect(technique.getByText("Nierówny profil")).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  // Forced colours drop the stars' fill: the value shows as text instead.
  test("shows star values as text in forced colours", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await loadDatabase(page);
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await page.getByRole("button", { name: "Paweł Brożek" }).click();
    const card = page.getByRole("dialog", { name: "Paweł Brożek" });
    await expect(card.locator(".stars").first()).toBeHidden();
    await expect(card.getByText("3 z 5 gwiazdek").first()).toBeVisible();
  });
});

test.describe("group stats in the list", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // The groups' averages and spreads filter like the attributes do, and show as a column.
  test("filters by a group's spread, shown as a column", async ({ page }) => {
    await loadDatabase(page);
    await page.getByText("Atrybuty", { exact: true }).click();
    await page.getByLabel("Dodaj atrybut").selectOption({ label: "Rozrzut: obrona" });
    await page.getByRole("group", { name: "Rozrzut: obrona" }).getByLabel("od").fill("40");
    await expectCount(page, "1 zawodnik");
    const headers = await page.getByRole("columnheader").allTextContents();
    const column = headers.findIndex((header) => header.includes("Rozrzut: obrona"));
    expect(column).toBeGreaterThan(-1);
    // Tackling 92 and marking 46.
    await expect(
      page
        .getByRole("row", { name: /Paweł Brożek/u })
        .locator(":scope > *")
        .nth(column),
    ).toHaveText("46");
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
    await expect(cardValue(card, "Klub przyjmie od")).toHaveText("22 500 000 €");
    await expect(cardValue(card, "Zawodnik podpisze od")).toContainText("kontrakt 4 lata");
    await expect(card.getByText(/^Kwota przekracza limit formularza oferty/u)).toBeVisible();
    // Barcelona has 21 players and enough wide midfielders to sell him.
    await expect(cardValue(card, "Klub może go sprzedać")).toHaveText("tak");
    await expect(card.getByText(/^Klub odmówi sprzedaży/u)).toBeHidden();
    await page.keyboard.press("Escape");
    // Łódzki KS has two centre-backs, one short of its league's minimum, and his contract runs on.
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("numer 18");
    await page.getByRole("button", { name: /^Gracz Numer 18/u }).click();
    const refused = page.getByRole("dialog", { name: "Gracz Numer 18" });
    await expect(cardValue(refused, "Klub może go sprzedać")).toHaveText("nie");
    await expect(
      refused.getByText(/^Klub odmówi sprzedaży.*ma za mało zawodników w\sgrupie pozycji/u),
    ).toBeVisible();
    await expect(cardValue(refused, "Na liście do wypożyczenia")).toHaveText("tak");
    await expect(cardValue(refused, "Na liście transferowej")).toHaveText("nie");
    await page.keyboard.press("Escape");
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await page.getByRole("button", { name: "Paweł Brożek" }).click();
    const own = page.getByRole("dialog", { name: "Paweł Brożek" });
    await expect(own.getByText("Oferta", { exact: true })).toBeHidden();
    // No season row in the save: no rows of "brak" for it.
    await expect(cardValue(own, "Średnia ocena (KR)")).toHaveCount(0);
    await expect(cardValue(own, "Na liście transferowej")).toHaveText("nie");
  });
});
