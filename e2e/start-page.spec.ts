import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, loadDatabase, PHONE, test } from "./support.ts";

/**
 * The description of the tool and its sample screenshots on the start screen (index.html holds the text;
 * the app moves it onto the start screen).
 */

const ABOUT_HEADING = "O narzędziu";
const SCREENSHOTS = 3;

const aboutHeading = (page: Page) => page.getByRole("heading", { name: ABOUT_HEADING });

/** Scrolls every screenshot into view and waits until the browser has loaded it. */
const loadScreenshots = async (page: Page) => {
  const images = page.locator("#about img");
  for (let index = 0; index < SCREENSHOTS; index += 1) {
    // One after another: a lazy image loads when it nears the viewport.
    // oxlint-disable-next-line no-await-in-loop -- each picture waits for its own scroll
    await images.nth(index).scrollIntoViewIfNeeded();
    // oxlint-disable-next-line no-await-in-loop -- each picture waits for its own scroll
    await expect
      .poll(() => images.nth(index).evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  }
};

/** Every URL kept in the page's cache storage; runs in the page. */
const storedUrls = async (): Promise<string[]> => {
  const names = await caches.keys();
  const requests = await Promise.all(names.map(async (name) => (await caches.open(name)).keys()));
  return requests.flat().map((request) => request.url);
};

test.describe("start screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("describes the tool with captioned screenshots and no axe violations", async ({ page }) => {
    await page.goto("/");
    await expect(aboutHeading(page)).toBeVisible();
    await expect(page.getByText("Pliki nie opuszczają urządzenia")).toBeVisible();
    await expect(page.getByText("nie jest związany z Electronic Arts")).toBeVisible();
    const images = page.getByRole("img", { name: /\S/u });
    await expect(images).toHaveCount(SCREENSHOTS);
    await expect(page.getByText("(przykładowe dane)")).toHaveCount(SCREENSHOTS);
    await loadScreenshots(page);
    await expectNoAxeViolations(page);
  });

  test("keeps the description off the list and shows it once on the start screen", async ({
    page,
  }) => {
    await loadDatabase(page);
    await expect(page.locator("#about")).toHaveCount(0);
    await page.getByRole("button", { name: "Pliki" }).click();
    await expect(aboutHeading(page)).toBeVisible();
    await expect(page.locator("#about")).toHaveCount(1);
  });

  test("keeps the screenshots out of the offline storage", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // The worker takes no page it did not load: after a reload the screenshots go through it.
    await page.reload();
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await loadScreenshots(page);
    const stored = await page.evaluate(storedUrls);
    expect(stored.some((url) => url.endsWith("/"))).toBe(true);
    expect(stored.filter((url) => url.includes("/screenshots/"))).toEqual([]);
  });
});

test.describe("phone", () => {
  test.use(PHONE);

  test("fits the description to the screen width", async ({ page }) => {
    await page.goto("/");
    await expect(aboutHeading(page)).toBeVisible();
    await loadScreenshots(page);
    const start = page.locator("div.start");
    expect(await start.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  });
});

// A crawler that does not run scripts reads the text from the page itself.
test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the description is in the page", async ({ page }) => {
    await page.goto("/");
    await expect(aboutHeading(page)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Najczęstsze pytania" })).toBeVisible();
  });
});
