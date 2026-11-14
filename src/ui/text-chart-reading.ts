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
  /** The legend's item for the line after his last season. */
  legendRetirement: (age: number): string =>
    pl`ostatni sezon przed końcem kariery: wiek ${count(age, YEARS)}`,
  /** After the words of an age past his last season. */
  pastRetirement: pl`, po końcu kariery`,
};
