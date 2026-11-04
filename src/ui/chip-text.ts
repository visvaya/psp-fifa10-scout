// The text of an active filter's chip: the filter's name and the value it takes.
import { FLAG_KEYS, LIST_FIELDS, RANGE_KEYS } from "../logic/filter-players.ts";
import type { ListKey, PositionRating, Range } from "../logic/filter-players.ts";
import type { Player } from "../logic/players.ts";
import { POSITION_GROUPS } from "../logic/positions.ts";
import type { FilterId, ScoutFilters } from "../logic/scout-state.ts";
import { ratingAbbreviation } from "./position-name.tsx";
import {
  CLUB_STATUS_LABELS,
  FLAG_LABELS,
  formatNumber,
  LIST_LABELS,
  MY_CLUB_LABELS,
  POSITION_GROUP_LABELS,
  rangeLabel,
  TEXT,
} from "./text.ts";

/** A chip names this many chosen values; it counts the rest. */
const CHIP_VALUES_MAX = 3;

/** Names the chips need: positions in the game language, and leagues, clubs and countries by id. */
export interface ChipNames {
  readonly positionName: (code: number) => string;
  readonly byId: (key: "leagueId" | "clubId" | "nationalityId", id: number) => string | undefined;
}

/** League, club and nationality names by id, as the players carry them. */
export const namesById = (players: readonly Player[]): ChipNames["byId"] => {
  const maps = {
    leagueId: new Map(players.map((player) => [player.leagueId, player.leagueName])),
    clubId: new Map(players.map((player) => [player.clubId, player.clubName])),
    nationalityId: new Map(players.map((player) => [player.nationalityId, player.nationalityName])),
  };
  return (key, id) => maps[key].get(id) ?? undefined;
};

const FILTER_LABELS = new Map<FilterId, string>([
  ["text", TEXT.text],
  ["positionRating", TEXT.positionRating],
  ...RANGE_KEYS.map((key) => [`ranges.${key}`, rangeLabel(key)] as const),
  ...LIST_FIELDS.map((key) => [`lists.${key}`, LIST_LABELS[key]] as const),
  ...FLAG_KEYS.map((key) => [`flags.${key}`, FLAG_LABELS[key]] as const),
]);

/** "od 70 do 80", with each bound in the given form. */
const rangeText = (range: Range | undefined, format: (value: number) => string): string =>
  [
    range?.min === undefined ? [] : [`${TEXT.min} ${format(range.min)}`],
    range?.max === undefined ? [] : [`${TEXT.max} ${format(range.max)}`],
  ]
    .flat()
    .join(" ");

const codeText =
  (key: "bodyType" | "developmentType" | "developmentStyle") =>
  (value: unknown): string =>
    TEXT.code(TEXT.codePrefix[key], Number(value));

const nameText =
  (key: "leagueId" | "clubId" | "nationalityId") =>
  (value: unknown, names: ChipNames): string =>
    names.byId(key, Number(value)) ?? String(value);

/** How a chip names one chosen value of each list. */
const LIST_VALUE_TEXT: Readonly<Record<ListKey, (value: unknown, names: ChipNames) => string>> = {
  positionGroup: (value) => {
    const group = POSITION_GROUPS.find((item) => item === value);
    return group === undefined ? String(value) : POSITION_GROUP_LABELS[group];
  },
  positionCode: (value, names) => names.positionName(Number(value)),
  preferredFoot: (value) => (value === "left" ? TEXT.card.left : TEXT.card.right),
  bodyType: codeText("bodyType"),
  developmentType: codeText("developmentType"),
  developmentStyle: codeText("developmentStyle"),
  leagueId: nameText("leagueId"),
  clubId: nameText("clubId"),
  nationalityId: nameText("nationalityId"),
};

/** The first chosen values by name, then how many more: "Argentina, Brazil, Chile +2". */
const listText = (key: ListKey, values: readonly unknown[], names: ChipNames): string => {
  const shown = values.slice(0, CHIP_VALUES_MAX).map((value) => LIST_VALUE_TEXT[key](value, names));
  const more = values.length - shown.length;
  return more > 0 ? `${shown.join(", ")} +${String(more)}` : shown.join(", ");
};

/** "BR, od 70, różnica od +1": the position, its bounds and the gain's. */
const ratingText = (rating: PositionRating, names: ChipNames): string => {
  const gain = rangeText(rating.gain, TEXT.signed);
  return [
    ratingAbbreviation(rating.code, names.positionName),
    rangeText(rating, formatNumber),
    gain === "" ? "" : `${TEXT.ratingGainShort} ${gain}`,
  ]
    .filter((part) => part !== "")
    .join(", ");
};

/** The value a filter takes, or "" when the name says it all. */
const valueText = (id: FilterId, filters: ScoutFilters, names: ChipNames): string => {
  if (id === "text") return filters.text ?? "";
  if (id === "positionRating") {
    return filters.positionRating === undefined ? "" : ratingText(filters.positionRating, names);
  }
  const range = RANGE_KEYS.find((key) => `ranges.${key}` === id);
  if (range !== undefined) return rangeText(filters.ranges?.[range], formatNumber);
  const list = LIST_FIELDS.find((key) => `lists.${key}` === id);
  if (list !== undefined) return listText(list, filters.lists?.[list] ?? [], names);
  const flag = FLAG_KEYS.find((key) => `flags.${key}` === id);
  const wanted = flag === undefined ? undefined : filters.flags?.[flag];
  return wanted === undefined ? "" : wanted ? TEXT.flagValues.yes : TEXT.flagValues.no;
};

/** The chip text, from a capital letter: "POT: od 74"; the chosen option alone for a choice. */
export const chipText = (id: FilterId, filters: ScoutFilters, names: ChipNames): string => {
  if (id === "myClub" && filters.myClub !== undefined) {
    return TEXT.capitalized(MY_CLUB_LABELS[filters.myClub]);
  }
  if (id === "clubStatus" && filters.clubStatus !== undefined) {
    return TEXT.capitalized(CLUB_STATUS_LABELS[filters.clubStatus]);
  }
  const label = FILTER_LABELS.get(id) ?? id;
  const value = valueText(id, filters, names);
  return TEXT.capitalized(value === "" ? label : TEXT.chip(label, value));
};
