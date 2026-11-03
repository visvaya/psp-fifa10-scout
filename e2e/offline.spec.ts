import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { cp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

/**
 * The installable, offline app: the service worker (scripts/service-worker-template.js) and the manifest.
 * The worker's life cycle across releases is checked without a browser in its unit tests; this file proves
 * that a real browser installs it, starts the app from it with no network, and offers a new release.
 */

const GAME_INPUT = "Wybierz obraz ISO lub fifa.db";
const BUILD_STEP = "scripts/write-service-worker.ts";
/** The copy of the build in the update test is served under a sub-path, as on GitHub Pages. */
const SUB_PATH = "/scout/";

/** Resolves once this release is stored in full and its worker is active. */
const offlineReady = (page: Page) =>
  page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

test("after one visit the app starts without a network", async ({ page, context }) => {
  await page.goto("/");
  await offlineReady(page);

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole("heading", { name: "PSP FIFA 10 Scout" })).toBeVisible();
  // Enabled once the stored data and the scout worker (a script of its own) have started.
  await expect(page.getByLabel(GAME_INPUT)).toBeEnabled();
});

test("the app is installable", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "only Chromium reports what keeps a page from installing");
  await page.goto("/");
  await offlineReady(page);
  const session = await page.context().newCDPSession(page);
  const { installabilityErrors } = await session.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);
});

const NEXT_RELEASE_MARK = '<meta name="e2e-release" content="next" />';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

/**
 * A copy of the built app under a sub-path on a server of its own, so a test can put a new release on it
 * without touching the server the other tests share.
 */
const serveCopyOfBuild = async () => {
  // The test's own output directory, which Playwright empties before the next run.
  const root = test.info().outputPath("release");
  await cp("dist", root, { recursive: true });
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    const relative = pathname.startsWith(SUB_PATH) ? pathname.slice(SUB_PATH.length) : null;
    const file =
      relative === null
        ? null
        : path.join(root, path.normalize(relative === "" ? "index.html" : relative));
    if (file === null) {
      response.writeHead(404).end();
      return;
    }
    readFile(file).then(
      (body) => {
        const type = CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream";
        response.writeHead(200, { "Content-Type": type }).end(body);
      },
      () => {
        response.writeHead(404).end();
      },
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "localhost", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("the server has no port");
  const { port } = address;
  return {
    url: `http://localhost:${String(port)}${SUB_PATH}`,
    /** The next release: a start page that says so, and the worker the build makes for it. */
    release: async () => {
      const startPage = path.join(root, "index.html");
      const html = await readFile(startPage, "utf8");
      await writeFile(startPage, html.replace("</head>", `${NEXT_RELEASE_MARK}</head>`));
      execFileSync(process.execPath, [BUILD_STEP, root]);
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
};

test("a new release is offered and installs on request, under a sub-path", async ({
  page,
  context,
}) => {
  const host = await serveCopyOfBuild();
  try {
    await page.goto(host.url);
    await offlineReady(page);
    // A page of the release, as on every start after the first: with no page of its own the running
    // release lets a new one take over at once instead of waiting.
    await page.reload();
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    await host.release();
    // The browser looks for a new worker on navigations; an open page asks for one here.
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update();
    });
    const prompt = page.getByRole("status").filter({ hasText: "Dostępna jest nowa wersja." });
    await expect(prompt).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
    await expect(page.locator('meta[name="e2e-release"]')).toHaveCount(0);

    // With no network the page after the reload can only come from the new release's own cache.
    await context.setOffline(true);
    await prompt.getByRole("button", { name: "Odśwież" }).click();
    await expect(page.locator('meta[name="e2e-release"]')).toHaveCount(1);
    await expect(page.getByLabel(GAME_INPUT)).toBeEnabled();
    await expect(prompt).toBeHidden();
  } finally {
    await host.close();
  }
});
