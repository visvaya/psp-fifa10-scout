// Whether "Resetuj" would change anything, asked of the reset itself so the two cannot drift apart.
import { activeFilters, resetState } from "./scout-state.ts";
import type { ScoutState } from "./scout-state.ts";

/** The settings "Resetuj" brings back. */
export type ResetSettings = Pick<ScoutState, "filters" | "sort" | "showPotential" | "columns">;

/** The settings as far as they change the list: the active filters, not an empty one. */
const shownSettings = ({ filters, sort, showPotential, columns }: ResetSettings): string =>
  JSON.stringify([activeFilters(filters), sort, showPotential, columns ?? {}]);

/** "Resetuj" would change something: the settings differ from the ones the reset leaves. */
export const canResetSettings = (settings: ResetSettings): boolean =>
  shownSettings(settings) !== shownSettings(resetState(settings, "settings-reset"));
