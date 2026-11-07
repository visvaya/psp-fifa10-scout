// The user's order of the rules that break a best peak tie (best-peak.ts). A view setting like the
// columns: kept in the preferences, out of the filters, the sets and undo. The load builds the players
// in the default order; another order breaks their ties again.
import { bestPeakFields, isDefaultOrder, TIE_RULES } from "./best-peak.ts";
import type { TieRule } from "./best-peak.ts";
import type { ScoutState } from "./scout-state.ts";

export type TieOrderAction = {
  readonly type: "tie-order-chosen";
  readonly order: readonly TieRule[];
};

/** The players with their best peak ties broken in `order`; without a career they have no peaks. */
export const tiesBroken = (
  { players, career }: Pick<ScoutState, "players" | "career">,
  order: readonly TieRule[],
): ScoutState["players"] =>
  players === null || career === null
    ? players
    : players.map((player) => ({
        ...player,
        ...bestPeakFields(player, career.formationCodes, order),
      }));

/** The chosen order, left unset when it is the default, with the players' ties broken in it. */
export const tieOrderChosen = (state: ScoutState, order: readonly TieRule[]): ScoutState => {
  const { tieOrder: _previous, ...rest } = state;
  const chosen = isDefaultOrder(order) ? {} : { tieOrder: order };
  return { ...rest, ...chosen, players: tiesBroken(state, order) };
};

/** The state after a change that may drop the order ("Resetuj"), with the players' ties broken again if it did. */
export const tieOrderAfter = (before: ScoutState, after: ScoutState): ScoutState =>
  after.tieOrder === before.tieOrder ? after : tieOrderChosen(after, after.tieOrder ?? TIE_RULES);
