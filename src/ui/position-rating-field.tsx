// The position rating filter: one choice per way the game rates a position, a range of the OVR there,
// one of its gain over the OVR and, with a career and potential shown, one of the peak there.
import { useId } from "react";
import type { JSX } from "react";
import type { PositionRating } from "../logic/filter-players.ts";
import { RATING_CHOICES } from "../logic/positions.ts";
import type { FilterChange } from "../logic/scout-state.ts";
import { numberOrUndefined, RangeField } from "./filter-fields.tsx";
import { ratingAbbreviation, ratingChoiceName } from "./position-name.tsx";
import { RATING_PEAK_HELP } from "./text-help.ts";
import { TEXT } from "./text.ts";

/** The ranges of the chosen position: the OVR there, its gain over the OVR and, when shown, its peak. */
const RatingRanges = (props: {
  rating: PositionRating;
  /** The position's abbreviation in the game language. */
  abbreviation: string;
  peakShown: boolean;
  change: (filters: FilterChange) => void;
}) => {
  const { rating, abbreviation, change } = props;
  return (
    <>
      <RangeField
        label={TEXT.ratingAt(abbreviation)}
        range={rating}
        onChange={(range) => {
          // The bounds are replaced whole, so clearing the range clears both.
          const { code, gain, peak } = rating;
          change({
            positionRating: {
              code,
              ...(gain === undefined ? {} : { gain }),
              ...(peak === undefined ? {} : { peak }),
              ...(rating.bestOnly === true ? { bestOnly: true } : {}),
              ...range,
            },
          });
        }}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={rating.bestOnly === true}
          onChange={(event) => {
            change({ positionRating: { ...rating, bestOnly: event.currentTarget.checked } });
          }}
        />
        {TEXT.bestPositionOnly}
      </label>
      <RangeField
        label={TEXT.ratingGain}
        range={rating.gain}
        allowNegative
        onChange={(gain) => {
          change({ positionRating: { ...rating, gain } });
        }}
      />
      {props.peakShown ? (
        <RangeField
          label={TEXT.peakAt(abbreviation)}
          range={rating.peak}
          help={RATING_PEAK_HELP}
          onChange={(peak) => {
            change({ positionRating: { ...rating, peak } });
          }}
        />
      ) : null}
    </>
  );
};

/** A rating choice (ratingCodeOf) and the ranges of that position. */
export const PositionRatingField = (props: {
  rating: PositionRating | undefined;
  positionName: (code: number) => string;
  /** The peak range: a career is loaded and potential shown. */
  peakShown: boolean;
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
        <RatingRanges
          rating={rating}
          abbreviation={ratingAbbreviation(rating.code, positionName)}
          peakShown={props.peakShown}
          change={change}
        />
      )}
    </fieldset>
  );
};
