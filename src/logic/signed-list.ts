// "Profil po transferze" and "Profil w szczycie" (roadmap 56(c), 123): the list with every player outside
// the user's squad as the game rates him once signed (buildPlayers, afterSigning), priced at the user's
// club, and every player in the season of his peak (atPeak), alone or together. View settings like the
// columns: kept in the preferences, out of the filters, the sets and undo. The worker builds that list
// only while a profile is on, once per load and profile, and the state keeps it beside the players, its
// best peak ties and currency shown as theirs.
import { TIE_RULES } from "./best-peak.ts";
import { pricedIn, shownCurrency } from "./currency.ts";
import { DEFAULT_CHOICE, offerTerms, wantedContractYears } from "./offer.ts";
import { moneyOf } from "./player-finance.ts";
import type { Player } from "./players.ts";
import type { ProfileMode } from "./player-rating.ts";
import { compactFilters } from "./filter-changes.ts";
import type { ScoutState } from "./scout-state.ts";
import { tiesBroken } from "./tie-order.ts";

/** Asked for and not built yet, failed, or built. */
type SignedList = "pending" | "failed" | readonly Player[];

export interface SigningPreference {
  /** Values after signing for players outside the squad; unset as off. */
  readonly afterSigning?: true;
  /** The contract length, 1 to 5 years, his price at the user's club is for; unset: the one he wants. */
  readonly transferYears?: number;
  /** Every player in the season of his peak OVR (roadmap 123), with the potential shown; unset as off. */
  readonly atPeak?: true;
}

/** The stored preference as the state keeps it: unset fields left out. */
export const signingPreferenceOf = ({
  afterSigning,
  transferYears,
  atPeak,
}: SigningPreference): SigningPreference => ({
  ...(afterSigning === true ? { afterSigning } : {}),
  ...(transferYears === undefined ? {} : { transferYears }),
  ...(atPeak === true ? { atPeak } : {}),
});

export interface SigningState extends SigningPreference {
  /** The list of the profile shown, for the loaded career; unset until asked for. */
  readonly signed?: SignedList;
  /** The profile that list was asked for. */
  readonly signedMode?: ProfileMode;
}

export type SigningAction =
  | { readonly type: "after-signing-shown"; readonly shown: boolean }
  | { readonly type: "peak-shown"; readonly shown: boolean }
  | { readonly type: "signed-requested"; readonly mode: ProfileMode }
  /** null: the length each player wants. */
  | { readonly type: "transfer-years-chosen"; readonly years: number | null }
  /** null: the worker could not build the list. */
  | {
      readonly type: "signed-built";
      readonly players: readonly Player[] | null;
      readonly mode: ProfileMode;
    };

const SIGNING_ACTIONS: ReadonlySet<string> = new Set([
  "after-signing-shown",
  "peak-shown",
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
  // At the peak alone the worker priced every player himself, in that season.
  if (state.afterSigning !== true) return built;
  const before = beforeSigning(state);
  return built.map((player) => {
    const known = before.get(player.id);
    if (known === undefined) return player;
    const { signedValuesEuro: values, signedWageEuro: wageEuro } = player;
    const years = transferYearsOf(state, known);
    if (values === null || wageEuro === null || years === null)
      return { ...player, ...moneyOf(known) };
    return { ...player, priceEuro: values[years - 1] ?? null, wageEuro, storedWage: false };
  });
};

/** The players before signing by id, priced as the state shows them. */
const beforeSigning = (state: ScoutState): ReadonlyMap<number, Player> =>
  new Map(state.players?.map((player) => [player.id, player]));

/** The contract length his money after a transfer is for: the chosen one, else the one he wants. */
const transferYearsOf = (state: ScoutState, known: Player): number | null =>
  state.career === null
    ? null
    : (state.transferYears ?? wantedContractYears(known, state.career.offer.seasonEndYear));

/**
 * The wage his offer needs at the user's club (owner, 2026-11-14, decision 1b): the least he signs for at
 * that contract length, as the offer form counts it from the player before signing, in the shown currency;
 * none for a player without values there.
 */
const withTransferWage = (state: ScoutState, players: readonly Player[]): readonly Player[] => {
  const before = beforeSigning(state);
  const offer = state.career?.offer;
  return players.map((player) => {
    const known = before.get(player.id);
    const years = known === undefined ? null : transferYearsOf(state, known);
    const priced = player.signedValuesEuro !== null && player.signedWageEuro !== null;
    const terms =
      known === undefined || years === null || offer === undefined || !priced
        ? null
        : offerTerms(known, offer, { ...DEFAULT_CHOICE, years });
    return { ...player, transferWage: terms?.wage ?? null };
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
  return withTransferWage(state, currency === null ? priced : pricedIn(priced, currency));
};

export const signingReducer = (state: ScoutState, action: SigningAction): ScoutState => {
  if (action.type === "signed-requested")
    return { ...state, signed: "pending", signedMode: action.mode };
  if (action.type === "signed-built") {
    // A reply nothing waits for: the list was dropped by a newer load or another profile meanwhile.
    if (state.signed !== "pending" || !sameMode(action.mode, state.signedMode)) return state;
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
  if (action.type === "peak-shown") {
    const { atPeak: _peak, ...rest } = state;
    return action.shown ? { ...rest, atPeak: true } : rest;
  }
  const { afterSigning: _shown, ...rest } = state;
  return action.shown ? { ...rest, afterSigning: true } : withTransferWageShown(rest);
};

/** The state without the profiles' settings: "Resetuj" turns them off. */
export const withoutProfiles = <S extends SigningPreference>({
  afterSigning: _shown,
  transferYears: _years,
  atPeak: _peak,
  ...rest
}: S): Omit<S, keyof SigningPreference> => rest;

/** The profile the list shows: the peak only while the potential shows, as every peak value. */
export const profileModeOf = (state: ScoutState): ProfileMode => ({
  afterSigning: state.afterSigning === true,
  atPeak: state.atPeak === true && state.showPotential,
});

const sameMode = (one: ProfileMode, other: ProfileMode | undefined): boolean =>
  one.afterSigning === other?.afterSigning && one.atPeak === other.atPeak;

const anyProfile = ({ afterSigning, atPeak }: ProfileMode): boolean => afterSigning || atPeak;

/**
 * Without the profile after a transfer, no range of the wage after a transfer, which only that profile
 * fills: hidden, it would leave every player out (CodeRabbit on #204), as the potential's ranges do.
 */
export const withTransferWageShown = <S extends Pick<ScoutState, "filters"> & SigningPreference>(
  state: S,
): S => {
  if (state.afterSigning === true || state.filters.ranges?.transferWage === undefined) return state;
  const { transferWage: _range, ...ranges } = state.filters.ranges;
  return { ...state, filters: compactFilters({ ...state.filters, ranges }) };
};

/** The list after signing is wanted and not asked for yet: the setting is on and a career is loaded. */
export const needsSignedList = (state: ScoutState): boolean =>
  anyProfile(profileModeOf(state)) &&
  state.career !== null &&
  state.players !== null &&
  state.loading === null &&
  state.signed === undefined;

/** The players the list shows: after signing once that list is built and the setting is on. */
export const shownPlayers = (state: ScoutState): readonly Player[] | null =>
  anyProfile(profileModeOf(state)) && Array.isArray(state.signed) ? state.signed : state.players;

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
  const reloaded =
    before.loading !== null && after.loading === null && after.players !== before.players;
  // Another profile, or none, needs another list: asked for again (needsSignedList).
  if (reloaded || !sameMode(profileModeOf(after), after.signedMode)) {
    const { signed: _dropped, signedMode: _mode, ...rest } = after;
    return rest;
  }
  const changed =
    after.tieOrder !== before.tieOrder || shownCurrency(after) !== shownCurrency(before);
  return changed && Array.isArray(signed)
    ? { ...after, signed: shownAsPlayers(after, signed) }
    : after;
};
