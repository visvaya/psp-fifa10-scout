// The filters of the roles, states and targets (roles.ts) in the career section; the peak's target only
// with the potential, as the other peak fields.
import type { JSX } from "react";
import type { facetOptions } from "../logic/facets.ts";
import type { Player } from "../logic/players.ts";
import { SQUAD_STATES } from "../logic/roles.ts";
import { elevenText, roleText } from "./chip-text.ts";
import type { Choice } from "./filter-fields.tsx";
import { SQUAD_STATE_LABELS } from "./text-choices.ts";

type RoleListKey = "role" | "squadState" | "target" | "peakTarget" | "bestEleven";

/** Roles or targets by name ("2. CB"), in the order they sort. */
const roleChoices = (
  values: readonly number[],
  positionName: (code: number) => string,
): readonly Choice<number>[] =>
  values.map((value) => ({ value, label: roleText(value, { positionName }) }));

export const RoleFields = ({
  list,
  facets: { codes },
  positionName,
  showPotential,
}: {
  /** The form's builder of a list filter. */
  list: <K extends RoleListKey>(
    key: K,
    choices: readonly Choice<NonNullable<Player[K]>>[],
  ) => JSX.Element;
  facets: Pick<ReturnType<typeof facetOptions>, "codes">;
  positionName: (code: number) => string;
  showPotential: boolean;
}) => (
  <>
    {list("role", roleChoices(codes.role, positionName))}
    {list(
      "squadState",
      SQUAD_STATES.map((state) => ({ value: state, label: SQUAD_STATE_LABELS[state] })),
    )}
    {list(
      "bestEleven",
      codes.bestEleven.map((value) => ({ value, label: elevenText(value, { positionName }) })),
    )}
    {list("target", roleChoices(codes.target, positionName))}
    {showPotential ? list("peakTarget", roleChoices(codes.peakTarget, positionName)) : null}
  </>
);
