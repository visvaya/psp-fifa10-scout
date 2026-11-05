// The name of a range filter, sort key or column: a field, an attribute, or a group's average or spread.
import { GROUP_STATS, isGroupStatKey } from "../logic/attribute-groups.ts";
import type { GroupStatKey } from "../logic/attribute-groups.ts";
import type { RangeKey } from "../logic/filter-players.ts";
import { isAttributeName } from "../logic/players.ts";
import { ATTRIBUTE_GROUP_LABELS, ATTRIBUTE_LABELS, RANGE_LABELS } from "./text.ts";

export const GROUP_STAT_PREFIXES = { average: "Średnia: ", spread: "Rozrzut: " } as const;

/** "Średnia: fizyczne", "Rozrzut: bramkarz": the group's name in lower case after the prefix. */
export const groupStatLabel = (key: GroupStatKey): string => {
  const { group, average } = GROUP_STATS[key];
  return `${GROUP_STAT_PREFIXES[average ? "average" : "spread"]}${ATTRIBUTE_GROUP_LABELS[group].toLowerCase()}`;
};

export const rangeLabel = (key: RangeKey): string => {
  if (isGroupStatKey(key)) return groupStatLabel(key);
  return isAttributeName(key) ? ATTRIBUTE_LABELS[key] : RANGE_LABELS[key];
};
