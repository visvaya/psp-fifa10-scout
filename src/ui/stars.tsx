// Stars out of five, filled to the half as the game shows them; screen readers get the value as text
// instead, and so does everyone in forced colours, where the stars lose their fill.
import { useId } from "react";
import type { JSX } from "react";
import { TEXT } from "./text.ts";

const STAR_PLACES = [1, 2, 3, 4, 5] as const;
const STAR_PATH =
  "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z";

/** How full the star at a place (1..5) is for a value in half stars. */
const fill = (value: number, place: number): "full" | "half" | "empty" =>
  value >= place ? "full" : value >= place - 0.5 ? "half" : "empty";

/** One star: filled, outlined, or outlined with its left half filled; the shapes tell them apart. */
const Star = ({ kind }: { kind: "full" | "half" | "empty" }) => {
  const clipId = useId();
  return (
    <svg className={`star star-${kind}`} viewBox="0 0 24 24" focusable="false">
      {kind === "half" ? (
        <clipPath id={clipId}>
          <rect width="12" height="24" />
        </clipPath>
      ) : null}
      <path d={STAR_PATH} />
      {kind === "half" ? (
        <path className="star-fill" d={STAR_PATH} clipPath={`url(#${clipId})`} />
      ) : null}
    </svg>
  );
};

export const Stars = (props: { value: number }): JSX.Element => (
  <span>
    <span className="stars" aria-hidden="true">
      {STAR_PLACES.map((place) => (
        <Star key={place} kind={fill(props.value, place)} />
      ))}
    </span>
    <span className="visually-hidden stars-value">{TEXT.card.starsOutOfFive(props.value)}</span>
  </span>
);
