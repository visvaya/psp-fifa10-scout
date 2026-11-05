// The position rating filter: one choice per way the game rates a position, a range of the OVR there and
// one of its gain over the OVR.
import { useId } from "react";
import type { JSX } from "react";
import type { PositionRating } from "../logic/filter-players.ts";
import { RATING_CHOICES } from "../logic/positions.ts";
import type { FilterChange } from "../logic/scout-state.ts";
import { numberOrUndefined, RangeField } from "./filter-fields.tsx";
import { ratingAbbreviation, ratingChoiceName } from "./position-name.tsx";
import { TEXT } from "./text.ts";

/** A rating choice (ratingCodeOf), a range of the OVR there and one of its gain over the OVR. */
export const PositionRatingField = (props: {
  rating: PositionRating | undefined;
  positionName: (code: number) => string;
  change: (filters: FilterChange) => void;
}): JSX.Element => {
  const { rating, positionName, change } = props;
  const legendId = useId();
  return (
    <fieldset className="field">
      <legend id={legendId}>{TEXT.positionRating}</legend>
      {/* Named by the legend above it: one line, no second label (owner, 2026-11-05). */}
      <select
        aria-labelledby={legendId}
        value={rating?.code ?? ""}
        onChange={(event) => {
          const code = numberOrUndefined(event.currentTarget.value);
          change({ positionRating: code === undefined ? undefined : { ...rating, code } });
        }}
      >
        <option value="">{TEXT.anyOption}</option>
        {RATING_CHOICES.map(([code]) => (
          <option key={code} value={code}>
            {TEXT.ratingChoice(ratingChoiceName(code), ratingAbbreviation(code, positionName))}
          </option>
        ))}
      </select>
      {rating === undefined ? null : (
        <>
          <RangeField
            label={TEXT.ratingAt(ratingAbbreviation(rating.code, positionName))}
            range={rating}
            onChange={(range) => {
              // The bounds are replaced whole, so clearing the range clears both.
              const { code, gain } = rating;
              change({
                positionRating: { code, ...(gain === undefined ? {} : { gain }), ...range },
              });
            }}
          />
          <RangeField
            label={TEXT.ratingGain}
            range={rating.gain}
            allowNegative
            onChange={(gain) => {
              change({ positionRating: { ...rating, gain } });
            }}
          />
        </>
      )}
    </fieldset>
  );
};
