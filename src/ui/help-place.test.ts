import { describe, expect, it } from "vitest";
import { helpPanelPlace } from "./help-place.ts";

const viewport = { width: 390, height: 844 };
const place = (
  button: { left: number; top: number; bottom: number },
  height = 100,
  screen = viewport,
) => helpPanelPlace({ button, panel: { width: 200, height }, viewport: screen, edge: 16, gap: 4 });

describe("helpPanelPlace", () => {
  it("puts the panel under the button, from its left edge", () => {
    // Room under: 844 - 16 - 148 = 680.
    expect(place({ left: 40, top: 100, bottom: 144 })).toEqual({
      left: 40,
      top: 148,
      maxHeight: 680,
    });
  });

  it("keeps the panel off the viewport's right and left edges", () => {
    expect(place({ left: 300, top: 100, bottom: 144 }).left).toBe(390 - 16 - 200);
    expect(place({ left: 2, top: 100, bottom: 144 }).left).toBe(16);
  });

  it("puts the panel above the button when it fits only there", () => {
    // Under: 804 + 4 + 100 > 844 - 16; above: 760 - 4 - 100 = 656, room 760 - 4 - 16 = 740.
    expect(place({ left: 40, top: 760, bottom: 804 })).toEqual({
      left: 40,
      top: 656,
      maxHeight: 740,
    });
    // Fits exactly under: 700 + 4 + 124 = 828.
    expect(place({ left: 40, top: 656, bottom: 700 }, 124).top).toBe(704);
  });

  it("takes the side with more room when it fits on neither, as tall as that room", () => {
    // Under: 844 - 16 - 348 = 480 of room; above: 300 - 4 - 16 = 280.
    expect(place({ left: 40, top: 300, bottom: 344 }, 800)).toEqual({
      left: 40,
      top: 348,
      maxHeight: 480,
    });
    // A short screen (390 x 500): under 500 - 16 - 348 = 136, above 280; the panel ends 4 px over the
    // button and starts 16 px from the top.
    expect(place({ left: 40, top: 300, bottom: 344 }, 400, { width: 390, height: 500 })).toEqual({
      left: 40,
      top: 16,
      maxHeight: 280,
    });
  });
});
