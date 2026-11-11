// The card's folded part: the OVR per rating choice with the positions each covers, shown or folded by
// one switch with an arrow.
import { useState } from "react";
import type { ReactNode } from "react";
import type { Player } from "../logic/players.ts";
import { nameTextIdOf, POSITION_CODES, RATING_CHOICES, ratingCodeOf } from "../logic/positions.ts";
import { AttributeValue, GainValue } from "./attribute-value.tsx";
import { ratingChoiceName } from "./position-name.tsx";
import type { PositionNames } from "./position-name.tsx";
import { CheckField } from "./filter-fields.tsx";
import { TEXT } from "./text.ts";
import { HELP_TEXT } from "./text-help.ts";

/** A switch with its arrow that shows or folds what it names. */
const FoldButton = (props: { open: boolean; onToggle: () => void; children: ReactNode }) => (
  <button type="button" className="sort-button" aria-expanded={props.open} onClick={props.onToggle}>
    {props.children}{" "}
    <span aria-hidden="true" className="sort-mark">
      {props.open ? TEXT.card.openMark : TEXT.card.closedMark}
    </span>
  </button>
);

/** The positions a rating choice covers, by their full names in the game language where it has them. */
const choicePositions = (code: number, names: PositionNames): string =>
  POSITION_CODES.filter(
    (other) => ratingCodeOf(other) === code && nameTextIdOf(other) !== undefined,
  )
    .map((other) => {
      const full = names.full(other);
      return full === undefined
        ? names.short(other)
        : TEXT.card.positionWithName(full, names.abbreviation(other));
    })
    .join(TEXT.rowMetaSeparator);

/** The projected peak beside a rating, after a separator; nothing where there is none. */
const PeakValue = (props: { peak: number | undefined }) =>
  props.peak === undefined ? null : (
    <span className="peak-value">
      {TEXT.rowMetaSeparator}
      {TEXT.card.peakAtChoice(props.peak)}
    </span>
  );

/**
 * OVR per rating choice, after the gain over the OVR so the ratings line up; one switch at the heading shows the positions
 * each choice covers.
 */
export const ChoiceRatings = (props: {
  player: Player;
  names: PositionNames;
  /** The peaks reveal potential: the checkbox shows only while the list shows potential. */
  showPotential: boolean;
}) => {
  const { player, names } = props;
  const [open, setOpen] = useState(false);
  const [peaks, setPeaks] = useState(false);
  const peaksOffered = props.showPotential && player.peakByCode.length > 0;
  return (
    <section aria-labelledby="overall-title">
      <h3 id="overall-title">
        <FoldButton
          open={open}
          onToggle={() => {
            setOpen(!open);
          }}
        >
          {TEXT.card.overallByGroup}
        </FoldButton>
      </h3>
      {peaksOffered ? (
        <CheckField
          label={TEXT.card.showPeaks}
          checked={peaks}
          help={HELP_TEXT.positionPeaks}
          onChange={setPeaks}
        />
      ) : null}
      <dl className="facts">
        {RATING_CHOICES.map(([code]) => {
          const rating = player.overallByCode[code] ?? null;
          return (
            <div key={code}>
              <dt>
                {ratingChoiceName(code)}
                {open ? <p>{choicePositions(code, names)}</p> : null}
              </dt>
              <dd className="rated">
                {rating === null ? null : <GainValue value={rating - player.overall} bracketed />}
                {rating === null ? null : <AttributeValue value={rating} />}
                {peaksOffered && peaks ? <PeakValue peak={player.peakByCode[code]} /> : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
};
