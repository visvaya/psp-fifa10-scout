// One field's filter cleared at once, the others kept.
import { expect, test } from "@playwright/test";
import { expectCount, guardSecurityPolicy, loadDatabase } from "./support.ts";

guardSecurityPolicy();

test.describe("clearing one field", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("clears all chosen positions, or a range, with one button", async ({ page }) => {
    await loadDatabase(page);
    const positions = page.getByRole("group", { name: "Pozycje", exact: true });
    const clearPositions = page.getByRole("button", { name: "Wyczyść: Pozycje" });
    // The button shows only while the field filters.
    await expect(clearPositions).toBeHidden();
    await positions.getByRole("checkbox", { name: "Bramkarz" }).check();
    await positions.getByRole("checkbox", { name: "Napastnik" }).check();
    const age = page.getByRole("group", { name: "Wiek", exact: true });
    await age.getByLabel("do").fill("25");
    await expect(page.locator(".count")).not.toHaveText(/^62\s/u);
    await clearPositions.click();
    await expect(positions.getByRole("checkbox", { checked: true })).toHaveCount(0);
    // The button leaves with the filter; the keyboard stays in the field, on its first value.
    await expect(positions.getByRole("checkbox", { name: "Bramkarz" })).toBeFocused();
    await expect(age.getByLabel("do")).toHaveValue("25");
    await page.getByRole("button", { name: "Wyczyść: Wiek" }).click();
    await expect(age.getByLabel("do")).toHaveValue("");
    await expectCount(page, "62 zawodników");
  });

  // Clearing the rating's bounds keeps its position, so the column stays.
  test("clears the position rating bounds and keeps the position", async ({ page }) => {
    await loadDatabase(page);
    const rating = page.getByRole("group", { name: "Ocena na pozycji" });
    await rating
      .getByRole("combobox", { name: "Ocena na pozycji" })
      .selectOption({ label: "Boczny obrońca (RB/LB)" });
    await rating.getByRole("group", { name: "OVR RB/LB" }).getByLabel("od").fill("99");
    await expect(page.getByText("Żaden zawodnik nie spełnia filtrów.")).toBeVisible();
    await page.getByRole("button", { name: "Wyczyść: OVR RB/LB" }).click();
    await expectCount(page, "62 zawodników");
    await expect(page.getByRole("columnheader", { name: /^OVR RB\/LB/u })).toBeVisible();
  });
});
