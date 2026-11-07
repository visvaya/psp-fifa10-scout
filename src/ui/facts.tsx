import type { ReactNode } from "react";
import { OptionalHelp } from "./field-help.tsx";

/** A label, its value, the label's explanation, if any, and a note on its own line under the value. */
export type Fact = readonly [string, ReactNode, (string | undefined)?, ReactNode?];

/** Label and value pairs as a description list; a label with an explanation gets its "?". */
export const Facts = ({ facts }: { facts: readonly Fact[] }) => (
  <dl className="facts">
    {facts.map(([label, value, help, note]) => (
      <div key={label}>
        <dt>
          {label}
          <OptionalHelp label={label} help={help} />
        </dt>
        <dd>{value}</dd>
        {note !== undefined && <dd className="fact-note">{note}</dd>}
      </div>
    ))}
  </dl>
);
