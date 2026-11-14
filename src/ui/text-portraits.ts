// The texts of the portraits: the filter panel's switches, approximate portraits (roadmap 110) and
// portraits always (117), and the line under the card's portrait; a part of the UI texts beside text.ts.
import type { LookPart } from "../logic/portraits.ts";
import type { PortraitSetting } from "../logic/scout-state.ts";
import { pl } from "./typeset.ts";

const DIFFERENCES: Readonly<Record<LookPart, string>> = {
  hair: "inna fryzura",
  hairColor: "inny kolor włosów",
  facialHair: "inny zarost",
};

export const PORTRAIT_TEXT = {
  switches: {
    approximatePortraits: {
      label: "Przybliżone portrety",
      help: pl`Gra nie ma portretu około jednej piątej zawodników i pokazuje w jego miejscu pustą sylwetkę. Po włączeniu ci zawodnicy dostają najbliższy portret z gry z tą samą twarzą i kolorem skóry. Fryzura, kolor włosów albo zarost mogą się różnić; karta mówi pod portretem, co jest inne.`,
    },
    alwaysPortraits: {
      label: "Zawsze pokazuj portrety",
      help: pl`Lista na wąskim ekranie pokazuje portrety tylko wtedy, gdy obok nazwiska jest sama kolumna OVR, bo przy kolejnych kolumnach nazwisko potrzebuje miejsca. Po włączeniu portret zostaje przy każdej liczbie kolumn, a długie nazwiska skracają się wcześniej.`,
    },
  } satisfies Readonly<Record<PortraitSetting, { label: string; help: string }>>,
  /** Under an approximate portrait on the card: what differs from the player's own look. */
  differences: (parts: readonly LookPart[]): string =>
    `Portret przybliżony: ${parts.map((part) => DIFFERENCES[part]).join(", ")}`,
};
