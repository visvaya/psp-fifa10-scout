// The filter controls: a collapsible section, a range, a multiple choice (searchable when long) and a
// yes / no / any choice. Each takes its value and reports a new one; the form maps them to filters.
import { useId, useLayoutEffect, useReducer, useRef, useState } from "react";
import type { JSX, ReactNode } from "react";
import type { Range } from "../logic/filter-players.ts";
import { searchKey } from "../logic/players.ts";
import { caretAfterDigits, editGrouped } from "./grouped-number.ts";
import { formatNumber, TEXT } from "./text.ts";

/** A field's explanation under its name, linked to the field for screen readers. */
const useFieldHelp = (help: string | undefined) => {
  const id = useId();
  return {
    describedBy: help === undefined ? undefined : id,
    note:
      help === undefined ? null : (
        <p id={id} className="help">
          {help}
        </p>
      ),
  };
};

/**
 * A field's name, with a button that clears the field while it filters (owner, 2026-11-05). The group
 * takes its name from the name alone (labelId), so the button does not join it.
 */
const FieldLegend = (props: {
  labelId: string;
  label: string;
  filtering: boolean;
  onClear: () => void;
}) => (
  <legend className="field-legend">
    <span id={props.labelId}>{props.label}</span>
    {props.filtering ? (
      <button
        type="button"
        className="field-clear"
        aria-label={TEXT.clearFieldLabel(props.label)}
        onClick={(event) => {
          // The button goes with the filter: keep the keyboard in the field, on its search box or its
          // first value, which stay (a chosen value outside the search would go with the clear).
          event.currentTarget
            .closest("fieldset")
            ?.querySelector<HTMLInputElement>("input[type='search'], .choices input, .range input")
            ?.focus();
          props.onClear();
        }}
      >
        {TEXT.clearField}
      </button>
    ) : null}
  </legend>
);

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

/**
 * A whole number shown with its digits grouped ("1 000 000") while it is typed; the caret stays after the
 * same digit when the field regroups them.
 */
const GroupedInput = (props: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) => {
  const input = useRef<HTMLInputElement>(null);
  // Digits before the caret at the last keystroke, null when the field changed otherwise.
  const caret = useRef<number | null>(null);
  // Each keystroke renders, so an edit that changes no digit (a letter typed) still puts the caret back;
  // React then restores the grouped text.
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const text = props.value === undefined ? "" : formatNumber(props.value);
  useLayoutEffect(() => {
    const element = input.current;
    if (element === null || caret.current === null) return;
    const position = caretAfterDigits(text, caret.current);
    element.setSelectionRange(position, position);
    caret.current = null;
  });
  return (
    <input
      ref={input}
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(event) => {
        const { value, selectionStart } = event.currentTarget;
        const { nativeEvent } = event;
        const typed = editGrouped({
          shown: text,
          typed: value,
          caret: selectionStart ?? value.length,
          inputType: nativeEvent instanceof InputEvent ? nativeEvent.inputType : "",
        });
        caret.current = typed.digitsBeforeCaret;
        rerender();
        props.onChange(typed.value);
      }}
    />
  );
};

export const RangeField = (props: {
  label: string;
  range: Range | undefined;
  /** Accepts values below zero, as a difference does. */
  allowNegative?: boolean;
  /** Large amounts (price, wage): digits grouped while typed, in wider fields. */
  grouped?: boolean;
  /** One decimal (a match rating): steps of 0.1 and a keyboard with the decimal separator. */
  decimal?: boolean;
  help?: string | undefined;
  onChange: (range: Range) => void;
}): JSX.Element => {
  const range = props.range ?? {};
  const grouped = props.grouped === true;
  const { describedBy, note } = useFieldHelp(props.help);
  const labelId = useId();
  return (
    <fieldset className="field" aria-labelledby={labelId} aria-describedby={describedBy}>
      <FieldLegend
        labelId={labelId}
        label={props.label}
        filtering={range.min !== undefined || range.max !== undefined}
        onClear={() => {
          props.onChange({});
        }}
      />
      {note}
      <div className={grouped ? "range grouped" : "range"}>
        {(["min", "max"] as const).map((bound) => (
          <label key={bound} className="range-input">
            <span>{TEXT[bound]}</span>
            {grouped ? (
              <GroupedInput
                value={range[bound]}
                onChange={(value) => {
                  props.onChange({ ...range, [bound]: value });
                }}
              />
            ) : (
              <input
                type="number"
                inputMode={props.decimal === true ? "decimal" : "numeric"}
                step={props.decimal === true ? 0.1 : undefined}
                min={props.allowNegative === true ? undefined : 0}
                value={range[bound] ?? ""}
                onChange={(event) => {
                  props.onChange({
                    ...range,
                    [bound]: numberOrUndefined(event.currentTarget.value),
                  });
                }}
              />
            )}
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

/** Turns a list round to everyone but its chosen values; shown once a value is chosen. */
const ExcludeToggle = (props: { excluded: boolean; onChange: (excluded: boolean) => void }) => (
  <label className="check">
    <input
      type="checkbox"
      checked={props.excluded}
      onChange={(event) => {
        props.onChange(event.currentTarget.checked);
      }}
    />
    {TEXT.excludeChosen}
  </label>
);

/** The checkboxes of a choice field, a scrolling box when the list is long. */
const ChoiceList = <T extends string | number>(props: {
  shown: readonly Choice<T>[];
  chosen: readonly T[];
  long: boolean;
  onChange: (chosen: readonly T[]) => void;
}) => (
  <div className={props.long ? "choices long" : "choices"}>
    {props.shown.map((choice) => (
      <label key={choice.value} className="check">
        <input
          type="checkbox"
          checked={props.chosen.includes(choice.value)}
          onChange={(event) => {
            props.onChange(
              event.currentTarget.checked
                ? [...props.chosen, choice.value]
                : props.chosen.filter((value) => value !== choice.value),
            );
          }}
        />
        {choice.label}
      </label>
    ))}
  </div>
);

export const ChoiceField = <T extends string | number>(props: {
  label: string;
  choices: readonly Choice<T>[];
  chosen: readonly T[] | undefined;
  onChange: (chosen: readonly T[]) => void;
  excluded: boolean;
  onExcludedChange: (excluded: boolean) => void;
  help?: string | undefined;
}): JSX.Element => {
  const { label, choices, onChange } = props;
  const chosen = props.chosen ?? [];
  const [query, setQuery] = useState("");
  const { describedBy, note } = useFieldHelp(props.help);
  const labelId = useId();
  const wanted = searchKey(query.trim());
  const searchable = choices.length > SEARCH_FROM_CHOICES;
  const shown =
    wanted === ""
      ? choices
      : choices.filter(
          (choice) => chosen.includes(choice.value) || searchKey(choice.label).includes(wanted),
        );
  return (
    <fieldset className="field" aria-labelledby={labelId} aria-describedby={describedBy}>
      <FieldLegend
        labelId={labelId}
        label={label}
        filtering={chosen.length > 0}
        onClear={() => {
          onChange([]);
        }}
      />
      {note}
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
      {chosen.length === 0 ? null : (
        <ExcludeToggle excluded={props.excluded} onChange={props.onExcludedChange} />
      )}
      <ChoiceList shown={shown} chosen={chosen} long={searchable} onChange={onChange} />
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
