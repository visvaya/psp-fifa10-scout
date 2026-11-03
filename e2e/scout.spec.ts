import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { SYNTHETIC_DB_PATH, SYNTHETIC_LOCALE_PATHS } from "../scripts/write-synthetic-db.ts";

/** Picks a game file once the input is enabled: setInputFiles also fills a disabled input, and a pick
 * made before the app opens its worker is lost (a user cannot pick there). */
const pickGame = async (page: Page, files: Parameters<Locator["setInputFiles"]>[0]) => {
  const input = page.getByLabel("Wybierz obraz ISO lub fifa.db");
  await expect(input).toBeEnabled();
  await input.setInputFiles(files);
};

const loadDatabase = async (page: Page) => {
  await page.goto("/");
  await pickGame(page, SYNTHETIC_DB_PATH);
  await expectCount(page, "62\u00a0zawodników");
};

/** The visible count; the status region repeats it once the announcement settles. */
/** A stored record, read in the page from the app's IndexedDB store. */
const readStored = async (key: string): Promise<unknown> =>
  new Promise((resolve) => {
    const open = indexedDB.open("psp-fifa10-scout");
    open.addEventListener("success", () => {
      const get = open.result.transaction("kv").objectStore("kv").get(key);
      get.addEventListener("success", () => {
        // A connection left open can hold WebKit's store on an old state across a reload.
        open.result.close();
        resolve(get.result);
      });
    });
  });

/** Waits until the stored preferences include a position group: a reload before the IndexedDB write
 * commits would restore the previous filters (a fast CI runner reloads within that window). */
const expectStoredPositionGroup = async (page: Page, group: string) => {
  await expect
    .poll(async () => page.evaluate(readStored, "preferences"))
    .toMatchObject({ value: { filters: { lists: { positionGroup: [group] } } } });
};

const expectCount = async (page: Page, text: string) => {
  await expect(page.locator("p.count")).toHaveText(text);
};

/** Opens every collapsed filter section. */
const expandSections = async (page: Page) => {
  await page.locator("details.filter-section").evaluateAll((sections) => {
    for (const section of sections) section.setAttribute("open", "");
  });
  const sections = await page.locator("details.filter-section").count();
  await expect(page.locator(".filter-section-body")).toHaveCount(sections);
};

const expectNoAxeViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
};

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
    await expect(card.getByRole("heading", { name: "OVR na pozycjach" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    await expect(name).toBeFocused();
    await page.getByRole("button", { name: "Usuń filtr: Nazwisko" }).click();
    await expectCount(page, "62\u00a0zawodników");
  });

  test("hides clubless players by default and shows only them on request", async ({ page }) => {
    await loadDatabase(page);
    await page.getByText("Klub i kontrakt").click();
    await expect(page.getByRole("radio", { name: "z klubem" })).toBeChecked();
    await page.getByRole("radio", { name: "tylko bez klubu" }).check();
    await expectCount(page, "1 zawodnik");
    await expect(page.getByRole("button", { name: "Jan Wolny" })).toBeVisible();
    await page.getByRole("radio", { name: "wszyscy, także bez klubu" }).check();
    await expectCount(page, "63 zawodników");
    await page.getByRole("button", { name: "Wyczyść filtry" }).click();
    await expectCount(page, "62 zawodników");
  });

  test("keeps the game database and filters after a reload", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("checkbox", { name: "Bramkarze" }).check();
    await expectStoredPositionGroup(page, "goalkeeper");
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Bramkarze" })).toBeChecked();
    await expect(page.getByRole("table")).toBeVisible();
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
    await rating.getByLabel("Pozycja").selectOption({ label: "LB" });
    const header = page.getByRole("columnheader", { name: /^OVR LB/u });
    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await rating.getByRole("group", { name: "OVR LB" }).getByLabel("od").fill("99");
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
    await page.getByRole("button", { name: "Usuń atrybut: Szybkość" }).click();
    await page.getByText("Cechy", { exact: true }).click();
    await page.getByLabel("Drybler techniczny").selectOption("yes");
    await expectCount(page, "1 zawodnik");
    await page.getByRole("button", { name: "Usuń filtr: Drybler techniczny: tak" }).click();
    await expectCount(page, "62 zawodników");
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

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
    await expect(page.getByRole("table")).toBeVisible();
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
