// Named filter sets: the current filters and sort saved under a name, then loaded, renamed or deleted.
import { useEffect, useId, useRef, useState } from "react";
import type { Dispatch, JSX, Ref } from "react";
import { checkSetName } from "../logic/saved-filters.ts";
import type { FilterSet, SetNameCheck } from "../logic/saved-filters.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import { Section } from "./filter-fields.tsx";
import { FILTER_SETS_TEXT } from "./text-filter-sets.ts";

/** A button named for its set as well, so the list's buttons tell apart for screen readers. */
const SetButton = ({
  label,
  set,
  onClick,
  ref,
  describedBy,
}: {
  label: string;
  set: string;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
  /** The id of a text the button acts on, read with it (a question it answers). */
  describedBy?: string;
}) => (
  <button
    ref={ref}
    type="button"
    className="button"
    aria-describedby={describedBy}
    onClick={onClick}
  >
    {label}
    <span className="visually-hidden">{FILTER_SETS_TEXT.of(set)}</span>
  </button>
);

/** Why a name cannot be taken. */
const NAME_PROBLEMS: Record<Extract<SetNameCheck, { ok: false }>["error"], string> = {
  empty: FILTER_SETS_TEXT.emptyName,
  taken: FILTER_SETS_TEXT.takenName,
};

/**
 * The editor of a set's name, focused as it opens; a refused name keeps it open with the reason.
 * onDone gets the set's name afterwards, for the focus to return to that set's row.
 */
const RenameEditor = (props: {
  set: FilterSet;
  sets: readonly FilterSet[];
  dispatch: Dispatch<ScoutAction>;
  onDone: (name: string) => void;
}) => {
  const { set, sets, dispatch, onDone } = props;
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
          const check = checkSetName(sets, name, set.name);
          setProblem(check.ok ? null : NAME_PROBLEMS[check.error]);
          if (!check.ok) {
            input.current?.focus();
            return;
          }
          dispatch({ type: "filter-set-renamed", from: set.name, to: name });
          onDone(check.name);
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

/** Asks before a set takes the current filters and sort; the confirm button takes the focus. */
const OverwriteConfirm = (props: {
  set: FilterSet;
  dispatch: Dispatch<ScoutAction>;
  onDone: () => void;
}) => {
  const { set, dispatch, onDone } = props;
  const confirm = useRef<HTMLButtonElement>(null);
  const questionId = useId();
  useEffect(() => {
    confirm.current?.focus();
  }, []);
  return (
    <li className="filter-set">
      <span id={questionId} className="filter-set-name">
        {FILTER_SETS_TEXT.overwriteQuestion(set.name)}
      </span>
      <SetButton
        ref={confirm}
        describedBy={questionId}
        label={FILTER_SETS_TEXT.overwriteSet}
        set={set.name}
        onClick={() => {
          dispatch({ type: "filter-set-saved", name: set.name });
          onDone();
        }}
      />
      <SetButton label={FILTER_SETS_TEXT.cancel} set={set.name} onClick={onDone} />
    </li>
  );
};

/** A set's row: its name and its buttons; `focusOn` gives one of them the focus back. */
const SetRow = (props: {
  set: FilterSet;
  dispatch: Dispatch<ScoutAction>;
  focusOn: "overwrite" | "rename" | null;
  onOverwrite: () => void;
  onRename: () => void;
}) => {
  const { set, dispatch, focusOn } = props;
  const overwrite = useRef<HTMLButtonElement>(null);
  const rename = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusOn !== null) (focusOn === "overwrite" ? overwrite : rename).current?.focus();
  }, [focusOn]);
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
        ref={overwrite}
        label={FILTER_SETS_TEXT.overwriteSet}
        set={set.name}
        onClick={props.onOverwrite}
      />
      <SetButton
        ref={rename}
        label={FILTER_SETS_TEXT.rename}
        set={set.name}
        onClick={props.onRename}
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

/**
 * One set: its row, its name editor or the overwrite question. With `focus`, the rename button takes
 * the focus back after editing; the overwrite button takes it back after the question.
 */
const SetItem = (props: {
  set: FilterSet;
  sets: readonly FilterSet[];
  focus: boolean;
  dispatch: Dispatch<ScoutAction>;
  onRenameDone: (name: string) => void;
}) => {
  const { set, sets, focus, dispatch, onRenameDone } = props;
  const [mode, setMode] = useState<"row" | "editing" | "asking" | "asked">("row");
  if (mode === "editing") {
    return (
      <RenameEditor
        set={set}
        sets={sets}
        dispatch={dispatch}
        onDone={(name) => {
          setMode("row");
          onRenameDone(name);
        }}
      />
    );
  }
  if (mode === "asking") {
    return (
      <OverwriteConfirm
        set={set}
        dispatch={dispatch}
        onDone={() => {
          setMode("asked");
        }}
      />
    );
  }
  return (
    <SetRow
      set={set}
      dispatch={dispatch}
      focusOn={mode === "asked" ? "overwrite" : focus ? "rename" : null}
      onOverwrite={() => {
        setMode("asking");
      }}
      onRename={() => {
        setMode("editing");
      }}
    />
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
  const check = checkSetName(sets, name);
  const taken = !check.ok && check.error === "taken";
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
        disabled={!check.ok && check.error === "empty"}
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
              sets={sets}
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
