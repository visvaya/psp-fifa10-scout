// The texts of reading the large development chart at an age (roadmap 112), a part of the UI texts
// beside text.ts.
import { count, formatNumber, YEARS } from "./text.ts";
import { pl } from "./typeset.ts";

export const CHART_READING_TEXT = {
  /** The slider over the plot, which a screen reader names. */
  label: "Wiek na wykresie",
  /** Under the chart until an age is read. */
  hint: pl`Przesuń palcem albo kursorem po wykresie, by odczytać wartość w danym wieku.`,
  /** Under the chart and as the slider's value: the age read and the chart's value at it. */
  at: (age: number, value: number, ovr: boolean): string =>
    pl`w wieku ${count(age, YEARS)}: ${ovr ? "OVR" : "poziom"} ${formatNumber(value)}`,
  /** The legend's item for the line after his last season, short (owner, 2026-11-14, roadmap 127). */
  legendRetirement: (age: number): string => pl`ostatni sezon: ${count(age, YEARS)}`,
  /** Behind its "?": the line, and why the chart's age differs from the retirement age on the card. */
  retirementHelp: (retirementAge: number): string =>
    pl`Pionowa linia stoi za ostatnim sezonem zawodnika, a przebieg za nią jest wyszarzony, bo wtedy już nie gra. Wiek na osi to wiek na początku sezonu. Wiek zakończenia kariery z bazy, ${count(retirementAge, YEARS)}, gra porównuje z wiekiem na 31 grudnia roku, w którym sezon się kończy, więc ostatni sezon zaczyna się w wieku do 2 lat niższym.`,
  /** After the words of an age past his last season. */
  pastRetirement: pl`, po końcu kariery`,
};
