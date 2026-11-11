import type { Locator, Page } from "@playwright/test";
import {
  cardValue,
  expect,
  expectCount,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  expectStored,
  firstCellOf,
  loadCareer,
  PHONE,
  showPotential,
  storedColumns,
  test,
} from "./support.ts";

const peakAtBestBox = (page: Page) =>
  page.getByRole("checkbox", { name: "Szczyt OVR na jego najlepszej pozycji" });
const peakHeader = (page: Page) => page.getByRole("columnheader", { name: /^Szczyt OVR/u });
const bestPeakHeader = (page: Page) =>
  page.getByRole("columnheader", { name: /^Najlepszy szczyt/u });
const peakEye = (page: Page) =>
  page.getByRole("button", { name: "Pokaż kolumnę: Szczyt OVR", exact: true });

/**
 * How far a card value's rating badge ends before its row's right edge: 0 when it ends the row, in line
 * with the badges of the rows above and below it.
 */
const badgeGap = async (value: Locator) =>
  value
    .locator(".rating")
    .evaluate((badge) =>
      Math.round(
        (badge.closest(".facts > div")?.getBoundingClientRect().right ?? 0) -
          badge.getBoundingClientRect().right,
      ),
    );

/**
 * The best peak cells as two sub-columns: every badge from one left edge, every abbreviation from another
 * whatever its length, all within the cell.
 */
const expectAlignedPeaks = async (cells: Locator) => {
  const boxes = await cells.evaluateAll((elements) =>
    elements.map((cell) => {
      const [cellBox, badge, name] = [
        cell.getBoundingClientRect(),
        cell.querySelector(".rating")?.getBoundingClientRect(),
        cell.querySelector(".position"),
      ];
      return {
        badge: Math.round(badge?.left ?? Number.NaN),
        name: Math.round(name?.getBoundingClientRect().left ?? Number.NaN),
        length: name?.textContent.length ?? 0,
        overflow: cell.scrollWidth - cell.clientWidth,
        beyond: (name?.getBoundingClientRect().right ?? 0) - cellBox.right,
      };
    }),
  );
  // Abbreviations of different lengths, as "N" against "CPS".
  expect(new Set(boxes.map((box) => box.length)).size).toBeGreaterThan(1);
  expect(new Set(boxes.map((box) => box.badge)).size).toBe(1);
  expect(new Set(boxes.map((box) => box.name)).size).toBe(1);
  for (const box of boxes) {
    expect(box.overflow).toBeLessThanOrEqual(0);
    expect(box.beyond).toBeLessThanOrEqual(0);
  }
};

test.describe("peak at the best position, wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // Two tests, one axe scan each: in WebKit a scan of the full list takes 7-8 s, and both in one test
  // ran close to the 30 s timeout.
  test("explains the choice of the best position's peak", async ({ page }) => {
    await loadCareer(page);
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    await page
      .getByRole("button", { name: "Wyjaśnienie: Szczyt OVR na jego najlepszej pozycji" })
      .click();
    await expect(page.getByText(/osobno dla każdej pozycji/u)).toBeVisible();
    // And how a tie between positions is settled.
    await expect(page.getByText(/formacji twojego klubu w\szapisie/u)).toBeVisible();
    // And that the order of those rules can change.
    await expect(page.getByText(/Kolejność reguł zmienisz/u)).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("swaps the peak column for the best position's, with its abbreviation", async ({ page }) => {
    await loadCareer(page);
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    await expect(peakHeader(page)).toBeVisible();
    await expect(bestPeakHeader(page)).toHaveCount(0);
    // Without the choice the peak cell is a bare rating, with no position beside it.
    await expect((await firstCellOf(page, "Szczyt OVR")).locator(".position")).toHaveCount(0);
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

  test("lines up the badges and the positions of the best peak in every row", async ({ page }) => {
    await loadCareer(page);
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    await peakAtBestBox(page).check();
    await expect(bestPeakHeader(page)).toBeVisible();
    const headings = await page.locator("thead th").allTextContents();
    const column = headings.findIndex((text) => text.startsWith("Najlepszy szczyt")) + 1;
    const cells = page.locator(`tbody tr[aria-rowindex] > :nth-child(${String(column)})`);
    await expectAlignedPeaks(cells);
    // Read as "88 RWM", not run together by the grid that lines them up. Messi, right-footed, ties on
    // RWM, RM, LM and LWM, none in the user's diamond: his better foot leaves RWM and RM, RWM first.
    await expect(cells.first()).toHaveAccessibleName("88 RWM");
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
    await expectStored(page, "preferences", {
      value: { sort: { key: "peak", direction: "descending" } },
    });
    await peakAtBestBox(page).uncheck();
    await expect(peakHeader(page)).toHaveAttribute("aria-sort", "descending");
    await expect(secondRow).not.toHaveText("Paweł Brożek");
  });
});

/** The rules that break a best peak tie, in their shown order. */
const tieRules = (page: Page) =>
  page.getByRole("group", { name: "Przy remisie szczytu wybieraj według" }).getByRole("listitem");

test.describe("peak at the best position, order of the tie rules", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("moves a rule with its buttons, keeps the keyboard on it and stores the order", async ({
    page,
  }) => {
    await loadCareer(page);
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    const rules = tieRules(page);
    await expect(rules).toHaveText([
      /^pozycje z\sformacji/u,
      /^środek/u,
      /^strona lepszej nogi/u,
      /^pozycja preferowana/u,
    ]);
    const reset = page.getByRole("button", { name: "Przywróć domyślną kolejność" });
    await expect(reset).toBeDisabled();
    // The first rule has no "up", the last no "down".
    await expect(rules.first().getByRole("button", { name: /^W górę/u })).toHaveCount(0);
    await expect(rules.last().getByRole("button", { name: /^W dół/u })).toHaveCount(0);
    await expectNoAxeViolations(page);
    const up = page.getByRole("button", { name: "W górę: pozycja preferowana" });
    await up.click();
    await expect(up).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    // At the top its "up" goes: the keyboard moves to its "down".
    await expect(rules.first()).toHaveText(/^pozycja preferowana/u);
    await expect(page.getByRole("button", { name: "W dół: pozycja preferowana" })).toBeFocused();
    const order = ["preferredPosition", "formation", "weakFootCentre", "betterFootSide"];
    await expectStored(page, "preferences", { value: { tieOrder: order } });
    await page.reload();
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    await expect(rules.first()).toHaveText(/^pozycja preferowana/u);
    await reset.click();
    await expect(rules.first()).toHaveText(/^pozycje z\sformacji/u);
    await expect(reset).toBeDisabled();
    // The reset button goes off: the keyboard moves to the first rule.
    await expect(rules.first().getByRole("button")).toBeFocused();
  });

  test("changes a tied best peak position with the order and back with the reset", async ({
    page,
  }) => {
    await loadCareer(page);
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    await peakAtBestBox(page).check();
    // Tomasz Remis, a centre-back with no team, peaks alike at RCB, CB and LCB.
    await page.getByText("Klub i kontrakt").click();
    await page.getByRole("radio", { name: "niedostępni w karierze" }).check();
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("remis");
    await expectCount(page, "1 zawodnik");
    const cell = await firstCellOf(page, "Najlepszy szczyt");
    // The diamond's RCB and LCB, then RCB on his right foot.
    await expect(cell).toHaveAccessibleName("61 RCB");
    const up = page.getByRole("button", { name: "W górę: pozycja preferowana" });
    // One place up the preferred position still follows the formation, which leaves no CB.
    await up.click();
    await expect(cell).toHaveAccessibleName("61 RCB");
    await up.click();
    await up.click();
    // Above the formation it keeps his own CB.
    await expect(tieRules(page).first()).toHaveText(/^pozycja preferowana/u);
    await expect(cell).toHaveAccessibleName("61 CB");
    await page.getByRole("button", { name: "Przywróć domyślną kolejność" }).click();
    await expect(cell).toHaveAccessibleName("61 RCB");
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
    // The abbreviation first, the badge at the right edge in line with the OVR's.
    const bestValues = cardValue(card, "Szczyt na najlepszej pozycji");
    const best = bestValues.first();
    // RCB, CB and LCB tie: the diamond's RCB and LCB, RCB on his right foot.
    await expect(best).toHaveText(/^RCB\s61$/u);
    // CB and LCB rate the same way as RCB, so no note names them (owner, 2026-11-10): the note names only
    // other position groups that reach the same peak, and here there are none.
    await expect(bestValues).toHaveCount(1);
    await expectNoAxeViolations(page);
    const values = [best, cardValue(card, "OVR"), cardValue(card, "Szczyt OVR")];
    expect(await Promise.all(values.map(badgeGap))).toEqual([0, 0, 0]);
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
    const cells = page.locator(".player-row-cell:has(.best-peak)");
    const cell = cells.first();
    await expect(cell).toBeVisible();
    expect(
      await cell.evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(0);
    await expectAlignedPeaks(cells);
    await expectNoHorizontalOverflow(page);
    // The best peak fits on the card too.
    await page.getByRole("button", { name: /^Filtry/u }).click();
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await page.getByRole("button", { name: "Zamknij" }).click();
    await page.getByRole("button", { name: /^Paweł Brożek/u }).click();
    await expect(page.getByRole("dialog", { name: "Paweł Brożek" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
