import {
  cardValue,
  expect,
  expectCount,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  expandSections,
  loadCareer,
  loadDatabase,
  PHONE,
  test,
} from "./support.ts";

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

  // The save keeps no contract for a loaned player: a dash for the contract, price and wage, and both
  // clubs side by side.
  test("shows a loaned player's two clubs together and no contract", async ({ page }) => {
    await loadCareer(page);
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("gracz numer 2");
    await page.getByRole("button", { name: /^Gracz Numer 2\b/u }).click();
    const card = page.getByRole("dialog", { name: "Gracz Numer 2" });
    const terms = await card.locator(".facts > div > dt").allInnerTexts();
    expect(terms[terms.indexOf("Klub") + 1]).toBe("Wypożyczony z");
    await expect(cardValue(card, "Klub")).toHaveText("Wisła Kraków (wypożyczenie do końca sezonu)");
    await expect(cardValue(card, "Wypożyczony z")).toHaveText("FC Barcelona");
    // The dash, then its name for screen readers.
    await Promise.all(
      ["Kontrakt do", "Cena", "Zarobki rynkowe"].map((label) =>
        expect(cardValue(card, label)).toHaveText("–brak danych"),
      ),
    );
    await expect(cardValue(card, "Siła klubu")).toHaveText("66");
    await expect(cardValue(card, "Siła klubu macierzystego")).toHaveText("84");
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

test.describe("development curves", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // A small chart of the skill curve beside each style in the filters and beside his style on the card.
  test("draws the curve beside each style and on the card", async ({ page }) => {
    await loadDatabase(page);
    await expandSections(page);
    const styles = page.getByRole("group", { name: "Styl rozwoju", exact: true });
    await expect(styles.locator("label.check svg.sparkline").first()).toBeVisible();
    await expect(styles.locator("label.check:not(:has(svg.sparkline))")).toHaveCount(0);
    await page.locator("[data-player-id]").first().click();
    // The synthetic database has one flat curve, the game's fallback, so every curve peaks at 15.
    await expect(
      cardValue(page.getByRole("dialog"), "Styl rozwoju").getByRole("img"),
    ).toHaveAccessibleName("krzywa rozwoju, szczyt w wieku 15");
    await expectNoAxeViolations(page);
  });
});

test.describe("offer on the card", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // The synthetic manager has no prestige or upgrades: an unlisted player costs 1.5 times his value,
  // exactly the offer form's limit. The user's own player gets no offer.
  test("shows what an offer needs for another club's player only", async ({ page }) => {
    await loadCareer(page);
    await page.getByRole("button", { name: /^Lionel Messi/u }).click();
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    await expect(cardValue(card, "Klub przyjmie od")).toHaveText("22 500 000 €");
    await expect(cardValue(card, "Zawodnik podpisze od")).toContainText("kontrakt 4 lata");
    await expect(card.getByText(/^Kwota przekracza limit formularza/u)).toBeHidden();
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
    await expect(cardValue(own, "KR (forma)")).toHaveCount(0);
    await expect(cardValue(own, "Na liście transferowej")).toHaveText("nie");
  });

  // Each choice moves the player's points, so the least wage changes at once; a new card starts over.
  test("recalculates the result for a double offer, a bonus and a contract length", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE.viewport);
    await loadCareer(page);
    await page.getByRole("button", { name: /^Lionel Messi/u }).click();
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    const wage = cardValue(card, "Zawodnik podpisze od");
    const first = await wage.innerText();
    await expect(wage).toContainText("kontrakt 4 lata");
    const length = card.getByLabel("Długość kontraktu");
    await expect(length.locator("option:checked")).toHaveText(/^4\slata,\style\schce\szawodnik$/u);
    await expect(card.getByText(/kosztuje\s2\sz/u)).toBeHidden();

    await card.getByLabel("Podwójna oferta").check();
    await expect(card.getByText(/kosztuje\s2\sz/u)).toBeVisible();
    await expect(wage).not.toHaveText(first);
    await card.getByLabel("Podwójna oferta").uncheck();
    await expect(wage).toHaveText(first);

    await card.getByLabel("Premia za bramkę lub czyste konto").selectOption("15");
    await expect(wage).not.toHaveText(first);
    await expect(cardValue(card, "Premia")).toBeVisible();
    await length.selectOption("1");
    await expect(wage).toContainText("kontrakt 1 rok");

    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Lionel Messi/u }).click();
    const again = page.getByRole("dialog", { name: "Lionel Messi" });
    await expect(cardValue(again, "Zawodnik podpisze od")).toHaveText(first);
  });
});
