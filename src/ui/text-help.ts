// Explanations under filter field names (filter-form.tsx), a part of the UI texts beside text.ts.
import type { ListKey, RangeKey } from "../logic/filter-players.ts";
import { pl } from "./typeset.ts";

export const FIELD_HELP: Partial<Readonly<Record<RangeKey | ListKey, string>>> = {
  positionGroup: pl`Pozycje zgrupowane według sposobu liczenia OVR w grze: w jednej grupie te same wagi atrybutów.`,
  growth: pl`Potencjał minus OVR: ile brakuje do limitu potencjału (w karierze z poprawką z zapisu). Zawodnicy rzadko go osiągają; realniejszy jest szczyt OVR.`,
  peak: pl`OVR na szczycie rozwoju według krzywych gry na pozycji preferowanej zawodnika, ten sam co na wykresie rozwoju w grze. Bez przyszłych przyrostów z meczów i treningu.`,
  peakGain: pl`Szczyt OVR minus OVR: ile zawodnik jeszcze urośnie według krzywych rozwoju gry.`,
  bestPeak: pl`Szczyt OVR i zapas do szczytu liczone na pozycji, na której szczyt zawodnika jest największy. Szczyt jest liczony osobno dla każdej pozycji, a pozycja najlepsza dziś nie musi być najlepsza w szczycie: zawodnik z OVR 72 jako napastnik i 68 jako prawy pomocnik może osiągnąć szczyt 82 jako napastnik i 83 jako prawy pomocnik; pole pokaże wtedy 83 i prawego pomocnika. Zmienia coś tylko u zawodników, których szczyt na pozycji preferowanej jest niższy od największego.`,
  bodyType: pl`Gra nie nazywa kodów. Przy podobnym wzroście typ 1 to średnio zawodnicy najlżejsi, typ 3 najciężsi.`,
  developmentType: pl`Kiedy zawodnik osiąga szczyt według krzywych rozwoju gry: wcześnie, w typowym wieku albo późno.`,
  developmentStyle: pl`Kształt krzywej rozwoju umiejętności: jak wysoko i jak długo rośnie. Krótka kariera szybko spada po szczycie, nagły skok rośnie gwałtownie w kilka sezonów.`,
  form: pl`Średnia ocena meczowa z zapisu, jak w kolumnie KR na ekranie statystyk zawodnika w grze. Bez meczów zwykle 5,0.`,
};

/** Under the peak at the position chosen in "Ocena na pozycji". */
export const RATING_PEAK_HELP = pl`Najwyższy OVR na tej pozycji według krzywych rozwoju gry, liczony jak szczyt OVR.`;
