// The names of the attribute groups' averages and spreads in the filters, the sort and the list columns.
import type { GroupStatKey } from "../logic/attribute-groups.ts";

export const GROUP_STAT_LABELS: Readonly<Record<GroupStatKey, string>> = {
  physicalAverage: "Średnia: fizyczne",
  physicalSpread: "Rozrzut: fizyczne",
  techniqueAverage: "Średnia: technika",
  techniqueSpread: "Rozrzut: technika",
  shootingAverage: "Średnia: strzały",
  shootingSpread: "Rozrzut: strzały",
  mentalAverage: "Średnia: mentalne",
  mentalSpread: "Rozrzut: mentalne",
  defendingAverage: "Średnia: obrona",
  defendingSpread: "Rozrzut: obrona",
  goalkeepingAverage: "Średnia: bramkarz",
  goalkeepingSpread: "Rozrzut: bramkarz",
};
