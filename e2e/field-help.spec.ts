// A field's explanation behind its "?" button (owner, 2026-11-06): opened by keyboard or tap, closed by
// Escape or a tap outside, one at a time, on screen at phone width, in the filters and on the card.
import type { Locator, Page } from "@playwright/test";
import {
  expect,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  loadCareer,
  PHONE,
  test,
} from "./support.ts";

/** The panel a "?" button opens. */
const panelOf = async (page: Page, button: Locator): Promise<Locator> => {
  const id = await button.getAttribute("aria-controls");
  expect(id).not.toBeNull();
  return page.locator(`[id="${String(id)}"]`);
};

/** The panel lies within the viewport's width. */
const expectOnScreen = async (page: Page, panel: Locator) => {
  const box = await panel.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box).not.toBeNull();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(width);
};

/** Where a summary's name ends on screen, without its marker. */
const nameEnd = async (summary: Locator) =>
  summary.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().right;
  });

/**
 * The "Cechy" section's "?" lies on its summary's line, right after the name; it opens its panel without
 * toggling the section, and the summary still does.
 */
const expectSectionHelpOnSummary = async (page: Page, scope: Locator) => {
  const summary = scope.locator("summary").filter({ hasText: /^Cechy$/u });
  const button = scope.getByRole("button", { name: "Wyjaśnienie: Cechy" });
  await summary.scrollIntoViewIfNeeded();
  const [row, mark] = await Promise.all([summary.boundingBox(), button.boundingBox()]);
  const middle = (mark?.y ?? -1) + (mark?.height ?? 0) / 2;
  expect(middle).toBeGreaterThan(row?.y ?? Number.POSITIVE_INFINITY);
  expect(middle).toBeLessThan((row?.y ?? 0) + (row?.height ?? 0));
  // The touch target reaches past the mark it centres, so its middle is measured: just after the name.
  const end = await nameEnd(summary);
  const centre = (mark?.x ?? -1) + (mark?.width ?? 0) / 2;
  expect(centre).toBeGreaterThan(end);
  expect(centre).toBeLessThan(end + 32);
  const section = summary.locator("..");
  await button.click();
  await expect(await panelOf(page, button)).toContainText("Cechy pochodzą z bazy gry");
  await expect(section).not.toHaveAttribute("open");
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
  await summary.click();
  await expect(section).toHaveAttribute("open");
};

test.describe("field explanations, wide", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("open by keyboard, close by Escape back on the button, one at a time", async ({ page }) => {
    await loadCareer(page);
    const button = page.getByRole("button", { name: "Wyjaśnienie: Pozycje", exact: true });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    const panel = await panelOf(page, button);
    await expect(panel).toBeHidden();
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("te same wagi atrybutów");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expectOnScreen(page, panel);
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();

    // Opening another closes the first; a click outside closes the second.
    await button.click();
    await expect(panel).toBeVisible();
    const weakFoot = page.getByRole("button", { name: "Wyjaśnienie: Słabsza noga (1–5)" });
    await weakFoot.click();
    await expect(panel).toBeHidden();
    const weakFootPanel = await panelOf(page, weakFoot);
    await expect(weakFootPanel).toBeVisible();
    await page.locator("p.count").click();
    await expect(weakFootPanel).toBeHidden();
  });

  test("puts a section's explanation on its summary's line", async ({ page }) => {
    await loadCareer(page);
    await expectSectionHelpOnSummary(page, page.locator("body"));
  });

  test("names KR the game's way and explains it as a rolling rating", async ({ page }) => {
    await loadCareer(page);
    await page.getByText("Kariera", { exact: true }).click();
    await expect(page.getByRole("group", { name: "KR (forma)", exact: true })).toBeVisible();
    const button = page.getByRole("button", { name: "Wyjaśnienie: KR (forma)" });
    await button.click();
    const panel = await panelOf(page, button);
    await expect(panel).toContainText("ocena krocząca ze wszystkich meczów");
    await expect(panel).toContainText("Na początku sezonu gra jej nie zeruje");
  });
});

test.describe("field explanations on the wide card", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // The panel is placed against the screen, so it can reach past the card; a click there is not a click
  // on the backdrop and keeps the card open.
  test("keeps the card open on a click in the panel beyond its edge", async ({ page }) => {
    await loadCareer(page);
    await page.getByRole("button", { name: "Lionel Messi" }).click();
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    const button = card.getByRole("button", { name: "Wyjaśnienie: Zarobki rynkowe" });
    await button.click();
    const panel = await panelOf(page, button);
    await expect(panel).toBeVisible();
    const [cardBox, panelBox] = await Promise.all([card.boundingBox(), panel.boundingBox()]);
    const cardRight = (cardBox?.x ?? 0) + (cardBox?.width ?? 0);
    const panelRight = (panelBox?.x ?? 0) + (panelBox?.width ?? 0);
    // The case under test: part of the panel lies beyond the card's right edge.
    expect(panelRight).toBeGreaterThan(cardRight + 10);
    await page.mouse.click(
      (cardRight + panelRight) / 2,
      (panelBox?.y ?? 0) + (panelBox?.height ?? 0) / 2,
    );
    await expect(card).toBeVisible();
    await expect(panel).toBeVisible();
    // The season section: one "?" beside its heading, which keeps its own name; none on the stat rows.
    await expect(
      card.getByRole("heading", { name: "W tym sezonie kariery", exact: true }),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Wyjaśnienie: W tym sezonie kariery" }),
    ).toBeVisible();
    await expect(card.getByRole("button", { name: "Wyjaśnienie: Występy w lidze" })).toHaveCount(0);
  });

  test("closes a panel whose button scrolls out of sight", async ({ page }) => {
    await loadCareer(page);
    await page.getByRole("button", { name: "Lionel Messi" }).click();
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    const button = card.getByRole("button", { name: "Wyjaśnienie: Wiek", exact: true });
    await button.click();
    const panel = await panelOf(page, button);
    await expect(panel).toBeVisible();
    await card.evaluate((dialog) => {
      dialog.scrollBy(0, 2000);
    });
    await expect(panel).toBeHidden();
    await expect(card).toBeVisible();
  });
});

test.describe("field explanations, phone", () => {
  test.use(PHONE);

  test("open by tap in the filter panel, close by a tap outside and by Escape", async ({
    page,
  }) => {
    const dialog = page.getByRole("dialog", { name: "Filtry" });
    const button = dialog.getByRole("button", { name: "Wyjaśnienie: Pozycje", exact: true });
    await loadCareer(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    const panel = await panelOf(page, button);
    await button.tap();
    await expect(panel).toBeVisible();
    await expectOnScreen(page, panel);
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await dialog.getByRole("heading", { name: "Filtry" }).tap();
    await expect(panel).toBeHidden();
    await expect(dialog).toBeVisible();

    // Escape closes the panel only, not the dialog under it.
    await button.tap();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(button).toBeFocused();
  });

  test("puts a section's explanation on its summary's line in the filter dialog", async ({
    page,
  }) => {
    await loadCareer(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    await expectSectionHelpOnSummary(page, page.getByRole("dialog", { name: "Filtry" }));
    await expectNoHorizontalOverflow(page);
  });

  test("explains a row of the player card", async ({ page }) => {
    await loadCareer(page);
    await page
      .getByRole("button", { name: /^Lionel Messi/u })
      .first()
      .tap();
    const card = page.getByRole("dialog", { name: /^Lionel Messi/u });
    const button = card.getByRole("button", { name: "Wyjaśnienie: Cena" });
    const panel = await panelOf(page, button);
    await button.tap();
    await expect(panel).toContainText("jak CENA na liście rynku transferowego");
    await expectOnScreen(page, panel);
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(card).toBeVisible();
  });
});

test.describe("field explanations, short phone screen", () => {
  test.use({ ...PHONE, viewport: { width: 390, height: 320 } });

  // Room on neither side of the button: the panel takes the larger side, stays on screen, keeps clear
  // of the button, and its text scrolls inside it.
  test("keeps a long explanation on screen and scrolls it", async ({ page }) => {
    await loadCareer(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    const dialog = page.getByRole("dialog", { name: "Filtry" });
    await dialog.getByText("Kariera", { exact: true }).click();
    const button = dialog.getByRole("button", { name: "Wyjaśnienie: Klub może go sprzedać" });
    await button.evaluate((element) => {
      element.scrollIntoView({ block: "center" });
    });
    await button.tap();
    const panel = await panelOf(page, button);
    await expect(panel).toBeVisible();
    const [panelBox, buttonBox] = await Promise.all([panel.boundingBox(), button.boundingBox()]);
    const top = panelBox?.y ?? -1;
    const bottom = top + (panelBox?.height ?? Number.POSITIVE_INFINITY);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(bottom).toBeLessThanOrEqual(320);
    const buttonTop = buttonBox?.y ?? 0;
    const buttonBottom = buttonTop + (buttonBox?.height ?? 0);
    expect(bottom <= buttonTop || top >= buttonBottom).toBe(true);
    const scrolled = await panel.evaluate((element) => {
      element.scrollTo(0, element.scrollHeight);
      return element.scrollHeight > element.clientHeight && element.scrollTop > 0;
    });
    expect(scrolled).toBe(true);
    await expectOnScreen(page, panel);
  });
});
