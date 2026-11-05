// Stars out of five, filled to the half as the game shows a club's (team-stars.ts); screen readers get
// the value as text instead, and so does everyone in forced colours, where the stars lose their fill.
import type { JSX } from "react";
import { TEXT } from "./text.ts";

const STAR_PLACES = [1, 2, 3, 4, 5] as const;

/** How full the star at a place (1..5) is for a value in half stars. */
const fill = (value: number, place: number): "full" | "half" | "empty" =>
  value >= place ? "full" : value >= place - 0.5 ? "half" : "empty";

export const Stars = (props: { value: number }): JSX.Element => (
  <span>
    <span className="stars" aria-hidden="true">
      {STAR_PLACES.map((place) => (
        <span key={place} className={`star-${fill(props.value, place)}`}>
          {TEXT.starMark}
        </span>
      ))}
    </span>
    <span className="visually-hidden stars-value">{TEXT.card.starsOutOfFive(props.value)}</span>
  </span>
);
