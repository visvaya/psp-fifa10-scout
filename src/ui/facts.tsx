import type { ReactNode } from "react";
import { OptionalHelp } from "./field-help.tsx";

/** A label, its value and the label's explanation, if any. */
export type Fact = readonly [string, ReactNode, (string | undefined)?];

/** Label and value pairs as a description list; a label with an explanation gets its "?". */
export const Facts = ({ facts }: { facts: readonly Fact[] }) => (
  <dl className="facts">
    {facts.map(([label, value, help]) => (
      <div key={label}>
        <dt>
          {label}
          <OptionalHelp label={label} help={help} />
        </dt>
        <dd>{value}</dd>
      </div>
    ))}
  </dl>
);
