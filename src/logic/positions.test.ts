import { describe, expect, it } from "vitest";
import { POSITION_CODES, positionOf } from "./positions.ts";

describe("positionOf", () => {
  it("names codes and groups them, rejecting codes outside 0..31", () => {
    expect(positionOf(0)).toEqual({ name: "GK", group: "goalkeeper" });
    expect(positionOf(31)).toEqual({ name: "LS", group: "forwards" });
    expect(() => positionOf(32)).toThrow(/Unknown position code 32/);
  });

  it("uses the game's own names, which key the abbreviation of every language", () => {
    expect(POSITION_CODES.map((code) => positionOf(code).name).join(" ")).toBe(
      "GK SW RWB RB RCB CB LCB LB LWB RDM RCDM CDM LCDM LDM RWM RM RCM CM LCM LM LWM " +
        "RAM RCAM CAM LCAM LAM RF CF LF RS ST LS",
    );
  });
});
