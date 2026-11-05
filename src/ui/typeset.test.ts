import { describe, expect, it } from "vitest";
import { NBSP, pl, tie } from "./typeset.ts";

const shown = (text: string): string => text.replaceAll(NBSP, "~");

// Each text as tie returns it, with ~ for the non-breaking space.
const TIED: Readonly<Record<string, string>> = {
  "Klub i kontrakt": "Klub i~kontrakt",
  "Wychodzi z bramki": "Wychodzi z~bramki",
  "i w zapisie": "i~w~zapisie",
  "Zapis (w folderze)": "Zapis (w~folderze)",
  "W tym sezonie": "W~tym sezonie",
  "około 540 KB": "około 540~KB",
  "np. pol_pl.loc": "np.~pol_pl.loc",
  "2. Zapis kariery": "2.~Zapis kariery",
  "ULES01328081 (iPhone": "ULES01328081 (iPhone",
  // A word ending in a one-letter-like syllable stays apart.
  "Liga ma klub": "Liga ma klub",
};

describe("tie", () => {
  it.each(Object.entries(TIED))("ties %s", (text, tied) => {
    expect(shown(tie(text))).toBe(tied);
  });
});

describe("pl", () => {
  it("ties the literal parts and leaves the values as they are", () => {
    const club = "Deportivo A Coruña";
    expect(shown(pl`Wypożyczony z ${club} i w kadrze`)).toBe(
      "Wypożyczony z~Deportivo A Coruña i~w~kadrze",
    );
  });

  it("ties a number value to the word after it", () => {
    expect(shown(pl`ma ${19} lub mniej`)).toBe("ma 19~lub mniej");
    expect(shown(pl`${"Kadra"} i ${"Klub"}`)).toBe("Kadra i~Klub");
  });
});
