import type { JSX } from "react";
import { attributeBand } from "../logic/scout-state.ts";

/** A rating with its colour band; the number is always shown, the colour only adds to it. */
export const AttributeValue = ({ value }: { readonly value: number }): JSX.Element => (
  <span className={`rating rating-${attributeBand(value)}`}>{value}</span>
);
