import type { ReactNode } from "react";
import { FieldHelp } from "./field-help.tsx";
import { TEXT } from "./text.ts";

/** A label, its value, the label's explanation, if any, and a note on its own line under the value. */
export type Fact = readonly [string, ReactNode, (string | undefined)?, ReactNode?];

/**
 * A label with its "?" kept on the line of its last word, so the "?" never wraps onto a line of its own
 * (owner, 2026-11-14: the "?" stays in line with its name).
 */
const HelpedLabel = ({ label, help }: { label: string; help: string }) => {
  const cut = label.lastIndexOf(" ") + 1;
  return (
    <>
      {label.slice(0, cut)}
      <span className="label-end">
        {label.slice(cut)}
        <FieldHelp label={label} text={help} />
      </span>
    </>
  );
};

/** Label and value pairs as a description list; a label with an explanation gets its "?". */
export const Facts = ({ facts }: { facts: readonly Fact[] }) => (
  <dl className="facts">
    {facts.map(([label, value, help, note]) => (
      <div key={label}>
        <dt>{help === undefined ? label : <HelpedLabel label={label} help={help} />}</dt>
        <dd>{value}</dd>
        {note !== undefined && <dd className="fact-note">{note}</dd>}
      </div>
    ))}
  </dl>
);

export const yesNo = (value: boolean): string => (value ? TEXT.card.yes : TEXT.card.no);
