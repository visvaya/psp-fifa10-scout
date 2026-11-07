// The filter fields of the form that are more than one control: the contract year with its eye, and the
// attribute ranges the user adds from a list.
import { useId, useState } from "react";
import type { Range } from "../logic/filter-players.ts";
import { ATTRIBUTE_NAMES } from "../logic/players.ts";
import type { AttributeName } from "../logic/players.ts";
import type { ScoutFilters } from "../logic/scout-state.ts";
import { ColumnEye } from "./column-eye.tsx";
import type { ColumnToggle, Eye } from "./column-eye.tsx";
import { numberOrUndefined, RangeField } from "./filter-fields.tsx";
import { TEXT } from "./text.ts";
import { ATTRIBUTE_LABELS } from "./text-attributes.ts";

export const ContractField = (props: {
  years: readonly number[];
  range: Range | undefined;
  column: ColumnToggle | undefined;
  onChange: (range: Range) => void;
}) => {
  const id = useId();
  return (
    <div className="field">
      <div className="field-legend">
        <label htmlFor={id}>{TEXT.contractEndsBy}</label>
        <ColumnEye label={TEXT.contractEndsBy} column={props.column} />
      </div>
      <select
        id={id}
        value={props.range?.max ?? ""}
        onChange={(event) => {
          props.onChange({ max: numberOrUndefined(event.currentTarget.value) });
        }}
      >
        <option value="">{TEXT.anyOption}</option>
        {props.years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
};

/** Ranges for the attributes the user adds from a list, instead of one input pair per attribute. */
export const AttributeRanges = (props: {
  ranges: ScoutFilters["ranges"];
  eye: Eye;
  onChange: (name: AttributeName, range: Range | undefined) => void;
}) => {
  const [added, setAdded] = useState<readonly AttributeName[]>([]);
  const shown = ATTRIBUTE_NAMES.filter(
    (name) => added.includes(name) || props.ranges?.[name] !== undefined,
  );
  return (
    <>
      {shown.map((name) => (
        <div key={name} className="attribute-range">
          <RangeField
            label={ATTRIBUTE_LABELS[name]}
            range={props.ranges?.[name]}
            column={props.eye(name)}
            onChange={(range) => {
              // A field being edited stays until removed: clearing its value to type a new one
              // drops the empty range from the filters, which alone would take the field away.
              if (!added.includes(name)) setAdded([...added, name]);
              props.onChange(name, range);
            }}
          />
          <button
            type="button"
            className="button"
            aria-label={TEXT.removeAttribute(ATTRIBUTE_LABELS[name])}
            onClick={() => {
              setAdded(added.filter((item) => item !== name));
              props.onChange(name, undefined);
            }}
          >
            {TEXT.removeMark}
          </button>
        </div>
      ))}
      <label className="field">
        <span>{TEXT.addAttribute}</span>
        <select
          value=""
          onChange={(event) => {
            const name = ATTRIBUTE_NAMES.find((item) => item === event.currentTarget.value);
            if (name !== undefined) setAdded([...added, name]);
          }}
        >
          <option value="">{TEXT.chooseAttribute}</option>
          {ATTRIBUTE_NAMES.filter((name) => !shown.includes(name)).map((name) => (
            <option key={name} value={name}>
              {ATTRIBUTE_LABELS[name]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
};
