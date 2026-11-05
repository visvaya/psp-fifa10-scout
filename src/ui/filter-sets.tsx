// Named filter sets: the current filters and sort saved under a name, then loaded, renamed or deleted.
import { useEffect, useId, useRef, useState } from "react";
import type { Dispatch, JSX, Ref } from "react";
import type { FilterSet } from "../logic/saved-filters.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import { Section } from "./filter-fields.tsx";
import { FILTER_SETS_TEXT } from "./filter-sets-text.ts";

/** A button named for its set as well, so the list's buttons tell apart for screen readers. */
const SetButton = ({
  label,
  set,
  onClick,
  ref,
}: {
  label: string;
  set: string;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}) => (
  <button ref={ref} type="button" className="button" onClick={onClick}>
    {label}
    <span className="visually-hidden">{FILTER_SETS_TEXT.of(set)}</span>
  </button>
);

/** Why a new name cannot be taken, or null when it can. */
const nameProblem = (name: string, set: FilterSet, names: readonly string[]): string | null => {
  const trimmed = name.trim();
  if (trimmed === "") return FILTER_SETS_TEXT.emptyName;
  return trimmed !== set.name && names.includes(trimmed) ? FILTER_SETS_TEXT.takenName : null;
};

/**
 * The editor of a set's name, focused as it opens; a refused name keeps it open with the reason.
 * onDone gets the set's name afterwards, for the focus to return to that set's row.
 */
const RenameEditor = (props: {
  set: FilterSet;
  names: readonly string[];
  dispatch: Dispatch<ScoutAction>;
  onDone: (name: string) => void;
}) => {
  const { set, names, dispatch, onDone } = props;
  const [name, setName] = useState(set.name);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const problemId = useId();
  useEffect(() => {
    input.current?.focus();
  }, []);
  return (
    <li className="filter-set">
      <label className="field">
        <span>{FILTER_SETS_TEXT.newName(set.name)}</span>
        <input
          ref={input}
          type="text"
          value={name}
          aria-invalid={problem !== null}
          aria-describedby={problem === null ? undefined : problemId}
          onChange={(event) => {
            setName(event.currentTarget.value);
            // The reason was for the name refused; a new name has none until it is saved.
            setProblem(null);
          }}
        />
      </label>
      {problem === null ? null : (
        <p id={problemId} className="error" role="alert">
          {problem}
        </p>
      )}
      <SetButton
        label={FILTER_SETS_TEXT.saveName}
        set={set.name}
        onClick={() => {
          const refused = nameProblem(name, set, names);
          setProblem(refused);
          if (refused !== null) {
            input.current?.focus();
            return;
          }
          dispatch({ type: "filter-set-renamed", from: set.name, to: name });
          onDone(name.trim());
        }}
      />
      <SetButton
        label={FILTER_SETS_TEXT.cancel}
        set={set.name}
        onClick={() => {
          onDone(set.name);
        }}
      />
    </li>
  );
};

/** One set's row; with `focus`, its rename button takes the focus back after editing. */
const SetItem = (props: {
  set: FilterSet;
  names: readonly string[];
  focus: boolean;
  dispatch: Dispatch<ScoutAction>;
  onRenameDone: (name: string) => void;
}) => {
  const { set, names, focus, dispatch, onRenameDone } = props;
  const [editing, setEditing] = useState(false);
  const rename = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focus && !editing) rename.current?.focus();
  }, [focus, editing]);
  if (editing) {
    return (
      <RenameEditor
        set={set}
        names={names}
        dispatch={dispatch}
        onDone={(name) => {
          setEditing(false);
          onRenameDone(name);
        }}
      />
    );
  }
  return (
    <li className="filter-set">
      <span className="filter-set-name">{set.name}</span>
      <SetButton
        label={FILTER_SETS_TEXT.load}
        set={set.name}
        onClick={() => {
          dispatch({ type: "filter-set-loaded", name: set.name });
        }}
      />
      <SetButton
        ref={rename}
        label={FILTER_SETS_TEXT.rename}
        set={set.name}
        onClick={() => {
          setEditing(true);
        }}
      />
      <SetButton
        label={FILTER_SETS_TEXT.remove}
        set={set.name}
        onClick={() => {
          dispatch({ type: "filter-set-deleted", name: set.name });
        }}
      />
    </li>
  );
};

/** The name field and its save button: overwriting a set of the same name says so first. */
const SaveSet = ({
  sets,
  dispatch,
}: {
  sets: readonly FilterSet[];
  dispatch: Dispatch<ScoutAction>;
}) => {
  const [name, setName] = useState("");
  const taken = sets.some((set) => set.name === name.trim());
  return (
    <>
      <label className="field">
        <span>{FILTER_SETS_TEXT.name}</span>
        <input
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
        />
      </label>
      {taken ? <p className="help">{FILTER_SETS_TEXT.overwriteNote}</p> : null}
      <button
        type="button"
        className="button"
        disabled={name.trim() === ""}
        onClick={() => {
          dispatch({ type: "filter-set-saved", name });
          setName("");
        }}
      >
        {taken ? FILTER_SETS_TEXT.overwrite : FILTER_SETS_TEXT.save}
      </button>
    </>
  );
};

export const FilterSets = (props: {
  sets: readonly FilterSet[];
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => {
  const { sets, dispatch } = props;
  // The set whose row takes the focus back once its name editor closes.
  const [focusName, setFocusName] = useState<string | null>(null);
  const names = sets.map((set) => set.name);
  return (
    <Section title={FILTER_SETS_TEXT.title}>
      <SaveSet sets={sets} dispatch={dispatch} />
      {sets.length === 0 ? (
        <p className="help">{FILTER_SETS_TEXT.none}</p>
      ) : (
        <ul className="filter-sets">
          {sets.map((set) => (
            <SetItem
              key={set.name}
              set={set}
              names={names}
              focus={focusName === set.name}
              dispatch={dispatch}
              onRenameDone={setFocusName}
            />
          ))}
        </ul>
      )}
    </Section>
  );
};
