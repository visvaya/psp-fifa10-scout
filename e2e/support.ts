// Shared steps of the browser tests: loading the synthetic game, reading the store, and the security
// policy guard every spec registers.
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { SYNTHETIC_DB_PATH } from "../scripts/write-synthetic-db.ts";

/** The phone the phone specs use. */
export const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true } as const;

/** Picks a game file once the input is enabled: setInputFiles also fills a disabled input, and a pick
 * made before the app opens its worker is lost (a user cannot pick there). */
export const pickGame = async (page: Page, files: Parameters<Locator["setInputFiles"]>[0]) => {
  const input = page.getByLabel("Wybierz obraz ISO lub fifa.db");
  await expect(input).toBeEnabled();
  await input.setInputFiles(files);
};

export const loadDatabase = async (page: Page) => {
  await page.goto("/");
  await pickGame(page, SYNTHETIC_DB_PATH);
  // A picked game stays on the start screen, so a save or language can follow. The button counts the
  // players the list shows (no legends), with a thousands separator.
  await page.getByRole("button", { name: "Pokaż zawodników (62)" }).click();
  await expectCount(page, "62\u00a0zawodników");
};

/** A stored record, read in the page from the app's IndexedDB store. */
export const readStored = async (key: string): Promise<unknown> =>
  new Promise((resolve) => {
    const open = indexedDB.open("psp-fifa10-scout");
    open.addEventListener("success", () => {
      const get = open.result.transaction("kv").objectStore("kv").get(key);
      get.addEventListener("success", () => {
        // A connection left open can hold WebKit's store on an old state across a reload.
        open.result.close();
        resolve(get.result);
      });
    });
  });

/** Waits until the stored preferences include a position group: a reload before the IndexedDB write
 * commits would restore the previous filters (a fast CI runner reloads within that window). */
export const expectStoredPositionGroup = async (page: Page, group: string) => {
  await expect
    .poll(async () => page.evaluate(readStored, "preferences"))
    .toMatchObject({ value: { filters: { lists: { positionGroup: [group] } } } });
};

/** The horizontal centre of an element, NaN when it is not shown. */
export const centre = async (locator: Locator): Promise<number> => {
  const box = await locator.boundingBox();
  return box === null ? Number.NaN : box.x + box.width / 2;
};

/** The widths of the table's header cells. */
export const headerWidths = async (page: Page): Promise<number[]> =>
  page
    .locator("table.players thead th")
    .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().width));

export const expectCount = async (page: Page, text: string) => {
  await expect(page.locator("p.count")).toHaveText(text);
};

/** Opens every collapsed filter section. */
export const expandSections = async (page: Page) => {
  await page.locator("details.filter-section").evaluateAll((sections) => {
    for (const section of sections) section.setAttribute("open", "");
  });
  const sections = await page.locator("details.filter-section").count();
  await expect(page.locator(".filter-section-body")).toHaveCount(sections);
};

export const expectNoAxeViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
};

// The preview serves the production headers (public/_headers): every journey must run without breaking
// the security policy. Records what the browser blocks on the last page the test opened.
export const guardSecurityPolicy = (): void => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const blocked: string[] = [];
      Reflect.set(window, "cspViolations", blocked);
      document.addEventListener("securitypolicyviolation", (event) => {
        // WebKit reports the inline styles of a <select>'s own internal parts as blocked; the element
        // renders pixel for pixel the same with and without the policy (checked 2026-11-03).
        const webKitSelect =
          event.effectiveDirective === "style-src-attr" &&
          event.target instanceof HTMLSelectElement;
        if (!webKitSelect) blocked.push(`${event.effectiveDirective} ${event.blockedURI}`);
      });
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // A skipped test opened no page to check.
    if (testInfo.status === "skipped") return;
    expect(await page.evaluate((): unknown => Reflect.get(window, "cspViolations"))).toEqual([]);
  });
};

/** Phone: filters by these attributes from 10 up through the filter dialog, a column for each. */
export const filterByAttributes = async (page: Page, ...labels: readonly string[]) => {
  await page.getByRole("button", { name: "Filtry" }).click();
  const dialog = page.getByRole("dialog", { name: "Filtry" });
  await dialog.getByText("Atrybuty", { exact: true }).click();
  for (const label of labels) {
    // One after another: each choice adds the field the next line fills.
    // oxlint-disable-next-line no-await-in-loop -- the steps depend on each other
    await dialog.getByLabel("Dodaj atrybut").selectOption({ label });
    // oxlint-disable-next-line no-await-in-loop -- the steps depend on each other
    await dialog.getByRole("group", { name: label }).getByLabel("od").fill("10");
  }
  await dialog.getByRole("button", { name: "Zamknij" }).click();
};

/** Phone: shows the potential through the filter dialog. */
export const showPotential = async (page: Page) => {
  await page.getByRole("button", { name: "Filtry" }).click();
  await page.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
  await page.getByRole("button", { name: "Zamknij" }).click();
};

/** The value a player card shows for a label; a space in the label also matches a non-breaking one. */
export const cardValue = (card: Locator, label: string) => {
  // The label is literal text: "(KR)" or "(€)" must not turn into regex groups.
  const literal = label.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return card
    .locator(".facts > div")
    .filter({
      has: card
        .page()
        .getByRole("term")
        .filter({ hasText: new RegExp(`^${literal.replaceAll(" ", String.raw`\s`)}$`, "u") }),
    })
    .getByRole("definition");
};

/**
 * Where the fade at the right edge of the phone list starts on screen: the header's visible right edge (a
 * scrollbar gutter left out) less the fade's rendered width.
 */
export const fadeStart = async (page: Page): Promise<number> =>
  page.locator(".player-rows-header").evaluate((header) => {
    const list = header.closest(".phone-list");
    if (!(header instanceof HTMLElement) || list === null) return Number.NEGATIVE_INFINITY;
    const fade = Number.parseFloat(getComputedStyle(list, "::after").width);
    return header.getBoundingClientRect().left + header.clientWidth - fade;
  });
