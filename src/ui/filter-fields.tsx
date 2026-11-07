// The filter controls: a collapsible section, a range, a multiple choice (searchable when long) and a
// yes / no / any choice. Each takes its value and reports a new one; the form maps them to filters.
import { useId, useLayoutEffect, useReducer, useRef, useState } from "react";
import type { JSX, ReactNode } from "react";
import { bounded } from "../logic/filter-players.ts";
import type { Range } from "../logic/filter-players.ts";
import { searchKey } from "../logic/players.ts";
import { ColumnEye } from "./column-eye.tsx";
import { FieldHelp, OptionalHelp } from "./field-help.tsx";
import type { ColumnToggle } from "./column-eye.tsx";
import { caretAfterDigits, editGrouped } from "./grouped-number.ts";
import { decimalText } from "./decimal-text.ts";
import { DECIMAL_SEPARATOR, formatNumber, TEXT } from "./text.ts";

/**
 * A field's name, with its explanation, the eye of its column and a button that clears the field while it
 * filters (owner, 2026-11-05). The group takes its name from the name alone (labelId), so the buttons do
 * not join it.
 */
const FieldLegend = (props: {
  labelId: string;
  label: string;
  help: string | undefined;
  filtering: boolean;
  column: ColumnToggle | undefined;
  onClear: () => void;
}) => (
  <legend className="field-legend">
    <span id={props.labelId}>{props.label}</span>
    <OptionalHelp label={props.label} help={props.help} />
    <ColumnEye label={props.label} column={props.column} />
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

/**
 * A details element whose content renders only while open, so closed sections cost nothing. A section's
 * explanation opens from a "?" laid over the summary's line, after its name: a summary cannot hold a
 * button, and a closed details element hides all but its summary.
 */
export const Section = (props: {
  title: string;
  initiallyOpen?: boolean;
  help?: string;
  children: ReactNode;
}): JSX.Element => {
  const [open, setOpen] = useState(props.initiallyOpen === true);
  const details = (
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
  return props.help === undefined ? (
    details
  ) : (
    <div className="filter-section-with-help">
      {/* An unseen copy of the marker and name (CSS content, so no second text) puts the "?" after it. */}
      <span className="section-help">
        <span className="section-help-spacer" data-title={props.title} />
        <FieldHelp label={props.title} text={props.help} />
      </span>
      {details}
    </div>
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

const decimalShown = (value: number | undefined): string =>
  value === undefined ? "" : String(value).replace(".", DECIMAL_SEPARATOR);

/**
 * A decimal typed with the interface language's separator, which replaces a typed dot or comma at once
 * (decimal-text.ts). A value set from outside (a clear, a loaded set) replaces what was typed.
 */
const DecimalInput = (props: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) => {
  const [text, setText] = useState(decimalShown(props.value));
  const [seen, setSeen] = useState(props.value);
  const input = useRef<HTMLInputElement>(null);
  // Where the caret goes once the typed text is normalized, null when nothing was typed.
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caret.current === null) return;
    input.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });
  if (props.value !== seen) {
    setSeen(props.value);
    if (decimalText(text, DECIMAL_SEPARATOR).value !== props.value)
      setText(decimalShown(props.value));
  }
  return (
    <input
      ref={input}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        const { value, selectionStart } = event.currentTarget;
        const typed = decimalText(value, DECIMAL_SEPARATOR);
        // The text before the caret, normalized alone, ends where the caret belongs.
        caret.current = decimalText(
          value.slice(0, selectionStart ?? value.length),
          DECIMAL_SEPARATOR,
        ).text.length;
        setText(typed.text);
        props.onChange(typed.value);
      }}
    />
  );
};

/** One bound of a range: grouped digits, a decimal or a whole number. */
const BoundInput = (props: {
  kind: "grouped" | "decimal" | "whole";
  allowNegative: boolean;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) => {
  if (props.kind === "grouped")
    return <GroupedInput value={props.value} onChange={props.onChange} />;
  if (props.kind === "decimal")
    return <DecimalInput value={props.value} onChange={props.onChange} />;
  return (
    <input
      type="number"
      inputMode="numeric"
      min={props.allowNegative ? undefined : 0}
      value={props.value ?? ""}
      onChange={(event) => {
        props.onChange(numberOrUndefined(event.currentTarget.value));
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
  /** A decimal (a match rating), typed with the interface language's separator. */
  decimal?: boolean;
  help?: string | undefined;
  /** The eye of the field's column; unset where it has none. */
  column?: ColumnToggle | undefined;
  onChange: (range: Range) => void;
}): JSX.Element => {
  const range = props.range ?? {};
  const grouped = props.grouped === true;
  const labelId = useId();
  return (
    <fieldset className="field" aria-labelledby={labelId}>
      <FieldLegend
        labelId={labelId}
        label={props.label}
        help={props.help}
        filtering={bounded(range)}
        column={props.column}
        onClear={() => {
          props.onChange({});
        }}
      />
      <div className={grouped ? "range grouped" : "range"}>
        {(["min", "max"] as const).map((bound) => (
          <label key={bound} className="range-input">
            <span>{TEXT[bound]}</span>
            <BoundInput
              kind={grouped ? "grouped" : props.decimal === true ? "decimal" : "whole"}
              allowNegative={props.allowNegative === true}
              value={range[bound]}
              onChange={(value) => {
                props.onChange({ ...range, [bound]: value });
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
  /** Shown after the label, such as a style's curve. */
  readonly mark?: JSX.Element | null;
}

/** One checkbox with its explanation behind a "?" after it. */
export const CheckField = (props: {
  label: string;
  checked: boolean;
  help: string;
  onChange: (checked: boolean) => void;
}): JSX.Element => {
  return (
    <div className="check-help">
      <label className="check">
        <input
          type="checkbox"
          checked={props.checked}
          onChange={(event) => {
            props.onChange(event.currentTarget.checked);
          }}
        />
        {props.label}
      </label>
      <FieldHelp label={props.label} text={props.help} />
    </div>
  );
};

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
        {choice.mark}
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
  /** The eye of the field's column; unset where it has none. */
  column?: ColumnToggle | undefined;
}): JSX.Element => {
  const { label, choices, onChange } = props;
  const chosen = props.chosen ?? [];
  const [query, setQuery] = useState("");
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
    <fieldset className="field" aria-labelledby={labelId}>
      <FieldLegend
        labelId={labelId}
        label={label}
        help={props.help}
        filtering={chosen.length > 0}
        column={props.column}
        onClear={() => {
          onChange([]);
        }}
      />
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

/** A yes / no / any choice; its name in a label of its own, so the "?" after it stays outside it. */
export const FlagField = (props: {
  label: string;
  help: string | undefined;
  wanted: boolean | undefined;
  onChange: (wanted: boolean | undefined) => void;
}): JSX.Element => {
  const id = useId();
  return (
    <div className="field">
      <div className="field-legend">
        <label htmlFor={id}>{props.label}</label>
        <OptionalHelp label={props.label} help={props.help} />
      </div>
      <select
        id={id}
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
    </div>
  );
};
