// Whether "Resetuj" would change anything, asked of the reset itself so the two cannot drift apart.
import { activeFilters } from "./filter-changes.ts";
import { resetState } from "./scout-state.ts";
import type { ScoutState } from "./scout-state.ts";

/** The settings "Resetuj" brings back. */
export type ResetSettings = Pick<
  ScoutState,
  | "filters"
  | "sort"
  | "showPotential"
  | "columns"
  | "tieOrder"
  | "afterSigning"
  | "transferYears"
  | "approximatePortraits"
  | "alwaysPortraits"
>;

/** The settings as far as they change the list: the active filters, not an empty one. */
const shownSettings = (settings: ResetSettings): string => {
  const { filters, sort, showPotential, columns, tieOrder } = settings;
  return JSON.stringify([
    activeFilters(filters),
    sort,
    showPotential,
    columns ?? {},
    tieOrder ?? [],
    settings.afterSigning === true,
    settings.transferYears ?? null,
    settings.approximatePortraits === true,
    settings.alwaysPortraits === true,
  ]);
};

/** "Resetuj" would change something: the settings differ from the ones the reset leaves. */
export const canResetSettings = (settings: ResetSettings): boolean =>
  shownSettings(settings) !== shownSettings(resetState(settings, "settings-reset"));
