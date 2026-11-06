import type { ReactNode } from "react";

/** Label and value pairs as a description list. */
export const Facts = ({ facts }: { facts: readonly (readonly [string, ReactNode])[] }) => (
  <dl className="facts">
    {facts.map(([label, value]) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    ))}
  </dl>
);
