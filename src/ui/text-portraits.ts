// The texts of the approximate portraits (roadmap 110): the filter panel's switch and the line under the
// card's portrait, a part of the UI texts beside text.ts.
import type { LookPart } from "../logic/portraits.ts";
import { pl } from "./typeset.ts";

const DIFFERENCES: Readonly<Record<LookPart, string>> = {
  hair: "inna fryzura",
  hairColor: "inny kolor włosów",
  facialHair: "inny zarost",
};

export const PORTRAIT_TEXT = {
  label: "Przybliżone portrety",
  help: pl`Gra nie ma portretu około jednej piątej zawodników i pokazuje w jego miejscu pustą sylwetkę. Po włączeniu ci zawodnicy dostają najbliższy portret z gry z tą samą twarzą i kolorem skóry. Fryzura, kolor włosów albo zarost mogą się różnić; karta mówi pod portretem, co jest inne.`,
  /** Under an approximate portrait on the card: what differs from the player's own look. */
  differences: (parts: readonly LookPart[]): string =>
    `Portret przybliżony: ${parts.map((part) => DIFFERENCES[part]).join(", ")}`,
};
