import { expect, test } from "@playwright/test";
import { guardSecurityPolicy, loadDatabase } from "./support.ts";

guardSecurityPolicy();

type Damage = "open" | "read" | "write";

/** What each kind of damage does to IndexedDB, as the page sees it. */
const DAMAGES: readonly (readonly [Damage, string])[] = [
  ["open", "cannot be opened"],
  ["read", "cannot be read"],
  // The store opens and reads, so only the saves fail, as when the disk is full.
  ["write", "cannot be written"],
];

for (const [damage, title] of DAMAGES) {
  test(`a store that ${title} says so and the list still works`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((kind: Damage) => {
      // oxlint-disable-next-line typescript/unbound-method -- called below with the database as this
      const { transaction } = IDBDatabase.prototype;
      if (kind === "open") {
        IDBFactory.prototype.open = () => {
          throw new DOMException("The store is damaged", "UnknownError");
        };
      }
      IDBDatabase.prototype.transaction = function (
        this: IDBDatabase,
        ...args: Parameters<IDBDatabase["transaction"]>
      ) {
        if (kind === "read" || (kind === "write" && args[1] === "readwrite")) {
          throw new DOMException(
            "The store is damaged",
            kind === "write" ? "QuotaExceededError" : "InvalidStateError",
          );
        }
        return transaction.apply(this, args);
      };
    }, damage);

    await loadDatabase(page);
    await expect(page.getByText(/Nie udało się użyć pamięci przeglądarki/u)).toBeVisible();
    // The filter change is saved on its own; that save may fail too.
    await page.getByRole("searchbox", { name: "Nazwisko" }).fill("messi");
    await expect(page.locator("p.count")).toHaveText("1\u00a0zawodnik");
    expect(errors).toEqual([]);
  });
}
