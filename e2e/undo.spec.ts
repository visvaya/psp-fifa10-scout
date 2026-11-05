// Taking back the last changes of the filters and the sort, one at a time, and resetting them all.
import { expect, test } from "@playwright/test";
import { expectCount, guardSecurityPolicy, loadDatabase, resetSettings } from "./support.ts";

guardSecurityPolicy();

test.describe("undo", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("takes back the last changes one at a time", async ({ page }) => {
    await loadDatabase(page);
    const undo = page.locator(".reset-filters").getByRole("button", { name: "Cofnij" });
    await expect(undo).toBeDisabled();
    const goalkeeper = page.getByRole("checkbox", { name: "Bramkarz" });
    await goalkeeper.check();
    await page.getByLabel("Sortuj według").selectOption("age");
    await resetSettings(page);
    await expect(goalkeeper).not.toBeChecked();
    // The reset, then the sort, then the position.
    await undo.click();
    await expect(goalkeeper).toBeChecked();
    await expect(page.getByLabel("Sortuj według")).toHaveValue("age");
    await undo.click();
    await expect(page.getByLabel("Sortuj według")).toHaveValue("overall");
    await expect(goalkeeper).toBeChecked();
    await undo.click();
    await expect(goalkeeper).not.toBeChecked();
    await expectCount(page, "62 zawodników");
    await expect(undo).toBeDisabled();
  });

  // "Resetuj" asks first; it brings the potential switch back too, and the chips' bar has the same pair.
  test("resets every setting after a question", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    await page.getByRole("checkbox", { name: "Bramkarz" }).check();
    const chipsBar = page.locator(".chips-bar");
    await chipsBar.getByRole("button", { name: "Resetuj" }).click();
    const question =
      "Przywrócić domyślne filtry, sortowanie i widok bez potencjału? Wgrane pliki, język nazw i zapisane zestawy zostaną.";
    await expect(chipsBar.getByText(question)).toBeVisible();
    await chipsBar.getByRole("button", { name: "Anuluj" }).click();
    await expect(page.getByRole("checkbox", { name: "Bramkarz" })).toBeChecked();
    await expect(chipsBar.getByRole("button", { name: "Resetuj" })).toBeFocused();
    await chipsBar.getByRole("button", { name: "Resetuj" }).click();
    await expect(chipsBar.getByRole("button", { name: "Resetuj" })).toBeFocused();
    await chipsBar.getByRole("button", { name: "Resetuj" }).click();
    await expect(page.getByRole("checkbox", { name: "Bramkarz" })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Pokaż potencjał" })).not.toBeChecked();
    // With nothing left to reset, the change can still be taken back from the same place.
    await expect(chipsBar.getByRole("button", { name: "Cofnij" })).toBeFocused();
  });
});
