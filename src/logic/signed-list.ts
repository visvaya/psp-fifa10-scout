// "Wartość po podpisaniu": the list with every player outside the user's squad as the game rates him
// once signed (buildPlayers, afterSigning). A view setting like the columns: kept in the preferences, out
// of the filters, the sets and undo. The worker builds that list only when the setting is on, once per
// load, and the state keeps it beside the players, its best peak ties and money shown as theirs.
import { pricedIn, shownCurrency } from "./currency.ts";
import type { Player } from "./players.ts";
import type { ScoutState } from "./scout-state.ts";
import { tiesBroken } from "./tie-order.ts";

/** Asked for and not built yet, failed, or built. */
type SignedList = "pending" | "failed" | readonly Player[];

export interface SigningPreference {
  /** Values after signing for players outside the squad; unset as off. */
  readonly afterSigning?: true;
}

export interface SigningState extends SigningPreference {
  /** The list after signing for the loaded career; unset until asked for. */
  readonly signed?: SignedList;
}

export type SigningAction =
  | { readonly type: "after-signing-shown"; readonly shown: boolean }
  | { readonly type: "signed-requested" }
  /** null: the worker could not build the list. */
  | { readonly type: "signed-built"; readonly players: readonly Player[] | null };

const SIGNING_ACTIONS: ReadonlySet<string> = new Set([
  "after-signing-shown",
  "signed-requested",
  "signed-built",
]);

export const isSigningAction = (action: { readonly type: string }): action is SigningAction =>
  SIGNING_ACTIONS.has(action.type);

/** A built list with the state's best peak tie order and shown currency, as its players have them. */
const shownAsPlayers = (state: ScoutState, players: readonly Player[]): readonly Player[] => {
  const ties =
    state.tieOrder === undefined
      ? players
      : (tiesBroken({ players, career: state.career }, state.tieOrder) ?? players);
  const currency = shownCurrency(state);
  return currency === null ? ties : pricedIn(ties, currency);
};

export const signingReducer = (state: ScoutState, action: SigningAction): ScoutState => {
  if (action.type === "signed-requested") return { ...state, signed: "pending" };
  if (action.type === "signed-built") {
    // A reply nothing waits for: the list was dropped by a newer load meanwhile.
    if (state.signed !== "pending") return state;
    const { players } = action;
    return { ...state, signed: players === null ? "failed" : shownAsPlayers(state, players) };
  }
  const { afterSigning: _shown, ...rest } = state;
  return action.shown ? { ...rest, afterSigning: true } : rest;
};

/** The list after signing is wanted and not asked for yet: the setting is on and a career is loaded. */
export const needsSignedList = (state: ScoutState): boolean =>
  state.afterSigning === true &&
  state.career !== null &&
  state.players !== null &&
  state.loading === null &&
  state.signed === undefined;

/** The players the list shows: after signing once that list is built and the setting is on. */
export const shownPlayers = (state: ScoutState): readonly Player[] | null =>
  state.afterSigning === true && Array.isArray(state.signed) ? state.signed : state.players;

/**
 * The state after any action, its list after signing kept in step: a new load drops it (the worker
 * builds it for the career it loaded), and a new tie order or currency applies to it as to the players.
 */
export const withSignedList = (before: ScoutState, after: ScoutState): ScoutState => {
  const { signed } = after;
  if (signed === undefined) return after;
  if (before.loading !== null && after.loading === null && after.players !== before.players) {
    const { signed: _dropped, ...rest } = after;
    return rest;
  }
  const changed =
    after.tieOrder !== before.tieOrder || shownCurrency(after) !== shownCurrency(before);
  return changed && Array.isArray(signed)
    ? { ...after, signed: shownAsPlayers(after, signed) }
    : after;
};
