import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  cardValue,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  guardSecurityPolicy,
  loadCareer,
  PHONE,
  readStored,
  storedColumns,
  showPotential,
} from "./support.ts";

guardSecurityPolicy();

const peakAtBestBox = (page: Page) =>
  page.getByRole("checkbox", { name: "Szczyt OVR na jego najlepszej pozycji" });
const peakHeader = (page: Page) => page.getByRole("columnheader", { name: /^Szczyt OVR/u });
const bestPeakHeader = (page: Page) =>
  page.getByRole("columnheader", { name: /^Najlepszy szczyt/u });
const peakEye = (page: Page) =>
  page.getByRole("button", { name: "Pokaż kolumnę: Szczyt OVR", exact: true });

/** The first row's cell in the column whose heading starts with the text. */
const firstCellOf = async (page: Page, heading: string) => {
  const headings = await page.locator("thead th").allTextContents();
  const index = headings.findIndex((text) => text.startsWith(heading));
  expect(index).toBeGreaterThan(0);
  return page.locator("tbody tr[aria-rowindex]").first().locator("th, td").nth(index);
};

test.describe("peak at the best position, wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("swaps the peak column for the best position's, with its abbreviation", async ({ page }) => {
    await loadCareer(page);
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    await expect(peakHeader(page)).toBeVisible();
    await expect(bestPeakHeader(page)).toHaveCount(0);
    // Without the choice the peak cell is a bare rating, with no position beside it.
    await expect((await firstCellOf(page, "Szczyt OVR")).locator(".position")).toHaveCount(0);
    await expect(peakAtBestBox(page)).toHaveAccessibleDescription(/osobno dla każdej pozycji/u);
    await expectNoAxeViolations(page);
    await peakAtBestBox(page).check();
    await expect(peakHeader(page)).toHaveCount(0);
    await expect(bestPeakHeader(page)).toBeVisible();
    // The number is followed by the position abbreviation, in the peak column's own cell, unclipped.
    const cell = await firstCellOf(page, "Najlepszy szczyt");
    await expect(cell.locator(".position")).toBeVisible();
    expect(
      await cell.evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(0);
    await page.getByRole("group", { name: "Szczyt OVR", exact: true }).getByLabel("od").fill("1");
    await expect(page.getByText(/Najlepszy szczyt: od\s1/u).first()).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("sorts by the best peak with the choice and by the preferred one without", async ({
    page,
  }) => {
    await loadCareer(page);
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    const secondRow = page.locator("tbody tr[aria-rowindex] th button").nth(1);
    await peakAtBestBox(page).check();
    await bestPeakHeader(page).getByRole("button").click();
    await expect(bestPeakHeader(page)).toHaveAttribute("aria-sort", "descending");
    // Brożek peaks at 61 as a centre-back, below only Messi's 88; as a striker he peaks at 49.
    await expect(secondRow).toHaveText("Paweł Brożek");
    await expect
      .poll(async () => page.evaluate(readStored, "preferences"))
      .toMatchObject({ value: { sort: { key: "peak", direction: "descending" } } });
    await peakAtBestBox(page).uncheck();
    await expect(peakHeader(page)).toHaveAttribute("aria-sort", "descending");
    await expect(secondRow).not.toHaveText("Paweł Brożek");
  });
});

test.describe("peak at the best position, eye and card", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("hides and shows the peak column with one eye, whichever the mode", async ({ page }) => {
    await loadCareer(page);
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    await peakAtBestBox(page).check();
    await peakEye(page).click();
    await expect(bestPeakHeader(page)).toBeHidden();
    await expect.poll(async () => storedColumns(page)).toBe('{"peak":"hidden"}');
    // The hidden column stays hidden when the choice goes off, and the same eye brings it back.
    await peakAtBestBox(page).uncheck();
    await expect(peakHeader(page)).toBeHidden();
    await peakEye(page).click();
    await expect(peakHeader(page)).toBeVisible();
    await expect.poll(async () => storedColumns(page)).toBe("{}");
    await peakAtBestBox(page).check();
    await expect(bestPeakHeader(page)).toBeVisible();
  });

  test("adds the best peak position to the card when it peaks above the preferred one", async ({
    page,
  }) => {
    await loadCareer(page);
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    // Brożek plays as a striker (peak 49) but peaks at 61 as a centre-back.
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await page.getByRole("button", { name: "Paweł Brożek" }).click();
    const card = page.getByRole("dialog", { name: "Paweł Brożek" });
    await expect(cardValue(card, "Szczyt OVR")).toHaveText("49");
    await expect(cardValue(card, "Szczyt na najlepszej pozycji")).toHaveText(/^61\s\S+$/u);
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    // A player who peaks best at his own position gets no extra row.
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("messi");
    await page.getByRole("button", { name: "Lionel Messi" }).click();
    const messi = page.getByRole("dialog", { name: "Lionel Messi" });
    await expect(messi.getByRole("term").filter({ hasText: /^Szczyt/u })).toHaveCount(1);
  });
});

test.describe("peak at the best position, phone", () => {
  test.use(PHONE);

  test("fits 390 px with the best position's peak shown", async ({ page }) => {
    await loadCareer(page);
    await showPotential(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    await peakAtBestBox(page).check();
    await page.getByRole("group", { name: "Szczyt OVR", exact: true }).getByLabel("od").fill("1");
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await page.getByRole("button", { name: "Zamknij" }).click();
    const cell = page
      .locator(".player-row-cell")
      .filter({ has: page.locator(".position") })
      .first();
    await expect(cell).toBeVisible();
    expect(
      await cell.evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(0);
    await expectNoHorizontalOverflow(page);
  });
});
