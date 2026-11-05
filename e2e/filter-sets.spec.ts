import { expect, test } from "@playwright/test";
import { expectCount, guardSecurityPolicy, loadDatabase } from "./support.ts";

guardSecurityPolicy();

test.describe("filter sets", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // Save the filters and sort under a name, clear them, load them back; the set survives a reload.
  test("saves, loads, renames and deletes a named set of filters", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("checkbox", { name: "Bramkarz" }).check();
    await page.getByRole("button", { name: /^Wiek/u }).click();
    // The list counts again after a moment (a deferred value): wait for the filtered count.
    await expect(page.locator(".count")).not.toHaveText(/^62\u00a0/u);
    const shown = (await page.locator(".count").textContent()) ?? "";
    await page.getByText("Zapisane zestawy", { exact: true }).click();
    await page.getByLabel("Nazwa zestawu").fill("Bramkarze");
    await page.getByRole("button", { name: "Zapisz bieżące filtry" }).click();
    await page.getByRole("button", { name: "Wyczyść filtry" }).click();
    await expectCount(page, "62 zawodników");
    await page.reload();
    await page.getByText("Zapisane zestawy", { exact: true }).click();
    await page.getByRole("button", { name: "Wczytaj zestaw „Bramkarze”" }).click();
    await expect(page.getByRole("checkbox", { name: "Bramkarz" })).toBeChecked();
    await expect(page.locator(".count")).toHaveText(shown);
    await expect(page.getByRole("columnheader", { name: /^Wiek/u })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    // A taken name overwrites; renaming and deleting act on the named set.
    await page.getByLabel("Nazwa zestawu").fill("Bramkarze");
    await expect(page.getByRole("button", { name: "Nadpisz zestaw", exact: true })).toBeVisible();
    await page.getByLabel("Nazwa zestawu").fill("");
    await page.getByRole("button", { name: "Zmień nazwę zestaw „Bramkarze”" }).click();
    // The editor takes the focus; an empty name is refused with the reason, the editor stays open.
    const newName = page.getByLabel("Nowa nazwa zestawu „Bramkarze”");
    await expect(newName).toBeFocused();
    await newName.fill(" ");
    await page.getByRole("button", { name: "Zapisz nazwę zestaw „Bramkarze”" }).click();
    await expect(page.getByRole("alert")).toHaveText("Wpisz nazwę zestawu.");
    await expect(newName).toBeFocused();
    await newName.fill("Na bramkę");
    await expect(page.getByRole("alert")).toBeHidden();
    await expect(newName).not.toHaveAttribute("aria-invalid", "true");
    await page.getByRole("button", { name: "Zapisz nazwę zestaw „Bramkarze”" }).click();
    await expect(
      page.getByRole("button", { name: "Zmień nazwę zestaw „Na bramkę”" }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Usuń zestaw „Na bramkę”" }).click();
    await expect(page.getByText("Brak zapisanych zestawów", { exact: false })).toBeVisible();
  });
});

test.describe("filter set overwrite", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // A set takes the current filters only after the question; either answer gives the focus back.
  test("overwrites a saved set with the current filters after asking", async ({ page }) => {
    await loadDatabase(page);
    await page.getByRole("checkbox", { name: "Bramkarz" }).check();
    await page.getByText("Zapisane zestawy", { exact: true }).click();
    await page.getByLabel("Nazwa zestawu").fill("Moi");
    await page.getByRole("button", { name: "Zapisz bieżące filtry" }).click();
    await page.getByRole("checkbox", { name: "Bramkarz" }).uncheck();
    await page.getByRole("checkbox", { name: "Napastnik" }).check();
    const overwrite = page.getByRole("button", { name: "Nadpisz zestaw „Moi”" });
    await overwrite.click();
    await expect(
      page.getByText("Zastąpić filtry i sortowanie zestawu „Moi” bieżącymi?"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Anuluj zestaw „Moi”" }).click();
    await expect(overwrite).toBeFocused();
    await overwrite.click();
    const confirm = page.getByRole("button", { name: "Nadpisz zestaw „Moi”" });
    await expect(confirm).toBeFocused();
    await confirm.click();
    await expect(overwrite).toBeFocused();
    await page.getByRole("button", { name: "Wyczyść filtry" }).click();
    await page.getByRole("button", { name: "Wczytaj zestaw „Moi”" }).click();
    await expect(page.getByRole("checkbox", { name: "Napastnik" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Bramkarz" })).not.toBeChecked();
  });
});
