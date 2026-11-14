// Reading the large development chart at an age (owner, 2026-11-13): a finger or the mouse along the
// chart, or the keys, show its value at that age under it.
import { expect, expectNoAxeViolations, loadDatabase, test } from "./support.ts";

test.describe("chart reading", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("reads the chart at an age by pointer and by keys", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await page.getByRole("button", { name: "Paweł Brożek" }).click();
    await page.getByRole("button", { name: "Pokaż krzywą rozwoju: Paweł Brożek" }).click();
    const chart = page.getByRole("dialog", { name: "Krzywa rozwoju: Paweł Brożek" });
    const reading = chart.getByRole("slider", { name: "Wiek na wykresie" });
    const words = chart.locator(".chart-reading");
    await expect(words).toHaveText(/^Przesuń palcem/u);
    await expect(chart.locator(".reading-mark")).toHaveCount(0);
    const box = await reading.boundingBox();
    if (box === null) throw new Error("The chart has no reading area");
    // At the plot's left edge: the first age of the synthetic curve.
    await page.mouse.click(box.x + 1, box.y + box.height / 2);
    await expect(words).toHaveText(/^w\swieku 15\slat: poziom \d+$/u);
    await expect(chart.locator(".reading-mark")).toHaveCount(1);
    await expect(reading).toBeFocused();
    await reading.press("End");
    await expect(words).toHaveText(/^w\swieku 45\slat: poziom \d+$/u);
    await reading.press("ArrowLeft");
    await expect(reading).toHaveAttribute("aria-valuetext", /^w\swieku 44\slata: poziom \d+$/u);
    await expect(reading).toHaveAttribute("aria-valuenow", "44");
    await expectNoAxeViolations(page);
  });
});
