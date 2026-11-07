import type { ReactNode } from "react";
import { OptionalHelp } from "./field-help.tsx";

/** Label and value pairs as a description list; a label with an explanation gets its "?". */
export const Facts = ({
  facts,
}: {
  facts: readonly (readonly [string, ReactNode, (string | undefined)?])[];
}) => (
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
