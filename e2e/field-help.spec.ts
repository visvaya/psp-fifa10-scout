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
