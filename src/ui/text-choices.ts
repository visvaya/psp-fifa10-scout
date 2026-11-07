// The options of the filters chosen one of a few (radio buttons), as the form and the chips name them; a
// part of the UI texts beside text.ts.
import type { ClubStatus, ListMembership } from "../logic/filter-players.ts";
import type { MyClub } from "../logic/scout-state.ts";
import { pl } from "./typeset.ts";

export const MY_CLUB_LABELS: Readonly<Record<"all" | MyClub, string>> = {
  all: "wszyscy zawodnicy",
  hide: "ukryj zawodników mojego klubu",
  only: "tylko zawodnicy mojego klubu",
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
