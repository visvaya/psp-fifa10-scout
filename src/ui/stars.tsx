// Stars out of five for the values the game shows as stars, in halves; screen readers get the value as text
// instead, and so does everyone in forced colours, where the stars lose their fill.
import type { JSX } from "react";
import { TEXT } from "./text.ts";

const STAR_PLACES = [1, 2, 3, 4, 5] as const;
const STAR_PATH =
  "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z";
/** The star's left half, filled over the outline of a half star. */
const HALF_PATH = "M12 2.5L9.06 8.46l-6.58.96 4.76 4.64-1.12 6.55L12 17.52z";

type Fill = "full" | "half" | "empty";

/** One star, filled, half filled or outlined: the shapes tell them apart. */
const Star = ({ fill }: { fill: Fill }) => (
  <svg className={`star star-${fill}`} viewBox="0 0 24 24" focusable="false">
    <path d={STAR_PATH} />
    {fill === "half" ? <path className="star-half-fill" d={HALF_PATH} /> : null}
  </svg>
);

const fillAt = (value: number, place: number): Fill =>
  value >= place ? "full" : value >= place - 0.5 ? "half" : "empty";

/** The own list's mark: an outlined star in the list's colour (styles.css), apart from the game's filled one. */
export const WatchMark = (): JSX.Element => (
  <span className="watch-mark" aria-hidden="true">
    <Star fill="empty" />
  </span>
);

export const Stars = (props: { value: number }): JSX.Element => (
  <span>
    <span className="stars" aria-hidden="true">
      {STAR_PLACES.map((place) => (
        <Star key={place} fill={fillAt(props.value, place)} />
      ))}
    </span>
    <span className="visually-hidden stars-value">{TEXT.card.starsOutOfFive(props.value)}</span>
  </span>
);
