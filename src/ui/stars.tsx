// Stars out of five for the 1..5 values the game shows as stars; screen readers get the value as text
// instead, and so does everyone in forced colours, where the stars lose their fill.
import type { JSX } from "react";
import { TEXT } from "./text.ts";

const STAR_PLACES = [1, 2, 3, 4, 5] as const;
const STAR_PATH =
  "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z";

/** One star, filled or outlined: the shapes tell them apart. */
const Star = ({ filled }: { filled: boolean }) => (
  <svg
    className={filled ? "star star-full" : "star star-empty"}
    viewBox="0 0 24 24"
    focusable="false"
  >
    <path d={STAR_PATH} />
  </svg>
);

export const Stars = (props: { value: number }): JSX.Element => (
  <span>
    <span className="stars" aria-hidden="true">
      {STAR_PLACES.map((place) => (
        <Star key={place} filled={props.value >= place} />
      ))}
    </span>
    <span className="visually-hidden stars-value">{TEXT.card.starsOutOfFive(props.value)}</span>
  </span>
);
