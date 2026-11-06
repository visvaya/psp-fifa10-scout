import type { Page } from "@playwright/test";
import { buildFileList, buildParamSfo } from "../src/data/test-support/synthetic-save.ts";
import { SYNTHETIC_SAVE_PATHS } from "../scripts/write-synthetic-db.ts";
import {
  cardValue,
  expect,
  expectCount,
  expectStored,
  loadCareer,
  readStored,
  test,
} from "./support.ts";

/** An encrypted save whose DATA.BIN was copied only in part: its length is no whole cipher block. */
const cutSave = () => {
  const params = new Uint8Array(128);
  params[0] = 0x41;
  const paramSfo = buildParamSfo([
    { key: "SAVEDATA_FILE_LIST", value: buildFileList("DATA.BIN", new Uint8Array(16)) },
    { key: "SAVEDATA_PARAMS", value: params },
  ]);
  return [
    { name: "DATA.BIN", mimeType: "application/octet-stream", buffer: Buffer.alloc(100) },
    { name: "PARAM.SFO", mimeType: "application/octet-stream", buffer: Buffer.from(paramSfo) },
  ];
};

/** Whether the store holds a career save, not none and not an erased one. */
const storesCareerSave = async (page: Page): Promise<boolean> => {
  const stored = await page.evaluate(readStored, "careerSave");
  const value: unknown = Reflect.get(Object(stored), "value");
  return value !== null && value !== undefined;
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
    // The user's own player shows the wage stored in his contract, not the market's. Found by name: the
    // list renders only the rows near the screen.
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("brozek");
    await page.getByRole("button", { name: "Paweł Brożek" }).click();
    const own = page.getByRole("dialog", { name: "Paweł Brożek" });
    await expect(
      own.getByRole("term").filter({ hasText: /^Zarobki z\skontraktu$/u }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    // The card must be gone before the search is cleared, or the clearing can be lost (seen in CI).
    await expect(own).toBeHidden();
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("");
    await expectCount(page, "62 zawodników");
    await page.getByText("Kariera", { exact: true }).click();
    await page.getByRole("group", { name: "Cena (€)", exact: true }).getByLabel("od").fill("1");
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
    await expect(messi).toHaveAccessibleName("Lionel Messi na liście życzeń w grze");
    // Only he carries the mark, before his name, where a cut-off name cannot hide it.
    await expect(page.locator(".shortlist-mark")).toHaveCount(1);
    await expect(messi.locator(":scope > .shortlist-mark:first-child")).toBeVisible();
    await page.getByText("Kariera", { exact: true }).click();
    await page.getByLabel("Na liście życzeń w grze").selectOption("yes");
    await expectCount(page, "1\u00a0zawodnik");
    await messi.click();
    await expect(
      page
        .getByRole("dialog", { name: "Lionel Messi" })
        .getByText("Na twojej liście życzeń w grze"),
    ).toBeVisible();
  });
});

test.describe("career ratings", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("shows the average match rating with one decimal and filters by it", async ({ page }) => {
    await loadCareer(page);
    await page.getByText("Kariera", { exact: true }).click();
    const ratingFrom = page.getByRole("group", { name: "Średnia ocena (KR)" }).getByLabel("od");
    // A dot typed inside the number becomes a comma and the caret stays after it.
    await ratingFrom.pressSequentially("75");
    await ratingFrom.press("ArrowLeft");
    await ratingFrom.pressSequentially(".2");
    await expect(ratingFrom).toHaveValue("7,25");
    await ratingFrom.fill("");
    // A typed dot turns into the Polish decimal comma at once.
    await ratingFrom.pressSequentially("6.5");
    await expect(ratingFrom).toHaveValue("6,5");
    await expectCount(page, "1\u00a0zawodnik");
    await page.getByRole("button", { name: /^Lionel Messi/u }).click();
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    await expect(card.getByRole("definition").filter({ hasText: /^6,9$/u })).toBeVisible();
  });

  // The save keeps league and cup games apart; the card and the filters show both.
  test("shows league and cup games apart and filters by the cup ones", async ({ page }) => {
    await loadCareer(page);
    await page.getByText("Kariera", { exact: true }).click();
    await page.getByRole("group", { name: "Występy w pucharach" }).getByLabel("od").fill("1");
    await expectCount(page, "1 zawodnik");
    await page.getByRole("button", { name: /^Lionel Messi/u }).click();
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    await expect(cardValue(card, "Występy w lidze")).toHaveText("5");
    await expect(cardValue(card, "Występy w pucharach")).toHaveText("3");
    await expect(cardValue(card, "Gole w pucharach")).toHaveText("1");
    await expect(cardValue(card, "Asysty w pucharach")).toHaveText("1");
    // Clean sheets only for goalkeepers, as the game counts them.
    await expect(card.getByText(/^Czyste konta/u)).toHaveCount(0);
  });

  test("shows a goalkeeper's clean sheets and filters by them", async ({ page }) => {
    await loadCareer(page);
    await page.getByText("Kariera", { exact: true }).click();
    await page.getByRole("group", { name: "Czyste konta w lidze" }).getByLabel("od").fill("1");
    await expectCount(page, "1 zawodnik");
    await page.getByRole("button", { name: "Gracz Numer 1", exact: true }).click();
    const card = page.getByRole("dialog", { name: "Gracz Numer 1" });
    await expect(cardValue(card, "Czyste konta w lidze")).toHaveText("2");
    await expect(cardValue(card, "Czyste konta w pucharach")).toHaveText("1");
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
    // Flat curves: no one grows past today's OVR.
    const room = page.getByRole("group", { name: "Zapas do szczytu" });
    await room.getByLabel("do", { exact: true }).fill("0");
    await page.getByRole("button", { name: /^Lionel Messi/u }).click();
    const card = page.getByRole("dialog", { name: "Lionel Messi" });
    await expect(card.getByRole("term").filter({ hasText: /^Szczyt OVR$/u })).toBeVisible();
    await expect(cardValue(card, "Zapas do szczytu")).toHaveText("0");
    await expect(
      card.getByText(/Potencjału 95\szawodnik według niej nie osiągnie\.$/u),
    ).toBeVisible();
  });
});

test.describe("peak at a chosen position", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("ranges and sorts by the peak at a chosen position while potential shows", async ({
    page,
  }) => {
    await loadCareer(page);
    const rating = page.getByRole("group", { name: "Ocena na pozycji" });
    await rating
      .getByRole("combobox", { name: "Ocena na pozycji" })
      .selectOption({ label: "Boczny obrońca (RB/LB)" });
    const peakRange = rating.getByRole("group", { name: "Szczyt RB/LB" });
    const header = page.getByRole("columnheader", { name: /^Szczyt RB\/LB/u });
    await expect(peakRange).toHaveCount(0);
    await expect(header).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await peakRange.getByLabel("od").fill("99");
    await expect(page.getByText("Żaden zawodnik nie spełnia filtrów.")).toBeVisible();
    await expect(page.getByText(/RB\/LB, szczyt od\s99/u).first()).toBeVisible();
    // Hiding potential drops the peak's range and sort, and keeps the position.
    await page.getByRole("checkbox", { name: "Pokaż potencjał" }).uncheck();
    await expect(peakRange).toHaveCount(0);
    await expect(page.getByText("Żaden zawodnik nie spełnia filtrów.")).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: /^OVR RB\/LB/u })).toBeVisible();
  });
});

test.describe("bad career save", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("explains a missing or damaged save and keeps the career loaded and stored before", async ({
    page,
  }) => {
    await loadCareer(page);
    await expect.poll(async () => storesCareerSave(page)).toBe(true);
    await page.getByRole("button", { name: "Pliki" }).click();
    const summary = page.getByText(/^Kariera: Anna Kariera/u);
    await expect(summary).toBeVisible();
    const saveInput = page.getByLabel("Wybierz DATA.BIN i PARAM.SFO");
    const alert = page.getByRole("alert");
    await saveInput.setInputFiles(SYNTHETIC_SAVE_PATHS[0]);
    await expect(alert).toContainText("Wybierz oba pliki naraz");
    await saveInput.setInputFiles(cutSave());
    await expect(alert).toContainText("Plik jest uszkodzony albo niepełny");
    // The career loaded before stays, and the list opens with every player and the career's prices.
    await expect(summary).toBeVisible();
    await page.getByRole("button", { name: "Pokaż zawodników (62)" }).click();
    await expectCount(page, "62 zawodników");
    await expect(page.getByRole("columnheader", { name: /^Cena \(€\)/u })).toBeVisible();
    // A filter stored after the bad pick: the store has also taken whatever the bad pick wrote.
    await page.getByRole("checkbox", { name: "Bramkarz" }).check();
    await expectStored(page, "preferences", {
      value: { filters: { lists: { positionGroup: ["goalkeeper"] } } },
    });
    expect(await storesCareerSave(page)).toBe(true);
    await page.reload();
    await expect(page.getByRole("table")).toBeVisible();
    await page.getByRole("button", { name: "Pliki" }).click();
    await expect(summary).toBeVisible();
  });
});
