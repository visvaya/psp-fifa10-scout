// A list filter turned round: everyone but its chosen values.
import { expect, test } from "@playwright/test";
import { expectCount, guardSecurityPolicy, loadDatabase } from "./support.ts";

guardSecurityPolicy();

test.describe("excluding filters", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("keeps everyone but the chosen nationality, and after a reload", async ({ page }) => {
    await loadDatabase(page);
    await page.getByText("Klub i kontrakt").click();
    const nationality = page.getByRole("group", { name: "Narodowość" });
    const exclude = nationality.getByRole("checkbox", { name: "Wszystkie oprócz zaznaczonych" });
    // The switch shows once a value is chosen.
    await expect(exclude).toBeHidden();
    await nationality.getByRole("checkbox", { name: "Argentina" }).check();
    await expectCount(page, "31 zawodników");
    await exclude.check();
    await expectCount(page, "31 zawodników");
    await expect(page.getByRole("button", { name: /^Lionel Messi/u })).toBeHidden();
    const chips = page.getByRole("list", { name: "Aktywne filtry" }).getByRole("button");
    await expect(chips).toHaveText(["Narodowość: oprócz Argentina×"]);
    await page.reload();
    await page.getByText("Klub i kontrakt").click();
    await expect(exclude).toBeChecked();
    await expectCount(page, "31 zawodników");
    // Removing the chip clears the choice and its exclusion together.
    await page.getByRole("button", { name: "Usuń filtr: Narodowość: oprócz Argentina" }).click();
    await expectCount(page, "62 zawodników");
    await expect(exclude).toBeHidden();
  });
});
