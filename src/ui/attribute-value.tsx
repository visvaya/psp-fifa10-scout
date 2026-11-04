import type { JSX } from "react";
import { attributeBand } from "../logic/scout-state.ts";
import { TEXT } from "./text.ts";

/** A rating with its colour band; the number is always shown, the colour only adds to it. */
export const AttributeValue = ({ value }: { readonly value: number }): JSX.Element => (
  <span className={`rating rating-${attributeBand(value)}`}>{value}</span>
);

/** A gain over the OVR with its sign: green above, red below, grey at none; bracketed on the card. */
export const GainValue = (props: { readonly value: number; readonly bracketed?: boolean }) => {
  const { value, bracketed = false } = props;
  const direction = value > 0 ? "up" : value < 0 ? "down" : "none";
  return (
    <span className={`gain gain-${direction}`}>
      {bracketed ? TEXT.card.gain(value) : TEXT.signed(value)}
    </span>
  );
};
