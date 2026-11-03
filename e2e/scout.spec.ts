import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { SYNTHETIC_DB_PATH } from "../scripts/write-synthetic-db.ts";

const loadDatabase = async (page: Page) => {
  await page.goto("/");
  await page.getByLabel("Wybierz obraz ISO lub fifa.db").setInputFiles(SYNTHETIC_DB_PATH);
  await expectCount(page, "62\u00a0zawodników");
};

/** The visible count; the status region repeats it once the announcement settles. */
/** The stored preferences record, read in the page from the app's IndexedDB store. */
const readStoredPreferences = async (): Promise<unknown> =>
  new Promise((resolve) => {
    const open = indexedDB.open("psp-fifa10-scout");
    open.addEventListener("success", () => {
      const get = open.result.transaction("kv").objectStore("kv").get("preferences");
      get.addEventListener("success", () => {
        resolve(get.result);
      });
    });
  });

/** Waits until the stored preferences include a position group: a reload before the IndexedDB write
 * commits would restore the previous filters (a fast CI runner reloads within that window). */
const expectStoredPositionGroup = async (page: Page, group: string) => {
  await expect
    .poll(async () => page.evaluate(readStoredPreferences))
    .toMatchObject({ value: { filters: { positionGroups: [group] } } });
};

const expectCount = async (page: Page, text: string) => {
  await expect(page.locator("p.count")).toHaveText(text);
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
    await page.getByLabel("Wybierz obraz ISO lub fifa.db").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a game"),
    });
    await expect(page.getByRole("alert")).toContainText("To nie jest właściwy plik");
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
        await expectNoAxeViolations(page);
        await page.getByRole("button", { name: "Zamknij" }).click();
        await page.getByRole("button", { name: /^Lionel Messi/u }).click();
      } else {
        await page.getByRole("button", { name: "Lionel Messi" }).click();
      }
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }
}
