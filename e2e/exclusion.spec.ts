// A list filter turned round: everyone but its chosen values.
import { openSection, expect, expectCount, expectStored, loadDatabase, test } from "./support.ts";

test.describe("excluding filters", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("keeps everyone but the chosen nationality, and after a reload", async ({ page }) => {
    await loadDatabase(page);
    await openSection(page, "Klub");
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
    await expectStored(page, "preferences", {
      value: { filters: { excludedLists: { nationalityId: true } } },
    });
    await page.reload();
    await openSection(page, "Klub");
    await expect(exclude).toBeChecked();
    await expectCount(page, "31 zawodników");
    // Argentina has 31 of the 62 players, so the count alone cannot tell the exclusion from the choice.
    await expect(page.getByRole("button", { name: /^Lionel Messi/u })).toBeHidden();
    // Removing the chip clears the choice and its exclusion together.
    await page.getByRole("button", { name: "Usuń filtr: Narodowość: oprócz Argentina" }).click();
    await expectCount(page, "62 zawodników");
    await expect(exclude).toBeHidden();
  });
});
