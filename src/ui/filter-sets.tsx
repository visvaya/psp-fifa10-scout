// Named filter sets: the current filters and sort saved under a name, then loaded, renamed or deleted.
import { useState } from "react";
import type { Dispatch, JSX } from "react";
import type { FilterSet } from "../logic/saved-filters.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import { Section } from "./filter-fields.tsx";
import { TEXT } from "./text.ts";

/** A button named for its set as well, so the list's buttons tell apart for screen readers. */
const SetButton = (props: { label: string; set: string; onClick: () => void }) => (
  <button type="button" className="button" onClick={props.onClick}>
    {props.label}
    <span className="visually-hidden">{TEXT.filterSets.of(props.set)}</span>
  </button>
);

const SetItem = ({ set, dispatch }: { set: FilterSet; dispatch: Dispatch<ScoutAction> }) => {
  const [renaming, setRenaming] = useState<string | null>(null);
  if (renaming !== null) {
    return (
      <li className="filter-set">
        <label className="field">
          <span>{TEXT.filterSets.newName(set.name)}</span>
          <input
            type="text"
            value={renaming}
            onChange={(event) => {
              setRenaming(event.currentTarget.value);
            }}
          />
        </label>
        <SetButton
          label={TEXT.filterSets.saveName}
          set={set.name}
          onClick={() => {
            dispatch({ type: "filter-set-renamed", from: set.name, to: renaming });
            setRenaming(null);
          }}
        />
        <SetButton
          label={TEXT.filterSets.cancel}
          set={set.name}
          onClick={() => {
            setRenaming(null);
          }}
        />
      </li>
    );
  }
  return (
    <li className="filter-set">
      <span className="filter-set-name">{set.name}</span>
      <SetButton
        label={TEXT.filterSets.load}
        set={set.name}
        onClick={() => {
          dispatch({ type: "filter-set-loaded", name: set.name });
        }}
      />
      <SetButton
        label={TEXT.filterSets.rename}
        set={set.name}
        onClick={() => {
          setRenaming(set.name);
        }}
      />
      <SetButton
        label={TEXT.filterSets.remove}
        set={set.name}
        onClick={() => {
          dispatch({ type: "filter-set-deleted", name: set.name });
        }}
      />
    </li>
  );
};

export const FilterSets = (props: {
  sets: readonly FilterSet[];
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => {
  const { sets, dispatch } = props;
  const [name, setName] = useState("");
  const taken = sets.some((set) => set.name === name.trim());
  return (
    <Section title={TEXT.filterSets.title}>
      <label className="field">
        <span>{TEXT.filterSets.name}</span>
        <input
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
        />
      </label>
      {taken ? <p className="help">{TEXT.filterSets.overwriteNote}</p> : null}
      <button
        type="button"
        className="button"
        disabled={name.trim() === ""}
        onClick={() => {
          dispatch({ type: "filter-set-saved", name });
          setName("");
        }}
      >
        {taken ? TEXT.filterSets.overwrite : TEXT.filterSets.save}
      </button>
      {sets.length === 0 ? (
        <p className="help">{TEXT.filterSets.none}</p>
      ) : (
        <ul className="filter-sets">
          {sets.map((set) => (
            <SetItem key={set.name} set={set} dispatch={dispatch} />
          ))}
        </ul>
      )}
    </Section>
  );
};
