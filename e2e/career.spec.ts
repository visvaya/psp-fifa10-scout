import { expect, test } from "@playwright/test";
import { SYNTHETIC_DB_PATH, SYNTHETIC_SAVE_PATHS } from "../scripts/write-synthetic-db.ts";
import { expectCount, guardSecurityPolicy, pickGame } from "./support.ts";
import type { Page } from "@playwright/test";

guardSecurityPolicy();

/** The synthetic game with its career save, on the list. */
const loadCareer = async (page: Page) => {
  await page.goto("/");
  await pickGame(page, SYNTHETIC_DB_PATH);
  await page.getByLabel("Wybierz DATA.BIN i PARAM.SFO").setInputFiles([...SYNTHETIC_SAVE_PATHS]);
  await page.getByRole("button", { name: /^Pokaż zawodników/u }).click();
};

test.describe("career", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("prices players, sorts and filters by price and estimates the wage", async ({ page }) => {
    await loadCareer(page);
    // The list names the save's currency once, in the heading (the synthetic save: euro).
    const header = page.getByRole("columnheader", { name: /^Cena \(€\)/u });
    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await page.getByRole("button", { name: "Lionel Messi" }).click();
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    await expect(card.getByRole("term").filter({ hasText: /^Cena$/u })).toBeVisible();
    await expect(card.getByText(/ \(szacunek\)$/u)).toBeVisible();
    await page.keyboard.press("Escape");
    // The user's own player shows the wage stored in his contract, not the market's.
    await page.getByRole("button", { name: "Paweł Brożek" }).click();
    const own = page.getByRole("dialog", { name: "Paweł Brożek" });
    await expect(own.getByRole("term").filter({ hasText: /^Zarobki z kontraktu$/u })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByText("Kariera", { exact: true }).click();
    await page.getByRole("group", { name: "Cena", exact: true }).getByLabel("od").fill("1");
    await page
      .getByRole("group", { name: "Zarobki rynkowe (szacunek)" })
      .getByLabel("od")
      .fill("1");
    // A fifth of the generated players' contracts run out in 2009: their price is 0.
    await expectCount(page, "50 zawodników");
  });

  // The synthetic career has Messi on the game's shortlist.
  test("marks the players on the game's shortlist, filters by it and says so on the card", async ({
    page,
  }) => {
    await loadCareer(page);
    const messi = page.getByRole("button", { name: "Lionel Messi" });
    await expect(messi).toHaveAccessibleName("Lionel Messi obserwowany w grze");
    // Only he carries the mark, before his name, where a cut-off name cannot hide it.
    await expect(page.locator(".shortlist-mark")).toHaveCount(1);
    await expect(messi.locator(":scope > .shortlist-mark:first-child")).toBeVisible();
    await page.getByText("Kariera", { exact: true }).click();
    await page.getByLabel("Obserwowany w grze").selectOption("yes");
    await expectCount(page, "1\u00a0zawodnik");
    await messi.click();
    await expect(
      page
        .getByRole("dialog", { name: "Lionel Messi" })
        .getByText("Na twojej liście obserwowanych w grze"),
    ).toBeVisible();
  });
});

test.describe("career ratings", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("shows the average match rating with one decimal and filters by it", async ({ page }) => {
    await loadCareer(page);
    await page.getByText("Kariera", { exact: true }).click();
    await page.getByRole("group", { name: "Średnia ocena (KR)" }).getByLabel("od").fill("6.5");
    await expectCount(page, "1\u00a0zawodnik");
    await page.getByRole("button", { name: /^Lionel Messi/u }).click();
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    await expect(card.getByRole("definition").filter({ hasText: /^6,9$/u })).toBeVisible();
  });

  // The synthetic curves are flat, so the peak stays at today's OVR, below Messi's potential of 95.
  test("projects the peak OVR beside the potential and says when the potential is out of reach", async ({
    page,
  }) => {
    await loadCareer(page);
    await expect(page.getByRole("columnheader", { name: /^Szczyt OVR/u })).toBeHidden();
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    await expect(page.getByRole("columnheader", { name: /^Szczyt OVR/u })).toBeVisible();
    await page.getByRole("group", { name: "Szczyt OVR" }).getByLabel("od").fill("1");
    await page.getByRole("button", { name: /^Lionel Messi/u }).click();
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    await expect(card.getByRole("term").filter({ hasText: /^Szczyt OVR$/u })).toBeVisible();
    await expect(
      card.getByText(/Potencjału 95 zawodnik według niej nie osiągnie\.$/u),
    ).toBeVisible();
  });
});
