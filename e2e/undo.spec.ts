// Taking back the last changes of the filters and the sort, one at a time.
import { expect, test } from "@playwright/test";
import { expectCount, guardSecurityPolicy, loadDatabase } from "./support.ts";

guardSecurityPolicy();

test.describe("undo", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("takes back the last changes one at a time", async ({ page }) => {
    await loadDatabase(page);
    const undo = page.getByRole("button", { name: "Cofnij", exact: true });
    await expect(undo).toBeDisabled();
    const goalkeeper = page.getByRole("checkbox", { name: "Bramkarz" });
    await goalkeeper.check();
    await page.getByLabel("Sortuj według").selectOption("age");
    await page.getByRole("button", { name: "Wyczyść filtry" }).click();
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
});
