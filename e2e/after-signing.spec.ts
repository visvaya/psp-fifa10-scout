// "Wartość po podpisaniu": with a career, the list counts players outside the squad as once signed.
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

    const signing = page.getByRole("checkbox", { name: "Wartość po podpisaniu" });
    await signing.check();
    // The game adds learning speed plus potential mod 5: 1 to 9.
    await expect.poll(highest).toBeGreaterThan(before);
    expect(await highest()).toBeLessThanOrEqual(before + 9);
    await expect(page.getByText("Liczę wartości po podpisaniu…")).toBeHidden();
    await expectNoAxeViolations(page);

    // His card pairs what signing changes, before and after.
    await page.locator("tbody tr[aria-rowindex]").first().locator("th button").click();
    const card = page.getByRole("dialog");
    const signed = card.getByRole("region", { name: "Po podpisaniu" });
    await expect(signed.getByText("Potencjał", { exact: true })).toBeVisible();
    await expectNoAxeViolations(page);
    await card.getByRole("button", { name: "Zamknij" }).click();

    await signing.uncheck();
    await expect.poll(highest).toBe(before);
  });
});
