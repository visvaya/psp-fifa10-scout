// The text of an active filter's chip: the filter's name and the value it takes.
import { FLAG_KEYS, LIST_FIELDS, peakField, RANGE_KEYS } from "../logic/filter-players.ts";
import type { ListKey, PositionRating, Range } from "../logic/filter-players.ts";
import type { Player } from "../logic/players.ts";
import { POSITION_GROUPS } from "../logic/positions.ts";
import { roleNameOf, SQUAD_STATES } from "../logic/roles.ts";
import type { FilterId, ScoutFilters } from "../logic/scout-state.ts";
import { codeName } from "./text-code-names.ts";
import { ratingAbbreviation } from "./position-name.tsx";
import {
  FLAG_LABELS,
  formatNumber,
  LIST_LABELS,
  POSITION_GROUP_LABELS,
  rangeLabel,
  TEXT,
} from "./text.ts";
import {
  CLUB_STATUS_LABELS,
  LIST_MEMBERSHIP_LABELS,
  MY_CLUB_LABELS,
  SQUAD_STATE_LABELS,
} from "./text-choices.ts";

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
  ["onList", TEXT.onList],
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
    codeName(key, Number(value));

const nameText =
  (key: "leagueId" | "clubId" | "nationalityId") =>
  (value: unknown, names: ChipNames): string =>
    names.byId(key, Number(value)) ?? String(value);

/** The lists whose values name themselves, without the game's names: their chips and list columns. */
export type ChoiceKey =
  | "positionGroup"
  | "preferredFoot"
  | "bodyType"
  | "developmentType"
  | "developmentStyle"
  | "squadState";

/** How a chip and a list column name one value of a list that names itself. */
export const CHOICE_VALUE_TEXT: Readonly<Record<ChoiceKey, (value: unknown) => string>> = {
  positionGroup: (value) => {
    const group = POSITION_GROUPS.find((item) => item === value);
    return group === undefined ? String(value) : POSITION_GROUP_LABELS[group];
  },
  preferredFoot: (value) => (value === "left" ? TEXT.card.left : TEXT.card.right),
  bodyType: codeText("bodyType"),
  developmentType: codeText("developmentType"),
  developmentStyle: codeText("developmentStyle"),
  squadState: (value) => {
    const state = SQUAD_STATES.find((item) => item === value);
    return state === undefined ? String(value) : SQUAD_STATE_LABELS[state];
  },
};

/** The lists of a role or target, whose values are named by roleText. */
export const isRoleColumn = (key: string): key is "role" | "target" | "peakTarget" =>
  key === "role" || key === "target" || key === "peakTarget";

/** "2. CB": a role or target value with its position in the game language. */
export const roleText = (value: unknown, names: Pick<ChipNames, "positionName">): string =>
  roleNameOf(Number(value), names.positionName) ?? String(value);

/** How a chip names one chosen value of each list. */
const LIST_VALUE_TEXT: Readonly<Record<ListKey, (value: unknown, names: ChipNames) => string>> = {
  ...CHOICE_VALUE_TEXT,
  positionCode: (value, names) => names.positionName(Number(value)),
  leagueId: nameText("leagueId"),
  clubId: nameText("clubId"),
  nationalityId: nameText("nationalityId"),
  role: roleText,
  target: roleText,
  peakTarget: roleText,
};

/** The first chosen values by name, then how many more: "Argentina, Brazil, Chile +2"; "oprócz …" for
 * an excluded list. */
const listText = (key: ListKey, filters: ScoutFilters, names: ChipNames): string => {
  const values: readonly unknown[] = filters.lists?.[key] ?? [];
  const shown = values.slice(0, CHIP_VALUES_MAX).map((value) => LIST_VALUE_TEXT[key](value, names));
  const text = TEXT.chipValues(shown, values.length - shown.length);
  return filters.excludedLists?.[key] === true ? TEXT.chipExcluded(text) : text;
};

/** "BR, od 70, różnica od +1, szczyt od 80": the position, its bounds, the gain's and the peak's. */
const ratingText = (rating: PositionRating, names: ChipNames): string => {
  const gain = rangeText(rating.gain, TEXT.signed);
  const peak = rangeText(rating.peak, formatNumber);
  return TEXT.chipParts(
    [
      ratingAbbreviation(rating.code, names.positionName),
      rangeText(rating, formatNumber),
      gain === "" ? "" : `${TEXT.ratingGainShort} ${gain}`,
      peak === "" ? "" : `${TEXT.ratingPeakShort} ${peak}`,
      rating.bestOnly === true ? TEXT.bestPositionShort : "",
    ].filter((part) => part !== ""),
  );
};

/** The value a filter takes, or "" when the name says it all. */
const valueText = (id: FilterId, filters: ScoutFilters, names: ChipNames): string => {
  if (id === "text") return filters.text ?? "";
  if (id === "onList")
    return filters.onList === undefined ? "" : LIST_MEMBERSHIP_LABELS[filters.onList];
  if (id === "positionRating") {
    return filters.positionRating === undefined ? "" : ratingText(filters.positionRating, names);
  }
  const range = RANGE_KEYS.find((key) => `ranges.${key}` === id);
  if (range !== undefined) return rangeText(filters.ranges?.[range], formatNumber);
  const list = LIST_FIELDS.find((key) => `lists.${key}` === id);
  if (list !== undefined) return listText(list, filters, names);
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
  // The peak ranges are named for the best position while peakAtBest is on.
  const range = RANGE_KEYS.find((key) => `ranges.${key}` === id);
  const label =
    range === undefined
      ? (FILTER_LABELS.get(id) ?? id)
      : rangeLabel(peakField(range, filters.peakAtBest === true));
  const value = valueText(id, filters, names);
  return TEXT.capitalized(value === "" ? label : TEXT.chip(label, value));
};
