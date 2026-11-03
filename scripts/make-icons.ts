// Draws the PNG icons of the installable app from public/icon.svg with Playwright's Chromium, so they can be
// rebuilt after a change to the picture; the PNG files are committed.
//
// Usage: node scripts/make-icons.ts  (needs `pnpm exec playwright install chromium` once)
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const PUBLIC_DIR = path.join(import.meta.dirname, "..", "public");

/** Android and desktop take 192 and 512 from the manifest; iOS takes the 180 px apple-touch-icon. */
const ICONS = [
  { file: "icon-192.png", sizePx: 192 },
  { file: "icon-512.png", sizePx: 512 },
  { file: "apple-touch-icon.png", sizePx: 180 },
] as const;

const svg = readFileSync(path.join(PUBLIC_DIR, "icon.svg"), "utf8");
const browser = await chromium.launch();
try {
  await Promise.all(
    ICONS.map(async (icon) => {
      const page = await browser.newPage({
        viewport: { width: icon.sizePx, height: icon.sizePx },
      });
      await page.setContent(
        `<style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`,
      );
      await page.screenshot({ path: path.join(PUBLIC_DIR, icon.file) });
      await page.close();
      console.log(`${icon.file}: ${String(icon.sizePx)} px`);
    }),
  );
} finally {
  await browser.close();
}
