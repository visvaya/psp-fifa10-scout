// The eye beside a filter shows or hides its column, in the wide table and in the phone rows.
import { expect, test } from "@playwright/test";
import {
  expandSections,
  expectNoAxeViolations,
  guardSecurityPolicy,
  loadDatabase,
  PHONE,
  readStored,
} from "./support.ts";

guardSecurityPolicy();

test.describe("wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("hides an attribute's column and shows one no filter asks for", async ({ page }) => {
    await loadDatabase(page);
    await page.getByText("Atrybuty", { exact: true }).click();
    await page.getByLabel("Dodaj atrybut").selectOption({ label: "Drybling" });
    await page.getByRole("group", { name: "Drybling" }).getByLabel("od").fill("10");
    const dribbling = page.getByRole("columnheader", { name: /^Drybling/u });
    const dribblingEye = page.getByRole("button", { name: "Kolumna: Drybling" });
    await expect(dribbling).toBeVisible();
    await expect(dribblingEye).toHaveAttribute("aria-pressed", "true");
    await dribblingEye.click();
    await expect(dribbling).toBeHidden();
    await expect(dribblingEye).toHaveAttribute("aria-pressed", "false");

    await page.getByText("Sylwetka", { exact: true }).click();
    const height = page.getByRole("columnheader", { name: /^Wzrost/u });
    const heightEye = page.getByRole("button", { name: "Kolumna: Wzrost (cm)" });
    await expect(height).toBeHidden();
    await heightEye.click();
    await expect(height).toBeVisible();
    await expect(heightEye).toHaveAttribute("aria-pressed", "true");
    // The first player's height is in the new column.
    await expect(page.locator("tbody tr[aria-rowindex] td").nth(-1)).not.toHaveText("");
  });

  test("keeps the choice after a reload", async ({ page }) => {
    await loadDatabase(page);
    const age = page.getByRole("columnheader", { name: /^Wiek/u });
    await page.getByRole("button", { name: "Kolumna: Wiek" }).click();
    await expect(age).toBeHidden();
    await expect
      .poll(async () => page.evaluate(readStored, "preferences"))
      .toMatchObject({ value: { columns: { age: "hidden" } } });
    await page.reload();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(age).toBeHidden();
    await expect(page.getByRole("button", { name: "Kolumna: Wiek" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("has an eye only at filters with a column, and passes axe", async ({ page }) => {
    await loadDatabase(page);
    await expandSections(page);
    // No eye at a list without a column of its own.
    await expect(page.getByRole("button", { name: "Kolumna: Pozycje", exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Kolumna: Lepsza noga" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Kolumna: Pozycje szczegółowe" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kolumna: Klub" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Kolumna: Kontrakt kończy się najpóźniej w" }),
    ).toBeVisible();
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
    const eye = dialog.getByRole("button", { name: "Kolumna: Klub" });
    // The touch target is at least 44 px.
    const box = await eye.boundingBox();
    expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44);
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
    const sideways = await page.evaluate(
      () =>
        (document.scrollingElement?.scrollWidth ?? 0) >
        (document.scrollingElement?.clientWidth ?? 0),
    );
    expect(sideways).toBe(false);
  });
});
