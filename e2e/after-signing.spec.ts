// "Profil po transferze": with a career, the list counts players outside the squad as once signed,
// priced at the user's club.
import { expect, expectNoAxeViolations, firstCellOf, loadCareer, test } from "./support.ts";

test.use({ viewport: { width: 1280, height: 800 } });

test.describe("values after signing", () => {
  test("raises the potential of players outside the squad, and turns back off", async ({
    page,
  }) => {
    await loadCareer(page);
    await page.getByLabel("Pokaż potencjał").check();
    const potential = page.getByRole("columnheader", { name: /^Potencjał/u });
    await potential.getByRole("button").click();
    await expect(potential).toHaveAttribute("aria-sort", "descending");
    const highest = async () => Number(await (await firstCellOf(page, "Potencjał")).textContent());
    const before = await highest();

    const signing = page.getByRole("checkbox", { name: "Profil po transferze" });
    await signing.check();
    // The game adds learning speed plus potential mod 5: 1 to 9.
    await expect.poll(highest).toBeGreaterThan(before);
    expect(await highest()).toBeLessThanOrEqual(before + 9);
    await expect(page.getByText("Liczę profil po transferze…")).toBeHidden();
    // The contract length his price after the transfer is for: the one he wants until chosen.
    const years = page.getByLabel("Długość kontraktu po transferze");
    await expect(years).toHaveValue("");
    await years.selectOption("3");
    await expect(years).toHaveValue("3");
    await expectNoAxeViolations(page);

    // His card pairs what the transfer changes, before and after.
    await page.locator("tbody tr[aria-rowindex]").first().locator("th button").click();
    const card = page.getByRole("dialog");
    const signed = card.getByRole("region", { name: "Po transferze" });
    await expect(signed.getByText("Potencjał", { exact: true })).toBeVisible();
    await expectNoAxeViolations(page);
    await card.getByRole("button", { name: "Zamknij" }).click();

    await signing.uncheck();
    await expect(years).toBeHidden();
    await expect.poll(highest).toBe(before);
  });
});

// Owner, 2026-11-14 (roadmap 123): the profile at the peak, under the potential like every peak value.
test.describe("profile at the peak", () => {
  test("shows with the potential, builds its list and turns back off", async ({ page }) => {
    await loadCareer(page);
    const peak = page.getByRole("checkbox", { name: "Profil w szczycie" });
    await expect(peak).toHaveCount(0);
    await page.getByLabel("Pokaż potencjał").check();
    await peak.check();
    await expect(page.getByText("Liczę profil zawodników…")).toBeHidden();
    await expect(page.locator("tbody tr[aria-rowindex]").first()).toBeVisible();
    await expectNoAxeViolations(page);
    await peak.uncheck();
    await expect(peak).not.toBeChecked();
  });
});
