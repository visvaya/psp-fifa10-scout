// One field's filter cleared at once, the others kept.
import { expect, expectCount, loadDatabase, test } from "./support.ts";

test.describe("clearing one field", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("clears all chosen positions, or a range, with one button", async ({ page }) => {
    await loadDatabase(page);
    const positions = page.getByRole("group", { name: "Pozycje", exact: true });
    const clearPositions = page.getByRole("button", { name: "Wyczyść: Pozycje" });
    // The button shows only while the field filters.
    await expect(clearPositions).toBeHidden();
    await positions.getByRole("checkbox", { name: "Bramkarz" }).check();
    await positions.getByRole("checkbox", { name: "Napastnik" }).check();
    const age = page.getByRole("group", { name: "Wiek", exact: true });
    await age.getByLabel("do").fill("25");
    await expect(page.locator(".count")).not.toHaveText(/^62\s/u);
    await clearPositions.click();
    await expect(positions.getByRole("checkbox", { checked: true })).toHaveCount(0);
    // The button leaves with the filter; the keyboard stays in the field, on its first value.
    await expect(positions.getByRole("checkbox", { name: "Bramkarz" })).toBeFocused();
    await expect(age.getByLabel("do")).toHaveValue("25");
    await page.getByRole("button", { name: "Wyczyść: Wiek" }).click();
    await expect(age.getByLabel("do")).toHaveValue("");
    await expectCount(page, "62 zawodników");
  });
});

test.describe("clear button under the header", () => {
  // Scrolled under the panel's header, a field's clear button stays behind it (owner, 2026-11-05).
  test("keeps a field's clear button under the panel's header", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDatabase(page);
    await page.getByRole("button", { name: "Filtry" }).click();
    const dialog = page.getByRole("dialog", { name: "Filtry" });
    await dialog
      .getByRole("group", { name: "Pozycje", exact: true })
      .getByRole("checkbox", { name: "Napastnik" })
      .check();
    const clear = dialog.getByRole("button", { name: "Wyczyść: Pozycje" });
    // Scroll the panel so the button sits right under the header's middle, then see what is on top there.
    const result = await clear.evaluate((button) => {
      const header = button.closest(".dialog")?.querySelector(".dialog-header");
      let scroller = button.parentElement;
      while (
        scroller !== null &&
        !(
          scroller.scrollHeight > scroller.clientHeight &&
          /auto|scroll/u.test(getComputedStyle(scroller).overflowY)
        )
      ) {
        scroller = scroller.parentElement;
      }
      if (header === null || header === undefined || scroller === null) return null;
      const headerBox = header.getBoundingClientRect();
      const middle = headerBox.top + headerBox.height / 2;
      const before = button.getBoundingClientRect();
      scroller.scrollBy(0, before.top + before.height / 2 - middle);
      const box = button.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return {
        under: box.top < headerBox.bottom && box.bottom > headerBox.top,
        headerOnTop: top !== null && top.closest(".dialog-header") !== null,
      };
    });
    expect(result).toEqual({ under: true, headerOnTop: true });
  });

  // Clearing the rating's bounds keeps its position, so the column stays.
  test("clears the position rating bounds and keeps the position", async ({ page }) => {
    await loadDatabase(page);
    const rating = page.getByRole("group", { name: "Ocena na pozycji" });
    await rating
      .getByRole("combobox", { name: "Ocena na pozycji" })
      .selectOption({ label: "Boczny obrońca (RB/LB)" });
    await rating.getByRole("group", { name: "OVR RB/LB" }).getByLabel("od").fill("99");
    await expect(page.getByText("Żaden zawodnik nie spełnia filtrów.")).toBeVisible();
    await page.getByRole("button", { name: "Wyczyść: OVR RB/LB" }).click();
    await expectCount(page, "62 zawodników");
    await expect(page.getByRole("columnheader", { name: /^OVR RB\/LB/u })).toBeVisible();
  });
});
