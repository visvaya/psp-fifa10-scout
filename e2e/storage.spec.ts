import { expect, test } from "@playwright/test";
import { loadDatabase, guardSecurityPolicy } from "./support.ts";

guardSecurityPolicy();

test("a store that cannot be read says so and the list still works", async ({ page }) => {
  // IndexedDB opens but every transaction fails, as in a damaged profile.
  await page.addInitScript(() => {
    IDBDatabase.prototype.transaction = () => {
      throw new DOMException("The database is damaged", "InvalidStateError");
    };
  });
  const rejections: string[] = [];
  page.on("pageerror", (error) => rejections.push(error.message));

  await page.goto("/");
  await expect(page.getByText(/Nie udało się użyć pamięci przeglądarki/u)).toBeVisible();
  await loadDatabase(page);
  // The filter change is saved on its own; its failure raises no error either.
  await page.getByRole("searchbox", { name: "Nazwisko" }).fill("messi");
  await expect(page.locator("p.count")).toHaveText("1\u00a0zawodnik");
  expect(rejections).toEqual([]);
});
