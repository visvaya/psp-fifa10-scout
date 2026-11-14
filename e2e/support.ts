// Shared steps of the browser tests: loading the synthetic game, reading the store, and the `test` every
// spec imports, which carries the security policy guard.
import { AxeBuilder } from "@axe-core/playwright";
import { test as base, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { SYNTHETIC_DB_PATH, SYNTHETIC_SAVE_PATHS } from "../scripts/write-synthetic-db.ts";

export { expect };

// The preview serves the production headers (public/_headers): every journey must run without breaking
// the security policy. The page reports what the browser blocks to the test process, so a report made
// before a reload or a navigation still counts.
export const test = base.extend<{ securityPolicy: undefined }>({
  securityPolicy: [
    async ({ page, javaScriptEnabled }, use, testInfo) => {
      const blocked: string[] = [];
      await page.exposeFunction("reportBlocked", (entry: string) => {
        blocked.push(entry);
      });
      await page.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (event) => {
          // WebKit reports the inline styles of a <select>'s own internal parts as blocked; the element
          // renders pixel for pixel the same with and without the policy (checked 2026-11-03).
          const webKitSelect =
            event.effectiveDirective === "style-src-attr" &&
            event.target instanceof HTMLSelectElement;
          const report: unknown = Reflect.get(window, "reportBlocked");
          if (!webKitSelect && typeof report === "function") {
            void Reflect.apply(report, window, [`${event.effectiveDirective} ${event.blockedURI}`]);
          }
        });
      });
      await use(undefined);
      // A skipped test opened no page to check.
      if (testInfo.status === "skipped") return;
      // A frame later the reports of the test's last action have reached the test process. A closed page,
      // or one without scripts (no frames run, and no report is sent), has nothing left to report.
      if (javaScriptEnabled && !page.isClosed()) {
        await page.evaluate(async () => new Promise(requestAnimationFrame));
      }
      expect(blocked).toEqual([]);
    },
    { auto: true },
  ],
});

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

/**
 * A stored record, read in the page from the app's IndexedDB store. It fails rather than hangs when the
 * store cannot be opened, and never creates it: an empty database would stop the app's own upgrade.
 */
export const readStored = async (key: string): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const open = indexedDB.open("psp-fifa10-scout");
    open.addEventListener("error", () => {
      reject(open.error ?? new Error("the store did not open"));
    });
    open.addEventListener("blocked", () => {
      reject(new Error("the store is blocked by another connection"));
    });
    open.addEventListener("upgradeneeded", () => {
      open.transaction?.abort();
      reject(new Error("the store is not created yet"));
    });
    open.addEventListener("success", () => {
      const read = open.result.transaction("kv");
      read.addEventListener("error", () => {
        reject(read.error ?? new Error("the record could not be read"));
      });
      const get = read.objectStore("kv").get(key);
      get.addEventListener("success", () => {
        // A connection left open can hold WebKit's store on an old state across a reload.
        open.result.close();
        resolve(get.result);
      });
    });
  });

/** The stored column choices as JSON, "{}" when there are none. */
export const storedColumns = async (page: Page): Promise<string> => {
  const stored = await page.evaluate(readStored, "preferences");
  const value: unknown = Reflect.get(Object(stored), "value");
  return JSON.stringify(Reflect.get(Object(value), "columns") ?? {});
};

/** Waits until the stored record under the key matches: a reload before the IndexedDB write commits
 * would restore the previous state (a fast CI runner reloads within that window). */
export const expectStored = async (page: Page, key: string, partial: Record<string, unknown>) => {
  await expect.poll(async () => page.evaluate(readStored, key)).toMatchObject(partial);
};

/** Waits until the stored preferences have no search text: a reload before that restores the old search. */
export const expectStoredSearchCleared = async (page: Page) => {
  await expect
    .poll(async () => {
      const stored = await page.evaluate(readStored, "preferences");
      return JSON.stringify(stored).includes('"text"');
    })
    .toBe(false);
};

/** Writes a record into the app's IndexedDB store, run in the page like `readStored`. */
export const writeStored = async ([key, value]: readonly [string, unknown]): Promise<void> =>
  new Promise((resolve, reject) => {
    // The same opening as readStored's: page.evaluate sends each function alone, so they cannot share it.
    /* jscpd:ignore-start */
    const open = indexedDB.open("psp-fifa10-scout");
    open.addEventListener("error", () => {
      reject(open.error ?? new Error("the store did not open"));
    });
    open.addEventListener("blocked", () => {
      reject(new Error("the store is blocked by another connection"));
    });
    open.addEventListener("upgradeneeded", () => {
      open.transaction?.abort();
      reject(new Error("the store is not created yet"));
    });
    /* jscpd:ignore-end */
    open.addEventListener("success", () => {
      const write = open.result.transaction("kv", "readwrite");
      write.addEventListener("abort", () => {
        reject(write.error ?? new Error("the record was not written"));
      });
      write.objectStore("kv").put(value, key);
      write.addEventListener("complete", () => {
        open.result.close();
        resolve();
      });
    });
  });

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

/** Opens the filter section of this exact title (a column or a field may share its words). */
export const openSection = async (scope: Page | Locator, title: string) => {
  await scope.locator("details.filter-section > summary").getByText(title, { exact: true }).click();
};

/** Opens every collapsed filter section. */
export const expandSections = async (page: Page) => {
  await page.locator("details.filter-section").evaluateAll((sections) => {
    for (const section of sections) section.setAttribute("open", "");
  });
  const sections = await page.locator("details.filter-section").count();
  await expect(page.locator(".filter-section-body")).toHaveCount(sections);
};

/** The synthetic game with its career save, on the list. */
export const loadCareer = async (page: Page) => {
  await page.goto("/");
  await pickGame(page, SYNTHETIC_DB_PATH);
  await page.getByLabel("Wybierz DATA.BIN i PARAM.SFO").setInputFiles([...SYNTHETIC_SAVE_PATHS]);
  await page.getByRole("button", { name: /^Pokaż zawodników/u }).click();
};

/** Neither the page nor the open dialog scrolls sideways. */
export const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => {
    const body = document.querySelector(".dialog-body");
    return [
      (document.scrollingElement?.scrollWidth ?? 0) - window.innerWidth,
      (body?.scrollWidth ?? 0) - (body?.clientWidth ?? 0),
    ];
  });
  expect(overflow).toEqual([0, 0]);
};

export const expectNoAxeViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
};

/** The horizontal scroll of an element; runs in the page. */
export const scrollLeftOf = (element: Element) => element.scrollLeft;

/** Scrolls an element to its right end; runs in the page. */
export const scrollToEnd = (element: Element) => {
  element.scrollTo(element.scrollWidth, 0);
};

/** The first row's cell in the column whose heading starts with the text. */
export const firstCellOf = async (page: Page, heading: string) => {
  const headings = await page.locator("thead th").allTextContents();
  // A sorted column's heading starts with its direction mark.
  const index = headings.findIndex((text) => text.replace(/^[▲▼]/u, "").startsWith(heading));
  expect(index).toBeGreaterThan(0);
  return page.locator("tbody tr[aria-rowindex]").first().locator("th, td").nth(index);
};

/** Phone: opens the filter dialog and returns it. */
export const openFilters = async (page: Page) => {
  await page.getByRole("button", { name: /^Filtry/u }).click();
  return page.getByRole("dialog", { name: "Filtry" });
};

/** Phone: filters by these attributes from 10 up through the filter dialog, a column for each. */
export const filterByAttributes = async (page: Page, ...labels: readonly string[]) => {
  const dialog = await openFilters(page);
  await dialog.getByText("Atrybuty", { exact: true }).click();
  for (const label of labels) {
    // One after another: each choice adds the field the next line fills.
    // oxlint-disable-next-line no-await-in-loop -- the steps depend on each other
    await dialog.getByLabel("Dodaj atrybut").selectOption({ label });
    // Exact: "Szybkość" would also name "Szybkość nauki" in the open development section.
    // oxlint-disable-next-line no-await-in-loop -- the steps depend on each other
    await dialog.getByRole("group", { name: label, exact: true }).getByLabel("od").fill("10");
  }
  await dialog.getByRole("button", { name: "Zamknij" }).click();
};

/**
 * Messi's card from the list on the narrowest phone with the potential shown and the text enlarged:
 * there the toolbar and the filters above once took the whole screen and left the list without rows.
 */
export const openCardEnlarged = async (page: Page) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await loadCareer(page);
  await showPotential(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  await page.getByRole("button", { name: /^Lionel Messi/u }).click();
};

/** Phone: shows the potential through the filter dialog. */
export const showPotential = async (page: Page) => {
  const dialog = await openFilters(page);
  await dialog.getByRole("checkbox", { name: "Pokaż potencjał" }).check();
  await dialog.getByRole("button", { name: "Zamknij" }).click();
};

/**
 * The value a player card shows for a label; a space in the label also matches a non-breaking one. A
 * label with an explanation is followed by its "?" and the explanation's hidden text.
 */
export const cardValue = (card: Locator, label: string) => {
  // The label is literal text: "(KR)" or "(€)" must not turn into regex groups.
  const literal = label.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return card
    .locator(".facts > div")
    .filter({
      has: card
        .page()
        .getByRole("term")
        .filter({
          hasText: new RegExp(`^${literal.replaceAll(" ", String.raw`\s`)}(?:\\?[\\s\\S]*)?$`, "u"),
        }),
    })
    .getByRole("definition");
};

/** "Resetuj" in the filter panel's bottom bar, then the same button again to confirm the question. */
export const resetSettings = async (page: Page) => {
  const bar = page.locator(".reset-filters");
  await bar.getByRole("button", { name: "Resetuj" }).click();
  await bar.getByRole("button", { name: "Resetuj" }).click();
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
