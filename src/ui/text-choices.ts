// The options of the filters chosen one of a few (radio buttons), as the form and the chips name them,
// the rules of a best peak tie and the club players' states; a part of the UI texts beside text.ts.
import type { TieRule } from "../logic/best-peak.ts";
import type { ClubStatus, ListMembership } from "../logic/filter-players.ts";
import type { SquadState } from "../logic/roles.ts";
import type { MyClub } from "../logic/scout-state.ts";
import { pl } from "./typeset.ts";

export const MY_CLUB_LABELS: Readonly<Record<"all" | MyClub, string>> = {
  all: "wszyscy zawodnicy",
  hide: "ukryj zawodników mojego klubu",
  only: "tylko zawodnicy mojego klubu",
};

/** A club player's state (roles.ts), in the list, the filter and on the card. */
/** A club player the best eleven of the formation leaves out (roadmap 119 (b)). */
export const OUTSIDE_ELEVEN_LABEL = pl`poza jedenastką`;

export const SQUAD_STATE_LABELS: Readonly<Record<SquadState, string>> = {
  retiring: pl`kończy karierę`,
  contractEnding: pl`kończy kontrakt`,
  toLoan: pl`do wypożyczenia`,
  toSell: pl`do sprzedaży`,
  toDevelop: pl`do rozwoju`,
  declining: "spada",
  developed: "rozwinięty",
  growing: "rośnie",
};

export const CLUB_STATUS_LABELS: Readonly<Record<ClubStatus, string>> = {
  available: pl`dostępni w karierze`,
  "with-club": pl`tylko z klubem`,
  "free-agents": "tylko wolni",
  unavailable: pl`niedostępni w karierze`,
};

/** "Any" stands for an unset list choice. */
export const LIST_MEMBERSHIP_LABELS: Readonly<Record<"any" | ListMembership, string>> = {
  any: "dowolne",
  game: pl`w grze`,
  tool: pl`w narzędziu`,
  both: pl`w obu`,
  none: pl`na żadnej`,
};

/** The rules that break a best peak tie, in the list that orders them. */
export const TIE_RULE_LABELS: Readonly<Record<TieRule, string>> = {
  formation: pl`pozycje z formacji twojego klubu (z zapisu kariery)`,
  weakFootCentre: pl`środek przy słabszej nodze na 4 lub 5 gwiazdek`,
  betterFootSide: pl`strona lepszej nogi`,
  preferredPosition: pl`pozycja preferowana`,
};
