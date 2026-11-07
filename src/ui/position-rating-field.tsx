// The position rating filter: one choice per way the game rates a position, a range of the OVR there,
// one of its gain over the OVR and, with a career and potential shown, one of the peak there.
import { useId } from "react";
import type { JSX } from "react";
import type { PositionRating } from "../logic/filter-players.ts";
import { RATING_CHOICES } from "../logic/positions.ts";
import type { FilterChange } from "../logic/scout-state.ts";
import type { Eye } from "./column-eye.tsx";
import { OptionalHelp } from "./field-help.tsx";
import { CheckField, numberOrUndefined, RangeField } from "./filter-fields.tsx";
import { ratingAbbreviation, ratingChoiceName } from "./position-name.tsx";
import { HELP_TEXT } from "./text-help.ts";
import { TEXT } from "./text.ts";

/** The ranges of the chosen position: the OVR there, its gain over the OVR and, when shown, its peak. */
const RatingRanges = (props: {
  rating: PositionRating;
  /** The position's abbreviation in the game language. */
  abbreviation: string;
  peakShown: boolean;
  eye: Eye;
  change: (filters: FilterChange) => void;
}) => {
  const { rating, abbreviation, eye, change } = props;
  return (
    <>
      <RangeField
        label={TEXT.ratingAt(abbreviation)}
        range={rating}
        column={eye("positionRating")}
        onChange={(range) => {
          // The bounds are replaced whole, so clearing the range clears both; every other field stays.
          const { min: _min, max: _max, ...kept } = rating;
          change({ positionRating: { ...kept, ...range } });
        }}
      />
      <CheckField
        label={TEXT.bestPositionOnly}
        checked={rating.bestOnly === true}
        help={HELP_TEXT.bestPositionOnly}
        onChange={(bestOnly) => {
          change({ positionRating: { ...rating, bestOnly } });
        }}
      />
      <RangeField
        label={TEXT.ratingGain}
        help={HELP_TEXT.ratingGain}
        range={rating.gain}
        column={eye("ratingGain")}
        allowNegative
        onChange={(gain) => {
          change({ positionRating: { ...rating, gain } });
        }}
      />
      {props.peakShown ? (
        <RangeField
          label={TEXT.peakAt(abbreviation)}
          range={rating.peak}
          column={eye("positionPeak")}
          help={HELP_TEXT.ratingPeak}
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
  /** The eye of a column of the position rating; undefined for one without. */
  eye: Eye;
  change: (filters: FilterChange) => void;
}): JSX.Element => {
  const { rating, positionName, eye, change } = props;
  const legendId = useId();
  return (
    <fieldset className="field" aria-labelledby={legendId}>
      <legend className="field-legend">
        <span id={legendId}>{TEXT.positionRating}</span>
        <OptionalHelp label={TEXT.positionRating} help={HELP_TEXT.positionRating} />
      </legend>
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
          eye={eye}
          change={change}
        />
      )}
    </fieldset>
  );
};
