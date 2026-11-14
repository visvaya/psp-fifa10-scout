// The texts of the experience bar of the user's squad (roadmap 36), a part of the UI texts beside text.ts;
// free of it, since its labels join text.ts's.
import { pl } from "./typeset.ts";

export const LEVEL_UP_LABELS = {
  levelUpXp: pl`Doświadczenie (XP)`,
  levelUpPoints: pl`Punkty przy awansie`,
};

export const LEVEL_UP_HELP = {
  levelUpXp: pl`Z zapisem kariery, u zawodników twojego składu: pasek doświadczenia z gry, od 0 do 1000. Rośnie po meczu, w którym zawodnik grał (więcej przy dłuższej grze, wyższej ocenie meczowej i większym zapasie do potencjału), a po powrocie z reprezentacji o 200. Przy 1000 następuje awans: pasek wraca do 0, a atrybuty dostają punkty z „Punktów przy awansie”. Liczba meczów do awansu na karcie to widełki przy 15 do 53 XP na mecz, czyli rozrzucie zmierzonym w zapisach kariery.`,
  levelUpPoints: pl`Z zapisem kariery, u zawodników twojego składu: punkty atrybutów, które da najbliższy awans paska doświadczenia, po 1 za każde pełne 100 XP atrybutu. Gdy OVR osiągnął potencjał, awans nie daje punktów. U zawodnika, który dopiero wszedł do składu, gra losuje XP atrybutów od nowa, więc ta liczba niewiele wtedy mówi; który atrybut wzrośnie, z zapisu przewidzieć się nie da.`,
};

/** The forms of "mecz" after a count. */
export const MATCHES = { one: "mecz", few: "mecze", many: "meczów" } as const;

export const LEVEL_UP_TEXT = {
  /** The bar out of 1000 and the matches to the level-up, a range of counted matches. */
  bar: (xp: string, matches: string): string => pl`${xp} z 1000, awans za ${matches}`,
  /** The bar is full: the game levels it up after the next match. */
  full: (xp: string): string => pl`${xp} z 1000, awans po najbliższym meczu`,
  range: (fewest: number, most: string): string => `${String(fewest)}–${most}`,
  /** After the points (0) while his OVR has reached his potential, with the potential shown only. */
  capped: pl` (OVR osiągnął potencjał, więc awans nie doda punktów)`,
};
