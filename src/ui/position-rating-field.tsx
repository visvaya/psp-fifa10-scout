// The position rating filter: one choice per way the game rates a position, and a range of the OVR there.
import type { JSX } from "react";
import type { PositionRating } from "../logic/filter-players.ts";
import { positionOf, RATING_CHOICES } from "../logic/positions.ts";
import type { FilterChange } from "../logic/scout-state.ts";
import { numberOrUndefined, RangeField } from "./filter-fields.tsx";
import { ratingAbbreviation } from "./position-name.tsx";
import { POSITION_GROUP_LABELS, TEXT } from "./text.ts";

/** A rating choice (ratingCodeOf) and a range of the OVR there. */
export const PositionRatingField = (props: {
  rating: PositionRating | undefined;
  positionName: (code: number) => string;
  change: (filters: FilterChange) => void;
}): JSX.Element => {
  const { rating, positionName, change } = props;
  return (
    <fieldset className="field">
      <legend>{TEXT.positionRating}</legend>
      <label className="field">
        <span>{TEXT.position}</span>
        <select
          value={rating?.code ?? ""}
          onChange={(event) => {
            const code = numberOrUndefined(event.currentTarget.value);
            change({ positionRating: code === undefined ? undefined : { ...rating, code } });
          }}
        >
          <option value="">{TEXT.anyOption}</option>
          {RATING_CHOICES.map(([code]) => (
            <option key={code} value={code}>
              {TEXT.ratingChoice(
                POSITION_GROUP_LABELS[positionOf(code).group],
                ratingAbbreviation(code, positionName),
              )}
            </option>
          ))}
        </select>
      </label>
      {rating === undefined ? null : (
        <RangeField
          label={TEXT.ratingAt(ratingAbbreviation(rating.code, positionName))}
          range={rating}
          onChange={(range) => {
            change({ positionRating: { ...range, code: rating.code } });
          }}
        />
      )}
    </fieldset>
  );
};
