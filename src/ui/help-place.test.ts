import { describe, expect, it } from "vitest";
import { helpPanelPlace } from "./help-place.ts";

const viewport = { width: 390, height: 844 };
const place = (button: { left: number; top: number; bottom: number }, height = 100) =>
  helpPanelPlace({ button, panel: { width: 200, height }, viewport, edge: 16, gap: 4 });

describe("helpPanelPlace", () => {
  it("puts the panel under the button, from its left edge", () => {
    expect(place({ left: 40, top: 100, bottom: 144 })).toEqual({ left: 40, top: 148 });
  });

  it("keeps the panel off the viewport's right and left edges", () => {
    expect(place({ left: 300, top: 100, bottom: 144 }).left).toBe(390 - 16 - 200);
    expect(place({ left: 2, top: 100, bottom: 144 }).left).toBe(16);
  });

  it("puts the panel above the button when it fits only there", () => {
    // Under: 804 + 4 + 100 > 844 - 16; above: 760 - 4 - 100 = 656.
    expect(place({ left: 40, top: 760, bottom: 804 }).top).toBe(656);
    // Fits exactly under: 700 + 4 + 124 = 828.
    expect(place({ left: 40, top: 656, bottom: 700 }, 124).top).toBe(704);
  });

  it("stays under the button when it fits on neither side", () => {
    expect(place({ left: 40, top: 300, bottom: 344 }, 800).top).toBe(348);
  });
});
