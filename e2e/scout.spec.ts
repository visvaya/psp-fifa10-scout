import { expect, test } from "@playwright/test";
import path from "node:path";
import {
  SYNTHETIC_DB_PATH,
  SYNTHETIC_LOCALE_PATHS,
  SYNTHETIC_SAVE_PATHS,
} from "../scripts/write-synthetic-db.ts";
import {
  expandSections,
  expectCount,
  expectNoAxeViolations,
  expectStoredPositionGroup,
  guardSecurityPolicy,
  headerWidths,
  loadDatabase,
  pickGame,
  readStored,
} from "./support.ts";

guardSecurityPolicy();

/** The right edge of a box. */
const rightOfBox = (box: { x: number; width: number } | null) =>
  (box?.x ?? Number.NaN) + (box?.width ?? 0);

test.describe("wide table", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("ends a number column's heading where its values end", async ({ page }) => {
    await loadDatabase(page);
    const label = page.getByRole("columnheader", { name: /^OVR/u }).locator(".sort-label");
    const value = page.getByRole("row").nth(1).locator("td.num .rating").first();
    const [labelBox, valueBox] = [await label.boundingBox(), await value.boundingBox()];
    expect(Math.abs(rightOfBox(labelBox) - rightOfBox(valueBox))).toBeLessThan(1);
  });

  test("shows the ratings without scrolling sideways and marks the filter sections", async ({
    page,
  }) => {
    await loadDatabase(page);
    // The feet are basics: shown in the open first section, not under the closed "Sylwetka".
    await expect(page.getByRole("group", { name: "Lepsza noga" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Słabsza noga (1–5)" })).toBeVisible();
    const scroll = page.locator(".table-scroll");
    const rightOf = async (name: RegExp) => {
      const box = await page.getByRole("columnheader", { name }).boundingBox();
      return (box?.x ?? Infinity) + (box?.width ?? 0);
    };
    const edge = async () => {
      const box = await scroll.boundingBox();
      return (box?.x ?? 0) + (box?.width ?? 0);
    };
    await page
      .getByRole("group", { name: "Ocena na pozycji" })
      .getByLabel("Pozycja")
      .selectOption({ label: "Środkowy obrońca (CB)" });
    expect(await rightOf(/^OVR$/u)).toBeLessThanOrEqual(await edge());
    expect(await rightOf(/^Różnica CB/u)).toBeLessThanOrEqual(await edge());
    const marker = (open: boolean) =>
      page
        .locator(`details.filter-section${open ? "[open]" : ":not([open])"} > summary`)
        .first()
        .evaluate((summary) => getComputedStyle(summary, "::before").content);
    expect(await marker(false)).not.toBe("none");
    expect(await marker(true)).not.toBe(await marker(false));
    // The marker stays out of what a screen reader reads.
    await expect(page.locator("details.filter-section > summary").first()).toHaveAccessibleName(
      "Podstawowe",
    );
  });
});

test.describe("stored state", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("keeps the game database and filters after a reload", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("checkbox", { name: "Bramkarz" }).check();
    await expectStoredPositionGroup(page, "goalkeeper");
    await page.reload();
    // The restore is too fast to catch its skeleton reliably; the stored game opens the list directly.
    await expect(page.getByRole("checkbox", { name: "Bramkarz" })).toBeChecked();
    await expect(page.getByRole("table")).toBeVisible();
    // The start screen's button counts what the list shows, filters included.
    const listed = (await page.locator(".count").textContent())?.match(/^\d+/u)?.[0];
    await page.getByRole("button", { name: "Pliki" }).click();
    await expect(page.getByText(`Wczytano: ${path.basename(SYNTHETIC_DB_PATH)}`)).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Pokaż zawodników (${String(listed)})` }),
    ).toBeVisible();
  });
});

test.describe("wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("filters, sorts and opens a player card", async ({ page }) => {
    await loadDatabase(page);
    const table = page.getByRole("table");
    await page.getByRole("button", { name: /^Wiek/u }).click();
    await expect(page.getByRole("columnheader", { name: /^Wiek/u })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await expectCount(page, "1\u00a0zawodnik");
    const name = table.getByRole("button", { name: "Paweł Brożek" });
    await name.click();
    const card = page.getByRole("dialog", { name: "Paweł Brożek" });
    await expect(card.getByText("Wisła Kraków")).toBeVisible();
    // A forward, in the game's colour for attackers.
    await expect(card.locator(".position")).toHaveCSS("color", "rgb(153, 0, 0)");
    // Both feet with the basics: the better one and the weaker one's stars.
    await expect(card.locator(".facts > div").filter({ hasText: /^Słabsza noga/u })).toHaveText(
      "Słabsza noga3 z 5",
    );
    // One row per way the game rates a position, with the gain over his OVR (49 as a striker).
    const row = (label: RegExp) => card.locator(".facts > div").filter({ hasText: label });
    await expect(row(/^Boczny obrońca/u).getByRole("definition")).toHaveText("(+9) 58");
    await expect(row(/^Libero/u).getByRole("definition")).toHaveText("(+8) 57");
    // Gains in colour: green above his OVR, red below, grey at his own position.
    await expect(row(/^Libero/u).locator(".gain")).toHaveCSS("color", "rgb(29, 107, 60)");
    await expect(row(/^Ofensywny/u).locator(".gain")).toHaveCSS("color", "rgb(163, 38, 27)");
    await expect(row(/^Napastnik/u).getByRole("definition")).toHaveText("(0) 49");
    await expect(card.getByText("RB · LB", { exact: true })).toBeHidden();
    const positions = card.getByRole("button", { name: "OVR na pozycjach" });
    await positions.click();
    await expect(positions).toHaveAttribute("aria-expanded", "true");
    await expect(card.getByText("RB · LB", { exact: true })).toBeVisible();
    await expect(card.getByText("SW", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    await expect(name).toBeFocused();
    await page.getByRole("button", { name: "Usuń filtr: Nazwisko" }).click();
    await expectCount(page, "62\u00a0zawodników");
  });

  // Jan Wolny has no team at all, like the game's legends; fifa.db has no free agents, so without a
  // career the free agents option does not show.
  test("hides players no club can sign", async ({ page }) => {
    await loadDatabase(page);
    await page.getByText("Klub i kontrakt").click();
    await expect(page.getByRole("radio", { name: "tylko wolni zawodnicy" })).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("wolny");
    await expect(page.getByText("Żaden zawodnik nie spełnia filtrów.")).toBeVisible();
  });

  test("explains a wrong game file and keeps the start screen", async ({ page }) => {
    await page.goto("/");
    await pickGame(page, {
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a game"),
    });
    await expect(page.getByRole("alert")).toContainText("To nie jest właściwy plik");
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("shows the title and a loading note with the skeleton", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "PSP FIFA 10 Scout" })).toBeVisible();
    await expect(page.getByText("Wczytywanie…")).toBeVisible();
    await expect(page.locator(".skeleton").first()).toBeVisible();
  });
});

test.describe("table and dialogs", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // The table draws only the rows in view, so widths taken from the drawn rows would change on scroll.
  test("keeps the column widths while the list scrolls", async ({ page }) => {
    await loadDatabase(page);
    const widths = async () => headerWidths(page);
    const before = await widths();
    await page.locator(".scroll").evaluate((element) => {
      element.scrollTo(0, element.scrollHeight);
    });
    await expect(page.getByRole("button", { name: "Paweł Brożek" })).toBeInViewport();
    expect(await widths()).toEqual(before);
  });

  test("shows a column for each attribute with a range filter, after OVR", async ({ page }) => {
    await loadDatabase(page);
    await page.getByText("Atrybuty", { exact: true }).click();
    await page.getByLabel("Dodaj atrybut").selectOption({ label: "Przyspieszenie" });
    await page.getByRole("group", { name: "Przyspieszenie" }).getByLabel("od").fill("10");
    const headers = page.getByRole("columnheader");
    // The sort mark comes before a number column's heading.
    await expect(headers.nth(3)).toHaveText(/OVR$/u);
    await expect(headers.nth(4)).toHaveText("Przyspieszenie");
    await page.getByRole("button", { name: "Usuń atrybut: Przyspieszenie" }).click();
    await expect(page.getByRole("columnheader", { name: "Przyspieszenie" })).toHaveCount(0);
  });

  test("closes a dialog with a click outside it, not inside", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("messi");
    await page.getByRole("button", { name: "Lionel Messi" }).click();
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    await card.getByRole("heading", { name: "Lionel Messi" }).click();
    await expect(card).toBeVisible();
    await page.mouse.click(8, 400);
    await expect(card).toBeHidden();
  });
});

test.describe("career save", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("shows the loaded career, keeps it after a reload and forgets it on request", async ({
    page,
  }) => {
    await page.goto("/");
    await pickGame(page, SYNTHETIC_DB_PATH);
    await page.getByLabel("Wybierz DATA.BIN i PARAM.SFO").setInputFiles([...SYNTHETIC_SAVE_PATHS]);
    const summary = page.getByText(
      "Kariera: Anna Kariera, Wisła Kraków, ostatni mecz 8 sierpnia 2009",
    );
    await expect(summary).toBeVisible();
    await page.reload();
    await expect(page.getByRole("table")).toBeVisible();
    await page.getByRole("button", { name: "Pliki" }).click();
    await expect(summary).toBeVisible();
    await page.getByRole("button", { name: "Usuń zapis kariery" }).click();
    await expect(summary).toBeHidden();
    await page.reload();
    await expect(page.getByRole("table")).toBeVisible();
    await page.getByRole("button", { name: "Pliki" }).click();
    await expect(page.getByText(/^Kariera: /u)).toHaveCount(0);
  });

  // Wisła Kraków, the career's club, has Paweł Brożek and 20 of the 60 generated players.
  test("shows only my club or hides it", async ({ page }) => {
    await page.goto("/");
    await pickGame(page, SYNTHETIC_DB_PATH);
    await page.getByLabel("Wybierz DATA.BIN i PARAM.SFO").setInputFiles([...SYNTHETIC_SAVE_PATHS]);
    await page.getByRole("button", { name: /^Pokaż zawodników/u }).click();
    await page.getByText("Klub i kontrakt").click();
    await expect(page.getByRole("radio", { name: "wszyscy zawodnicy" })).toBeChecked();
    await page.getByRole("radio", { name: "tylko zawodnicy mojego klubu" }).check();
    await expectCount(page, "21 zawodników");
    await page.getByRole("radio", { name: "ukryj zawodników mojego klubu" }).check();
    await expectCount(page, "41 zawodników");
    await page
      .getByRole("button", { name: "Usuń filtr: Ukryj zawodników mojego klubu", exact: true })
      .click();
    await expectCount(page, "62 zawodników");
  });
});

test.describe("career prices", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("prices players, sorts and filters by price and estimates the wage", async ({ page }) => {
    await page.goto("/");
    await pickGame(page, SYNTHETIC_DB_PATH);
    await page.getByLabel("Wybierz DATA.BIN i PARAM.SFO").setInputFiles([...SYNTHETIC_SAVE_PATHS]);
    await page.getByRole("button", { name: /^Pokaż zawodników/u }).click();
    // The list names the save's currency once, in the heading (the synthetic save: euro).
    const header = page.getByRole("columnheader", { name: /^Cena \(€\)/u });
    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await page.getByRole("button", { name: "Lionel Messi" }).click();
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    await expect(card.getByRole("term").filter({ hasText: /^Cena$/u })).toBeVisible();
    await expect(card.getByText(/ \(szacunek\)$/u)).toBeVisible();
    await page.keyboard.press("Escape");
    // The user's own player shows the wage stored in his contract, not the market's.
    await page.getByRole("button", { name: "Paweł Brożek" }).click();
    const own = page.getByRole("dialog", { name: "Paweł Brożek" });
    await expect(own.getByRole("term").filter({ hasText: /^Zarobki z kontraktu$/u })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByText("Kariera", { exact: true }).click();
    await page.getByRole("group", { name: "Cena", exact: true }).getByLabel("od").fill("1");
    await page
      .getByRole("group", { name: "Zarobki rynkowe (szacunek)" })
      .getByLabel("od")
      .fill("1");
    // A fifth of the generated players' contracts run out in 2009: their price is 0.
    await expectCount(page, "50 zawodników");
  });
});

test.describe("filter panel", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("hides potential until asked", async ({ page }) => {
    await loadDatabase(page);
    await expect(page.getByRole("columnheader", { name: /^Potencjał/u })).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    await expect(page.getByRole("columnheader", { name: /^Potencjał/u })).toBeVisible();
    await expect(page.getByRole("group", { name: "Zapas rozwoju" })).toBeVisible();
  });

  test("rates players at a chosen position and sorts by it", async ({ page }) => {
    await loadDatabase(page);
    const rating = page.getByRole("group", { name: "Ocena na pozycji" });
    // A choice of two groups names both, group by group in the order of its name.
    await expect(
      rating.getByRole("option", { name: "Skrzydłowy / boczny pomocnik (RWM/LWM; RM/LM)" }),
    ).toHaveCount(1);
    await rating.getByLabel("Pozycja").selectOption({ label: "Boczny obrońca (RB/LB)" });
    const header = page.getByRole("columnheader", { name: /^OVR RB\/LB/u });
    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
    const gain = page.getByRole("columnheader", { name: /^Różnica RB\/LB/u });
    await gain.getByRole("button").click();
    await expect(gain).toHaveAttribute("aria-sort", "descending");
    const gainRange = rating.getByRole("group", { name: "Różnica do OVR" }).getByLabel("od");
    await gainRange.fill("99");
    await expect(page.getByText("Żaden zawodnik nie spełnia filtrów.")).toBeVisible();
    await gainRange.fill("");
    await rating.getByRole("group", { name: "OVR RB/LB" }).getByLabel("od").fill("99");
    await expect(page.getByText("Żaden zawodnik nie spełnia filtrów.")).toBeVisible();
    await page.getByRole("button", { name: "Usuń filtr: Ocena na pozycji" }).click();
    await expect(header).toHaveCount(0);
    await expectCount(page, "62 zawodników");
  });

  test("filters by several nationalities, an attribute range and a trait", async ({ page }) => {
    await loadDatabase(page);
    await page.getByText("Klub i kontrakt").click();
    await page.getByRole("checkbox", { name: "Argentina" }).check();
    await expectCount(page, "31 zawodników");
    await page.getByRole("checkbox", { name: "Poland" }).check();
    await expectCount(page, "62 zawodników");
    await page.getByText("Atrybuty", { exact: true }).click();
    await page.getByLabel("Dodaj atrybut").selectOption({ label: "Szybkość" });
    await page.getByRole("group", { name: "Szybkość" }).getByLabel("od").fill("90");
    await expectCount(page, "1 zawodnik");
    // Each chip says what its filter takes.
    const chips = page.getByRole("list", { name: "Aktywne filtry" }).getByRole("button");
    await expect(chips).toHaveText([/^Szybkość: od 90/u, /^Narodowość: Argentina, Poland/u]);
    await page.getByRole("button", { name: "Usuń atrybut: Szybkość" }).click();
    await page.getByText("Cechy", { exact: true }).click();
    await page.getByLabel("Drybler techniczny").selectOption("yes");
    await expectCount(page, "1 zawodnik");
    await page.getByRole("button", { name: "Usuń filtr: Drybler techniczny: tak" }).click();
    await expectCount(page, "62 zawodników");
  });
});

test.describe("game language", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("names countries and leagues in an attached game language and keeps the choice", async ({
    page,
  }) => {
    await loadDatabase(page);
    await page.getByRole("button", { name: "Pliki" }).click();
    const language = page.getByLabel("Nazwy klubów, lig i krajów");
    await expect(language).toHaveValue("");
    await page
      .getByLabel("Albo dołącz plik języka i string.idx")
      .setInputFiles([...SYNTHETIC_LOCALE_PATHS]);
    await expect(language).toHaveValue("pol_pl");
    await page.getByRole("button", { name: /^Pokaż zawodników/u }).click();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "BR", exact: true })).toBeVisible();
    await page.getByText("Klub i kontrakt").click();
    await expect(page.getByRole("checkbox", { name: "Polska" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Liga BBVA (Hiszpania)" })).toBeVisible();
    await expectNoAxeViolations(page);
    await expect
      .poll(async () => page.evaluate(readStored, "preferences"))
      .toMatchObject({ value: { gameLanguage: "pol_pl" } });
    await expect
      .poll(async () => page.evaluate(readStored, "languages"))
      .toMatchObject({ value: { pol_pl: { countries: { 52: "Argentyna" } } } });
    await page.reload();
    await page.getByText("Klub i kontrakt").click();
    await expect(page.getByRole("checkbox", { name: "Argentyna" })).toBeVisible();
    await page.getByRole("button", { name: "Pliki" }).click();
    await expect(language).toHaveValue("pol_pl");
    await expectNoAxeViolations(page);
    await language.selectOption({ label: "Angielskie z bazy fifa.db" });
    await page.getByRole("button", { name: "Lista zawodników" }).click();
    await expect(page.getByRole("checkbox", { name: "GK", exact: true })).toBeVisible();
    await page.getByText("Klub i kontrakt").click();
    await expect(page.getByRole("checkbox", { name: "Poland" })).toBeVisible();
  });

  test("asks for both language files", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("button", { name: "Pliki" }).click();
    await page
      .getByLabel("Albo dołącz plik języka i string.idx")
      .setInputFiles(SYNTHETIC_LOCALE_PATHS[0]);
    await expect(page.getByRole("alert")).toContainText("plik .loc i string.idx");
  });
});

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`axe finds no violations at ${String(width)} px, ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      // A stable state: the file inputs are disabled only while the store opens.
      await expect(page.getByLabel("Wybierz obraz ISO lub fifa.db")).toBeEnabled();
      await expectNoAxeViolations(page);
      await loadDatabase(page);
      await expectNoAxeViolations(page);
      if (width < 960) {
        await page.getByRole("button", { name: "Filtry" }).click();
        await expandSections(page);
        await expectNoAxeViolations(page);
        await page.getByRole("button", { name: "Zamknij" }).click();
        await page.getByRole("button", { name: /^Lionel Messi/u }).click();
      } else {
        await expandSections(page);
        await expectNoAxeViolations(page);
        await page.getByRole("button", { name: "Lionel Messi" }).click();
      }
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }
}
