// The eye beside a filter shows or hides its column, in the wide table and in the phone rows.
import type { Page } from "@playwright/test";
import {
  expandSections,
  expect,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  expectStored,
  firstCellOf,
  loadDatabase,
  PHONE,
  readStored,
  resetSettings,
  storedColumns,
  test,
  writeStored,
} from "./support.ts";

type Box = { x: number; y: number; width: number; height: number };

/** Whether two drawn boxes share no point. */
const apart = (a: Box, b: Box) =>
  a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

/** The eye of a column, named after its filter. */
const eyeOf = (page: Page, label: string) =>
  page.getByRole("button", { name: `Pokaż kolumnę: ${label}`, exact: true });

test.describe("wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("hides an attribute's column and shows one no filter asks for", async ({ page }) => {
    await loadDatabase(page);
    await page.getByText("Atrybuty", { exact: true }).click();
    await page.getByLabel("Dodaj atrybut").selectOption({ label: "Drybling" });
    await page.getByRole("group", { name: "Drybling" }).getByLabel("od").fill("10");
    const dribbling = page.getByRole("columnheader", { name: /^Drybling/u });
    await expect(dribbling).toBeVisible();
    await expect(eyeOf(page, "Drybling")).toHaveAttribute("aria-pressed", "true");
    await eyeOf(page, "Drybling").click();
    await expect(dribbling).toBeHidden();
    await expect(eyeOf(page, "Drybling")).toHaveAttribute("aria-pressed", "false");

    await page.getByText("Sylwetka", { exact: true }).click();
    const height = page.getByRole("columnheader", { name: /^Wzrost/u });
    await expect(height).toBeHidden();
    await eyeOf(page, "Wzrost (cm)").click();
    await expect(height).toBeVisible();
    await expect(eyeOf(page, "Wzrost (cm)")).toHaveAttribute("aria-pressed", "true");
    // The first player's height is in the new column, found by its heading.
    await expect(await firstCellOf(page, "Wzrost")).toHaveText(/^\d+$/u);
  });

  test("keeps the choice after a reload, and Resetuj brings the columns back", async ({ page }) => {
    await loadDatabase(page);
    const age = page.getByRole("columnheader", { name: /^Wiek/u });
    await eyeOf(page, "Wiek").click();
    await expect(age).toBeHidden();
    await expectStored(page, "preferences", { value: { columns: { age: "hidden" } } });
    await page.reload();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(age).toBeHidden();
    await expect(eyeOf(page, "Wiek")).toHaveAttribute("aria-pressed", "false");
    // Nothing else is set, and the reset is still on offer for the columns alone.
    await resetSettings(page);
    await expect(age).toBeVisible();
    await expect(eyeOf(page, "Wiek")).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("rating width", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("measures a rating column shown after the table was drawn without one", async ({ page }) => {
    await loadDatabase(page);
    await expandSections(page);
    await eyeOf(page, "Wiek").click();
    await expectStored(page, "preferences", { value: { columns: { age: "hidden" } } });
    // Every rating column hidden, as a user can choose with the eyes.
    const stored: unknown = await page.evaluate(readStored, "preferences");
    const value: unknown = Reflect.get(Object(stored), "value");
    const ratings = [
      "overall",
      "sprintspeed",
      "dribbling",
      "shortpassing",
      "finishing",
      "tackling",
    ];
    const columns = Object.fromEntries([...ratings, "reactions"].map((key) => [key, "hidden"]));
    const preferences = Object.assign({}, stored, { value: Object.assign({}, value, { columns }) });
    await page.evaluate(writeStored, ["preferences", preferences] as const);
    await page.reload();
    await expect(page.locator("table.players.measured")).toBeVisible();
    await expect(page.locator("tbody .rating")).toHaveCount(0);
    // A badge wider than any label: only a measured rating makes its column wide enough.
    await page.evaluate(() => {
      const sheet = document.styleSheets[document.styleSheets.length - 1];
      sheet?.insertRule("table.players .rating { min-width: 8rem; }", sheet.cssRules.length);
    });
    await expandSections(page);
    await eyeOf(page, "OVR").click();
    const header = page.getByRole("columnheader", { name: /^OVR/u });
    const badge = page.locator("tbody tr[aria-rowindex] .rating").first();
    await expect(badge).toBeVisible();
    const [headerBox, badgeBox] = await Promise.all([header.boundingBox(), badge.boundingBox()]);
    expect(headerBox?.width ?? 0).toBeGreaterThanOrEqual(
      badgeBox?.width ?? Number.POSITIVE_INFINITY,
    );
  });
});

test.describe("back to the automatic columns", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("stores no choice once a column is back as the filters show it", async ({ page }) => {
    await loadDatabase(page);
    await page.getByText("Atrybuty", { exact: true }).click();
    await page.getByLabel("Dodaj atrybut").selectOption({ label: "Drybling" });
    await page.getByRole("group", { name: "Drybling" }).getByLabel("od").fill("10");
    await eyeOf(page, "Drybling").click();
    await expect.poll(async () => storedColumns(page)).toBe('{"dribbling":"hidden"}');
    // Shown again, the column is what the filter gives: nothing is stored for it.
    await eyeOf(page, "Drybling").click();
    await expect(page.getByRole("columnheader", { name: /^Drybling/u })).toBeVisible();
    await expect.poll(async () => storedColumns(page)).toBe("{}");
  });
});

test.describe("filter panel", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("has an eye only at filters with a column, and passes axe", async ({ page }) => {
    await loadDatabase(page);
    await expandSections(page);
    // No eye at a list without a column of its own.
    await expect(eyeOf(page, "Pozycje")).toHaveCount(0);
    await expect(eyeOf(page, "Lepsza noga")).toHaveCount(0);
    await expect(eyeOf(page, "Pozycje szczegółowe")).toBeVisible();
    await expect(eyeOf(page, "Klub")).toBeVisible();
    await expect(eyeOf(page, "Kontrakt kończy się najpóźniej w")).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Kontrakt kończy się najpóźniej w" }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe("phone", () => {
  test.use(PHONE);

  test("shows the club as a column and drops it from the line under the name", async ({ page }) => {
    await loadDatabase(page);
    const row = page.locator(".player-row").first();
    const club = row.locator(".player-row-cell").filter({ hasText: "Klub" });
    await expect(club).toHaveCount(0);
    const line = row.locator(".player-row-meta");
    const clubName = (await line.textContent())?.split("·").at(-1)?.trim() ?? "";
    expect(clubName).not.toBe("");

    await page.getByRole("button", { name: "Filtry" }).click();
    const dialog = page.getByRole("dialog", { name: "Filtry" });
    await dialog.getByText("Klub i kontrakt", { exact: true }).click();
    const eye = eyeOf(page, "Klub");
    await expect(eye).toHaveAttribute("aria-pressed", "false");
    await eye.click();
    await expect(eye).toHaveAttribute("aria-pressed", "true");
    await expectNoAxeViolations(page);
    await dialog.getByRole("button", { name: "Zamknij" }).click();

    await expect(page.locator(".player-rows-header .column-label")).toHaveText(["OVR", "Klub"]);
    await expect(club).toHaveCount(1);
    await expect(club).toContainText(clubName);
    // The position and age stay under the name, the club is not repeated there.
    await expect(line).not.toContainText(clubName);
    await expect(line).toContainText("lat");
    // The list scrolls sideways, not the page.
    await expectNoHorizontalOverflow(page);
  });

  test("starts the line under the name with what has no column, and drops it when all have", async ({
    page,
  }) => {
    await loadDatabase(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    const dialog = page.getByRole("dialog", { name: "Filtry" });
    const meta = page.locator(".player-row-meta");
    await eyeOf(page, "Pozycje szczegółowe").click();
    await dialog.getByRole("button", { name: "Zamknij" }).click();
    // The position has its column: the line opens with the age, without a separator before it.
    await expect(meta.first()).toHaveText(/^\d+\slat\w*\s·\s\S/u);
    await page.getByRole("button", { name: "Filtry" }).click();
    await eyeOf(page, "Wiek").click();
    await dialog.getByText("Klub i kontrakt", { exact: true }).click();
    await eyeOf(page, "Klub").click();
    await dialog.getByRole("button", { name: "Zamknij" }).click();
    await expect(page.locator(".player-rows-header .column-label")).toHaveText([
      "OVR",
      "Poz.",
      "Wiek",
      "Klub",
    ]);
    await expect(meta).toHaveCount(0);
  });
});

test.describe("phone filter panel", () => {
  test.use(PHONE);

  test('keeps the eye close to the "?", the marks apart', async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    const dialog = page.getByRole("dialog", { name: "Filtry" });
    // The "?" and the eye beside a field's name are 34 px wide targets, so the eye stays close to the "?"
    // (owner, 2026-11-07; WCAG 2.5.8 asks for 24 px); the clear button stays a full 44 px target.
    const age = dialog.getByRole("group", { name: "Wiek", exact: true });
    await age.getByLabel("do", { exact: true }).fill("25");
    const [help, eye, clear] = await Promise.all([
      dialog.getByRole("button", { name: "Wyjaśnienie: Wiek", exact: true }).boundingBox(),
      eyeOf(page, "Wiek").boundingBox(),
      dialog.getByRole("button", { name: "Wyczyść: Wiek" }).boundingBox(),
    ]);
    if (help === null || eye === null || clear === null) throw new Error("a button is not drawn");
    for (const box of [help, eye]) {
      expect(box.width).toBeGreaterThanOrEqual(34);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(Math.min(clear.width, clear.height)).toBeGreaterThanOrEqual(44);
    expect([apart(help, eye), apart(eye, clear), apart(help, clear)]).toEqual([true, true, true]);
    // The eye follows the "?" on its row.
    const gap = eye.x + eye.width / 2 - (help.x + help.width / 2);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(35);
    expect(Math.abs(eye.y + eye.height / 2 - (help.y + help.height / 2))).toBeLessThan(
      help.height / 2,
    );
  });
});
