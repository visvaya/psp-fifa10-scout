// "Profil po transferze": the list with every player outside the user's squad as the game rates him
// once signed (buildPlayers, afterSigning), priced at the user's club. A view setting like the columns:
// kept in the preferences, out of the filters, the sets and undo. The worker builds that list only when
// the setting is on, once per load, and the state keeps it beside the players, its best peak ties and
// currency shown as theirs.
import { TIE_RULES } from "./best-peak.ts";
import { pricedIn, shownCurrency } from "./currency.ts";
import { wantedContractYears } from "./offer.ts";
import { moneyOf } from "./player-finance.ts";
import type { Player } from "./players.ts";
import type { ScoutState } from "./scout-state.ts";
import { tiesBroken } from "./tie-order.ts";

/** Asked for and not built yet, failed, or built. */
type SignedList = "pending" | "failed" | readonly Player[];

export interface SigningPreference {
  /** Values after signing for players outside the squad; unset as off. */
  readonly afterSigning?: true;
  /** The contract length, 1 to 5 years, his price at the user's club is for; unset: the one he wants. */
  readonly transferYears?: number;
}

/** The stored preference as the state keeps it: unset fields left out. */
export const signingPreferenceOf = ({
  afterSigning,
  transferYears,
}: SigningPreference): SigningPreference => ({
  ...(afterSigning === true ? { afterSigning } : {}),
  ...(transferYears === undefined ? {} : { transferYears }),
});

export interface SigningState extends SigningPreference {
  /** The list after signing for the loaded career; unset until asked for. */
  readonly signed?: SignedList;
}

export type SigningAction =
  | { readonly type: "after-signing-shown"; readonly shown: boolean }
  | { readonly type: "signed-requested" }
  /** null: the length each player wants. */
  | { readonly type: "transfer-years-chosen"; readonly years: number | null }
  /** null: the worker could not build the list. */
  | { readonly type: "signed-built"; readonly players: readonly Player[] | null };

const SIGNING_ACTIONS: ReadonlySet<string> = new Set([
  "after-signing-shown",
  "signed-requested",
  "transfer-years-chosen",
  "signed-built",
]);

export const isSigningAction = (action: { readonly type: string }): action is SigningAction =>
  SIGNING_ACTIONS.has(action.type);

/**
 * The built list with each player's money at the user's club (roadmap 56(c)): his value there for the
 * chosen contract length, else the one he wants, and the market wage there. Players without values there
 * (the user's squad, loaned players) keep their money before signing.
 */
const withMoneyAfter = (state: ScoutState, built: readonly Player[]): readonly Player[] => {
  const before = new Map(state.players?.map((player) => [player.id, player]));
  const seasonEndYear = state.career?.offer.seasonEndYear;
  return built.map((player) => {
    const known = before.get(player.id);
    if (known === undefined) return player;
    const { signedValuesEuro: values, signedWageEuro: wageEuro } = player;
    if (values === null || wageEuro === null || seasonEndYear === undefined)
      return { ...player, ...moneyOf(known) };
    const years = state.transferYears ?? wantedContractYears(known, seasonEndYear);
    return { ...player, priceEuro: values[years - 1] ?? null, wageEuro, storedWage: false };
  });
};

/**
 * A built list with its money at the user's club, the state's best peak tie order and shown currency,
 * as its players have them.
 */
const shownAsPlayers = (state: ScoutState, players: readonly Player[]): readonly Player[] => {
  // Broken again in the default order too: a list broken in another order keeps those ties otherwise.
  const ties =
    tiesBroken({ players, career: state.career }, state.tieOrder ?? TIE_RULES) ?? players;
  const currency = shownCurrency(state);
  const priced = withMoneyAfter(state, ties);
  return currency === null ? priced : pricedIn(priced, currency);
};

export const signingReducer = (state: ScoutState, action: SigningAction): ScoutState => {
  if (action.type === "signed-requested") return { ...state, signed: "pending" };
  if (action.type === "signed-built") {
    // A reply nothing waits for: the list was dropped by a newer load meanwhile.
    if (state.signed !== "pending") return state;
    const { players } = action;
    return {
      ...state,
      signed: players === null ? "failed" : shownAsPlayers(state, players),
    };
  }
  if (action.type === "transfer-years-chosen") {
    const { transferYears: _years, ...rest } = state;
    const next = action.years === null ? rest : { ...rest, transferYears: action.years };
    return Array.isArray(state.signed)
      ? { ...next, signed: shownAsPlayers(next, state.signed) }
      : next;
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
 * A failed load while it is pending means a gone worker: a reply to an earlier request comes first.
 */
export const withSignedList = (
  before: ScoutState,
  after: ScoutState,
  action: { readonly type: string },
): ScoutState => {
  const { signed } = after;
  if (signed === undefined) return after;
  if (signed === "pending" && action.type === "load-failed") return { ...after, signed: "failed" };
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
