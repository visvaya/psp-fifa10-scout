// Explanations under filter field names (filter-form.tsx), a part of the UI texts beside text.ts.
import type { ListKey, RangeKey } from "../logic/filter-players.ts";
import { pl } from "./typeset.ts";

export const FIELD_HELP: Partial<Readonly<Record<RangeKey | ListKey, string>>> = {
  positionGroup: pl`Pozycje zgrupowane według sposobu liczenia OVR w grze: w jednej grupie te same wagi atrybutów.`,
  growth: pl`Potencjał minus OVR: ile brakuje do limitu potencjału (w karierze z poprawką z zapisu). Zawodnicy rzadko go osiągają; realniejszy jest szczyt OVR.`,
  peak: pl`OVR na szczycie rozwoju według krzywych gry, ten sam co na jej wykresie rozwoju. Bez przyszłych przyrostów z meczów i treningu.`,
  peakGain: pl`Szczyt OVR minus OVR: ile zawodnik jeszcze urośnie według krzywych rozwoju gry.`,
  form: pl`Średnia ocena meczowa z zapisu, jak w kolumnie KR na ekranie statystyk zawodnika w grze. Bez meczów zwykle 5,0.`,
};

/** Under the peak at the position chosen in "Ocena na pozycji". */
export const RATING_PEAK_HELP = pl`Najwyższy OVR na tej pozycji według krzywych rozwoju gry, liczony jak szczyt OVR.`;
