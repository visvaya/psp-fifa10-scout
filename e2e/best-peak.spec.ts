import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  cardValue,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  guardSecurityPolicy,
  loadCareer,
  PHONE,
  showPotential,
} from "./support.ts";

guardSecurityPolicy();

const peakAtBestBox = (page: Page) =>
  page.getByRole("checkbox", { name: "Szczyt OVR na jego najlepszej pozycji" });
const bestPeakHeader = (page: Page) =>
  page.getByRole("columnheader", { name: /^Szczyt OVR na najlepszej pozycji/u });

test.describe("peak at the best position, wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("swaps the peak column for the best position's, with its abbreviation", async ({ page }) => {
    await loadCareer(page);
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    const peak = page.getByRole("columnheader", { name: /^Szczyt OVR(?! na)/u });
    await expect(peak).toBeVisible();
    await expect(bestPeakHeader(page)).toHaveCount(0);
    await expect(peakAtBestBox(page)).toHaveAccessibleDescription(/pozycji, na której szczyt/u);
    await expectNoAxeViolations(page);
    await peakAtBestBox(page).check();
    await expect(peak).toHaveCount(0);
    await expect(bestPeakHeader(page)).toBeVisible();
    // The number is followed by the position abbreviation, in the position's own element.
    await expect(page.locator("tbody tr[aria-rowindex] td .position").first()).toBeVisible();
    await bestPeakHeader(page).getByRole("button").click();
    await expect(bestPeakHeader(page)).toHaveAttribute("aria-sort", "descending");
    await page.getByRole("group", { name: "Szczyt OVR", exact: true }).getByLabel("od").fill("1");
    await expect(page.getByText(/Szczyt OVR na najlepszej pozycji: od\s1/u).first()).toBeVisible();
    await expectNoAxeViolations(page);
    // Off again, the sort follows the preferred position's peak.
    await peakAtBestBox(page).uncheck();
    await expect(peak).toBeVisible();
    await expect(peak).toHaveAttribute("aria-sort", "descending");
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
    await expect(page.locator(".player-row-cell .position").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
