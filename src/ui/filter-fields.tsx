// The filter controls: a collapsible section, a range, a multiple choice (searchable when long) and a
// yes / no / any choice. Each takes its value and reports a new one; the form maps them to filters.
import { useState } from "react";
import type { JSX, ReactNode } from "react";
import type { Range } from "../logic/filter-players.ts";
import { searchKey } from "../logic/players.ts";
import { TEXT } from "./text.ts";

/** Longer choice lists get a search box. */
const SEARCH_FROM_CHOICES = 12;

export const numberOrUndefined = (text: string): number | undefined =>
  text.trim() === "" || Number.isNaN(Number(text)) ? undefined : Number(text);

/** A details element whose content renders only while open, so closed sections cost nothing. */
export const Section = (props: {
  title: string;
  initiallyOpen?: boolean;
  children: ReactNode;
}): JSX.Element => {
  const [open, setOpen] = useState(props.initiallyOpen === true);
  return (
    <details
      className="filter-section"
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary>{props.title}</summary>
      {open ? <div className="filter-section-body">{props.children}</div> : null}
    </details>
  );
};

export const RangeField = (props: {
  label: string;
  range: Range | undefined;
  onChange: (range: Range) => void;
}): JSX.Element => {
  const range = props.range ?? {};
  return (
    <fieldset className="field">
      <legend>{props.label}</legend>
      <div className="range">
        {(["min", "max"] as const).map((bound) => (
          <label key={bound} className="range-input">
            <span>{TEXT[bound]}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={range[bound] ?? ""}
              onChange={(event) => {
                props.onChange({
                  ...range,
                  [bound]: numberOrUndefined(event.currentTarget.value),
                });
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export interface Choice<T> {
  readonly value: T;
  readonly label: string;
}

export const ChoiceField = <T extends string | number>(props: {
  label: string;
  choices: readonly Choice<T>[];
  chosen: readonly T[] | undefined;
  onChange: (chosen: readonly T[]) => void;
}): JSX.Element => {
  const { label, choices, onChange } = props;
  const chosen = props.chosen ?? [];
  const [query, setQuery] = useState("");
  const wanted = searchKey(query.trim());
  const searchable = choices.length > SEARCH_FROM_CHOICES;
  const shown =
    wanted === ""
      ? choices
      : choices.filter(
          (choice) => chosen.includes(choice.value) || searchKey(choice.label).includes(wanted),
        );
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      {searchable ? (
        <input
          type="search"
          aria-label={TEXT.searchIn(label)}
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
          }}
        />
      ) : null}
      <div className={searchable ? "choices long" : "choices"}>
        {shown.map((choice) => (
          <label key={choice.value} className="check">
            <input
              type="checkbox"
              checked={chosen.includes(choice.value)}
              onChange={(event) => {
                onChange(
                  event.currentTarget.checked
                    ? [...chosen, choice.value]
                    : chosen.filter((value) => value !== choice.value),
                );
              }}
            />
            {choice.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export const FlagField = (props: {
  label: string;
  wanted: boolean | undefined;
  onChange: (wanted: boolean | undefined) => void;
}): JSX.Element => (
  <label className="field flag">
    <span>{props.label}</span>
    <select
      value={props.wanted === undefined ? "" : props.wanted ? "yes" : "no"}
      onChange={(event) => {
        const { value } = event.currentTarget;
        props.onChange(value === "" ? undefined : value === "yes");
      }}
    >
      <option value="">{TEXT.flagValues.any}</option>
      <option value="yes">{TEXT.flagValues.yes}</option>
      <option value="no">{TEXT.flagValues.no}</option>
    </select>
  </label>
);
