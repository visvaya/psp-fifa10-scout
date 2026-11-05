// Takes the sample screenshots of the start page (public/screenshots/*.webp) from the synthetic database,
// so no game data is ever shown. Run by hand when the interface changes; the WebP files are committed.
//
// Usage: pnpm build && pnpm make:screenshots  (needs `pnpm exec playwright install chromium` once)
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { preview } from "vite";
import { buildScoutDb } from "../src/logic/test-support/scout-db.ts";

const OUTPUT_DIR = path.join(import.meta.dirname, "..", "public", "screenshots");
const PORT = 4199;
const WEBP_QUALITY_RATIO = 0.8;
const PHONE_SCALE = 2;

interface Shot {
  readonly file: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly phone: boolean;
  /** Brings the page to what the screenshot shows, once the synthetic game is loaded. */
  readonly arrange: (page: Page) => Promise<void>;
}

/** Midfielders only: the filter keeps the few real names of the synthetic game out of the pictures. */
const MIDFIELD_GROUPS = ["Środkowy pomocnik", "Ofensywny pomocnik"] as const;

const checkGroups = async (scope: Page | Locator): Promise<void> => {
  for (const name of MIDFIELD_GROUPS) {
    // oxlint-disable-next-line no-await-in-loop -- one box after another, as a person would
    await scope.getByRole("checkbox", { name }).check();
  }
};

const SHOTS: readonly Shot[] = [
  {
    file: "list-wide.webp",
    viewport: { width: 1280, height: 800 },
    phone: false,
    arrange: checkGroups,
  },
  {
    file: "card-wide.webp",
    viewport: { width: 1280, height: 800 },
    phone: false,
    arrange: async (page) => {
      await checkGroups(page);
      await page.getByRole("button", { name: /^Gracz Numer 6/u }).click();
    },
  },
  {
    file: "list-phone.webp",
    viewport: { width: 390, height: 844 },
    phone: true,
    arrange: async (page) => {
      await page.getByRole("button", { name: "Filtry" }).click();
      const dialog = page.getByRole("dialog", { name: "Filtry" });
      await checkGroups(dialog);
      await dialog.getByRole("button", { name: "Zamknij" }).click();
      // The button that opened the dialog gets the focus back; its ring is not part of the picture.
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
    },
  },
];

/**
 * Re-encodes a PNG as WebP in the browser, the one encoder the project already depends on. Runs in a blank page:
 * the app's own pages forbid fetching data: URLs.
 */
const toWebp = async (page: Page, png: Buffer): Promise<Buffer> => {
  const base64 = await page.evaluate(
    async ([data, quality]) => {
      const bitmap = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${data}`)).blob(),
      );
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
      const blob = await canvas.convertToBlob({ type: "image/webp", quality });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return btoa(bytes.reduce((text, byte) => text + String.fromCharCode(byte), ""));
    },
    [png.toString("base64"), WEBP_QUALITY_RATIO] as const,
  );
  return Buffer.from(base64, "base64");
};

const shoot = async (
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  baseUrl: string,
  shot: Shot,
  encoder: Page,
): Promise<void> => {
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: shot.phone ? PHONE_SCALE : 1,
    hasTouch: shot.phone,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.goto(baseUrl);
  const input = page.getByLabel("Wybierz obraz ISO lub fifa.db");
  await input.waitFor({ state: "attached" });
  await page.waitForFunction(
    () => document.querySelector<HTMLInputElement>("#game-file")?.disabled === false,
  );
  await input.setInputFiles({
    name: "fifa.db",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(buildScoutDb()),
  });
  await page.getByRole("button", { name: /^Pokaż zawodników/u }).click();
  await page.getByRole("table").or(page.locator(".phone-list")).first().waitFor();
  await shot.arrange(page);
  const png = await page.screenshot();
  const webp = await toWebp(encoder, png);
  writeFileSync(path.join(OUTPUT_DIR, shot.file), webp);
  console.log(`${shot.file}: ${String(webp.length)} bytes`);
  await context.close();
};

mkdirSync(OUTPUT_DIR, { recursive: true });
const server = await preview({ preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch();
const encoder = await browser.newPage();
try {
  const baseUrl = `http://localhost:${String(PORT)}/`;
  for (const shot of SHOTS) {
    // One after another: the machine running this is often busy.
    // oxlint-disable-next-line no-await-in-loop -- each shot needs the browser to itself
    await shoot(browser, baseUrl, shot, encoder);
  }
} finally {
  await browser.close();
  await server.close();
}
