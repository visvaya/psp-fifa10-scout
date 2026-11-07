import type { Locator } from "@playwright/test";
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

test("keeps the focus moved out of a closing card", async ({ page }) => {
  // The dialog's close event comes a task after Escape: a field focused before it keeps the focus,
  // or a quick fill of the search box would type into the player's button (a flaky watchlist test).
  await loadDatabase(page);
  const search = page.getByRole("searchbox", { name: "Nazwisko" });
  await search.fill("brozek");
  await page.getByRole("button", { name: "Paweł Brożek" }).click();
  await page.evaluate(() => {
    document.querySelector("dialog")?.close();
    document.querySelector<HTMLElement>("input[type=search]")?.focus();
  });
  await expect(page.locator("dialog")).toHaveCount(0);
  await page.evaluate(async () => new Promise(requestAnimationFrame));
  await page.evaluate(async () => new Promise(requestAnimationFrame));
  await expect(search).toBeFocused();
});

test.describe("club stars and prestige", () => {
  // The club's stars come from its squad by the game's rule; the synthetic squads rate half a star.
  test("shows the club's stars and prestige under its rating and filters by the stars", async ({
    page,
  }) => {
    await loadDatabase(page);
    await expandSections(page);
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await page.getByRole("button", { name: "Paweł Brożek" }).click();
    const card = page.getByRole("dialog", { name: "Paweł Brożek" });
    const terms = await card.locator(".facts > div > dt").allInnerTexts();
    const rating = terms.findIndex((term) => term.startsWith("Siła klubu"));
    expect(terms.slice(rating + 1, rating + 4).map((term) => term.split("?")[0]?.trim())).toEqual([
      "Gwiazdki klubu",
      "Prestiż ligi",
      "Prestiż klubu",
    ]);
    await expect(cardValue(card, "Gwiazdki klubu")).toHaveText(/0,5 z 5 gwiazdek$/u);
    await expect(
      card
        .locator(".facts > div")
        .filter({ hasText: /^Gwiazdki klubu/u })
        .locator(".stars > *"),
    ).toHaveClass([/star-half/u, /star-empty/u, /star-empty/u, /star-empty/u, /star-empty/u]);
    await expect(cardValue(card, "Prestiż ligi")).toHaveText("5");
    await expect(cardValue(card, "Prestiż klubu")).toHaveText("6");
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    const stars = page.getByRole("group", { name: "Gwiazdki klubu", exact: true });
    await stars.getByLabel("od").fill("0,5");
    await expectCount(page, "1 zawodnik");
    // Jan Wolny has no club, so no stars to pass the filter.
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("wolny");
    await expect(page.getByRole("button", { name: /^Jan Wolny/u })).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await stars.getByLabel("od").fill("1");
    await expect(page.getByRole("button", { name: "Paweł Brożek" })).toHaveCount(0);
  });
});

test.describe("development curves", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // A small chart of the skill curve beside each style in the filters, and on the card in a row of its
  // own under his style, explained behind a "?".
  test("draws the curve beside each style and on the card", async ({ page }) => {
    await loadDatabase(page);
    await expandSections(page);
    const styles = page.getByRole("group", { name: "Styl rozwoju", exact: true });
    await expect(styles.locator("label.check svg.sparkline").first()).toBeVisible();
    await expect(styles.locator("label.check:not(:has(svg.sparkline))")).toHaveCount(0);
    await page.locator("[data-player-id]").first().click();
    // The synthetic database has one flat curve, the game's fallback, so every curve peaks at 15.
    const card = page.getByRole("dialog");
    await expect(cardValue(card, "Styl rozwoju").getByRole("img")).toHaveCount(0);
    const terms = await card.locator(".facts > div > dt").allInnerTexts();
    const style = terms.findIndex((term) => term.startsWith("Styl rozwoju"));
    expect(terms[style + 1]).toMatch(/^Krzywa rozwoju/u);
    // Across the whole grid, under the style's row, also where the facts take two columns.
    const [styleRow, curveRow, grid] = await Promise.all(
      [
        card.locator(".facts > div").filter({ hasText: /^Styl rozwoju/u }),
        card.locator(".facts > div:has(.sparkline)"),
        card.locator(".facts:has(.sparkline)"),
      ].map(async (box) => box.boundingBox()),
    );
    expect(curveRow?.y).toBeGreaterThanOrEqual((styleRow?.y ?? 0) + (styleRow?.height ?? 0) - 1);
    expect(curveRow?.width).toBeCloseTo(grid?.width ?? 0, 0);
    await expect(
      cardValue(card, "Krzywa rozwoju").getByRole("button", { name: /^Pokaż krzywą rozwoju: / }),
    ).toBeVisible();
    await card.getByRole("button", { name: "Wyjaśnienie: Krzywa rozwoju" }).click();
    await expect(
      card.getByText(/^Krzywa\sz\sdanych gry.*Szczyt\sw\swieku\s15\slat\.$/u),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });

  // The small chart opens a large one: ages and values on labelled axes, the peak and his age marked,
  // and the same in words and in a table for screen readers.
  test("opens the large chart from the card and returns to it", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await page.getByRole("button", { name: "Paweł Brożek" }).click();
    const card = page.getByRole("dialog", { name: "Paweł Brożek" });
    const age = await cardValue(card, "Wiek").innerText();
    const open = card.getByRole("button", { name: "Pokaż krzywą rozwoju: Paweł Brożek" });
    await open.click();
    const chart = page.getByRole("dialog", { name: "Krzywa rozwoju: Paweł Brożek" });
    await expect(chart.locator("svg text").getByText("Wiek", { exact: true })).toBeVisible();
    await expect(chart.locator("svg text").getByText("Wartość krzywej")).toBeVisible();
    // The synthetic curve is flat: it peaks at 15.
    await expect(chart.locator("svg text").getByText(/^szczyt: 15\slat, \d+$/u)).toBeVisible();
    await expect(
      chart.locator("svg text").getByText(new RegExp(`^w\\stym sezonie: ${age}$`, "u")),
    ).toBeVisible();
    await expect(cardValue(chart, "Szczyt")).toHaveText(/^15\slat, wartość \d+$/u);
    await expect(cardValue(chart, "Wiek w tym sezonie")).toHaveText(
      new RegExp(`^${age}, wartość \\d+$`, "u"),
    );
    await expect(chart.getByRole("table").getByRole("row")).toHaveCount(32);
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await expect(chart).toHaveCount(0);
    await expect(card).toBeVisible();
    await expect(open).toBeFocused();
  });
});

test.describe("development chart on a phone", () => {
  test.use(PHONE);

  test("fits the chart's dialog without a horizontal scroll", async ({ page }) => {
    await loadDatabase(page);
    await page.locator("[data-player-id]").first().click();
    await page.getByRole("button", { name: /^Pokaż krzywą rozwoju: /u }).click();
    const chart = page.getByRole("dialog", { name: /^Krzywa rozwoju: /u });
    await expect(chart.locator("svg")).toBeVisible();
    const [overflow, svgWidth, bodyWidth] = await chart
      .locator(".dialog-body")
      .evaluate((body) => [
        body.scrollWidth - body.clientWidth,
        body.querySelector("svg")?.getBoundingClientRect().width ?? 0,
        body.clientWidth,
      ]);
    expect(overflow).toBe(0);
    expect(svgWidth).toBeLessThanOrEqual(bodyWidth);
    await expectNoAxeViolations(page);
  });
});

/** A value as shown: its text without a closed "!" panel's note, which toHaveText would read. */
const shown = (value: Locator) => () => value.innerText();

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
    // The fee stays within the form's limit, the wage goes over it: a "!" before the wage only.
    await expect(card.getByRole("button", { name: "Uwaga: Klub przyjmie od" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Uwaga: Zawodnik podpisze od" })).toHaveCount(1);
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

    await card.getByRole("checkbox", { name: "Podwójna oferta" }).check();
    await expect.poll(shown(wage)).not.toBe(first);
    await card.getByRole("checkbox", { name: "Podwójna oferta" }).uncheck();
    await expect.poll(shown(wage)).toBe(first);

    await card.getByLabel("Premia za bramkę lub czyste konto").selectOption("15");
    await expect.poll(shown(wage)).not.toBe(first);
    await expect(cardValue(card, "Premia")).toBeVisible();
    await length.selectOption("1");
    await expect(wage).toContainText("kontrakt 1 rok");

    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Lionel Messi/u }).click();
    const again = page.getByRole("dialog", { name: "Lionel Messi" });
    await expect.poll(shown(cardValue(again, "Zawodnik podpisze od"))).toBe(first);
  });
});

test.describe("offer explanations", () => {
  test.use(PHONE);

  // What the section shows and what a double offer costs, behind a "?" each rather than in sight.
  test("explains the offer beside its heading and the double offer after it", async ({ page }) => {
    await loadCareer(page);
    await page.getByRole("button", { name: /^Lionel Messi/u }).tap();
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    const [note, cost] = [
      card.getByText(/^Z\skodu gry: najniższa kwota/u),
      card.getByText(/kosztuje\s2\sz/u),
    ];
    await expect(note).toBeHidden();
    await card.getByRole("button", { name: "Wyjaśnienie: Oferta" }).tap();
    await expect(note).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(cost).toBeHidden();
    await card.getByRole("button", { name: "Wyjaśnienie: Podwójna oferta" }).tap();
    await expect(cost).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
