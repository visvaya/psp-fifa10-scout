import type { ChangeEvent, Dispatch, JSX, ReactNode } from "react";
import { languageLabel } from "../logic/game-names.ts";
import type { LoadStage } from "../logic/load-scout.ts";
import { isRestoring, listedCount } from "../logic/scout-state.ts";
import type { ScoutAction, ScoutState } from "../logic/scout-state.ts";
import { About } from "./about.tsx";
import { TEXT } from "./text.ts";

interface StartScreenProps {
  readonly state: ScoutState;
  /** The store and worker are open; picks before that would be lost. */
  readonly ready: boolean;
  /** The game language whose names show, null for the fifa.db names. */
  readonly language: string | null;
  readonly onGame: (file: File) => void;
  readonly onSave: (files: readonly File[]) => void;
  readonly onForgetSave: () => void;
  readonly onLocale: (files: readonly File[]) => void;
  readonly dispatch: Dispatch<ScoutAction>;
}

interface FileStepProps {
  readonly stage: LoadStage;
  readonly title: string;
  readonly label: string;
  readonly state: ScoutState;
  readonly ready: boolean;
  readonly multiple: boolean;
  readonly accept?: string;
  /** What this step has loaded, shown in place of the browser's file input text. */
  readonly loaded: string | null;
  /** Controls shown between the title and the file input. */
  readonly before?: ReactNode;
  /** Controls shown after the file input. */
  readonly after?: ReactNode;
  readonly onFiles: (files: readonly File[]) => void;
  readonly help: ReactNode;
}

const FileStep = (props: FileStepProps): JSX.Element => {
  const { stage } = props;
  const { error } = props.state;
  const failed = error?.stage === stage ? error : null;
  const describedBy = failed === null ? `${stage}-help` : `${stage}-help ${stage}-error`;
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = [...(input.files ?? [])];
    // Picking the same file again must fire change again.
    input.value = "";
    props.onFiles(files);
  };
  return (
    <div className="step">
      <h3>{props.title}</h3>
      {props.before}
      {props.loaded === null ? null : <p className="loaded">{props.loaded}</p>}
      {/* The input stays focusable and labelled; the label shows as the button. */}
      <input
        className="visually-hidden"
        id={`${stage}-file`}
        type="file"
        multiple={props.multiple}
        accept={props.accept}
        disabled={!props.ready}
        aria-describedby={describedBy}
        aria-invalid={failed !== null}
        onChange={onChange}
      />
      <label className="button file-label" htmlFor={`${stage}-file`}>
        {props.label}
      </label>
      {/* Right under the button that picked the file (owner, 2026-11-05). */}
      {failed === null ? null : (
        <p id={`${stage}-error`} className="error" role="alert">
          {TEXT.error(failed)}
        </p>
      )}
      {props.after}
      <div id={`${stage}-help`} className="help">
        {props.help}
      </div>
    </div>
  );
};

const LanguageSelect = ({
  codes,
  language,
  onLanguage,
}: {
  readonly codes: readonly string[];
  readonly language: string | null;
  readonly onLanguage: (language: string | null) => void;
}): JSX.Element => (
  <div className="field">
    <label htmlFor="game-language">{TEXT.languageSelect}</label>
    <select
      id="game-language"
      value={language ?? ""}
      onChange={(event) => {
        const { value } = event.currentTarget;
        onLanguage(value === "" ? null : value);
      }}
    >
      <option value="">{TEXT.languageFromDb}</option>
      {codes.map((code) => (
        <option key={code} value={code}>
          {languageLabel(code)}
        </option>
      ))}
    </select>
  </div>
);

type LanguageStepProps = Pick<
  StartScreenProps,
  "state" | "ready" | "language" | "onLocale" | "dispatch"
>;

const LanguageStep = ({
  state,
  ready,
  language,
  onLocale,
  dispatch,
}: LanguageStepProps): JSX.Element => (
  <FileStep
    state={state}
    ready={ready && state.players !== null}
    stage="locale"
    title={TEXT.languageStep}
    label={TEXT.localeInput}
    loaded={null}
    multiple
    accept=".loc,.idx"
    before={
      <LanguageSelect
        codes={Object.keys(state.languages).toSorted()}
        language={language}
        onLanguage={(chosen) => {
          dispatch({ type: "language-chosen", language: chosen });
        }}
      />
    }
    onFiles={onLocale}
    help={
      <>
        <p>{TEXT.languageHelp}</p>
        <p>{TEXT.localeHelp}</p>
      </>
    }
  />
);

/** The career save: what it holds once loaded, and how to forget it. */
const SaveStep = ({
  state,
  ready,
  onSave,
  onForgetSave,
}: Pick<StartScreenProps, "state" | "ready" | "onSave" | "onForgetSave">): JSX.Element => (
  <FileStep
    state={state}
    ready={ready}
    stage="save"
    title={TEXT.saveStep}
    label={TEXT.saveInput}
    multiple
    loaded={state.career === null ? null : TEXT.careerLoaded(state.career)}
    onFiles={onSave}
    after={
      state.career === null ? null : (
        <button type="button" className="button" onClick={onForgetSave}>
          {TEXT.forgetSave}
        </button>
      )
    }
    help={
      <>
        <p>{TEXT.saveHelp}</p>
        <p>{TEXT.saveFolders}</p>
      </>
    }
  />
);

/** Stands in for the list while the stored game loads: rows shaped like the player rows. */
const ListSkeleton = ({ phase }: { readonly phase: string }): JSX.Element => (
  <div className="restoring">
    <output className="status">{phase}</output>
    <ol className="player-rows" aria-hidden="true">
      {Array.from({ length: SKELETON_ROWS }, (_, row) => (
        <li key={row} className="player-row">
          <span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-rating" />
        </li>
      ))}
    </ol>
  </div>
);

const SKELETON_ROWS = 6;

/** A picked game stays on the start screen, so a save or a language can follow; this opens the list. */
const ShowPlayers = ({
  count,
  dispatch,
}: {
  readonly count: number;
  readonly dispatch: Dispatch<ScoutAction>;
}): JSX.Element => (
  <button
    type="button"
    className="button primary"
    onClick={() => {
      dispatch({ type: "view-changed", view: "list" });
    }}
  >
    {TEXT.showPlayers(count)}
  </button>
);

export const StartScreen = (props: StartScreenProps): JSX.Element => {
  const { state, ready, onGame, dispatch } = props;
  const { players, loading } = state;
  if (isRestoring(state) && loading !== null)
    return <ListSkeleton phase={TEXT.phase(loading.phase)} />;
  const shared = { state, ready };
  return (
    <section className="start" aria-labelledby="start-title">
      <h2 id="start-title">{TEXT.startHeading}</h2>
      <p className="muted">
        {players === null ? `${TEXT.noData} ${TEXT.startIntro}` : TEXT.startIntro}
      </p>
      {/* Hidden while another game loads: the count and the list would be the previous game's. */}
      {players === null || loading !== null ? null : (
        <ShowPlayers count={listedCount(state)} dispatch={dispatch} />
      )}
      <output className="status">
        {loading === null ? (ready ? "" : TEXT.preparing) : TEXT.phase(loading.phase)}
      </output>
      <FileStep
        {...shared}
        stage="game"
        title={TEXT.gameStep}
        label={TEXT.gameInput}
        multiple={false}
        accept=".iso,.db"
        loaded={players === null ? null : TEXT.gameLoaded(state.gameName)}
        onFiles={([file]) => {
          if (file !== undefined) onGame(file);
        }}
        help={
          <>
            {players === null ? null : <p>{TEXT.gameStored}</p>}
            <p>{TEXT.gameHelpPhone}</p>
            <p>{TEXT.gameHelpPc}</p>
          </>
        }
      />
      <SaveStep {...props} />
      <LanguageStep {...props} />
      <section className="step install-help" aria-labelledby="install-title">
        <h3 id="install-title">{TEXT.installHeading}</h3>
        <p className="help">{TEXT.installHelp}</p>
      </section>
      <About />
    </section>
  );
};
