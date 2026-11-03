import type { ChangeEvent, Dispatch, JSX, ReactNode } from "react";
import { languageLabel } from "../logic/game-names.ts";
import type { LoadStage } from "../logic/load-scout.ts";
import type { ScoutAction, ScoutState } from "../logic/scout-state.ts";
import { TEXT } from "./text.ts";

interface StartScreenProps {
  readonly state: ScoutState;
  readonly hasStoredGame: boolean;
  /** The store and worker are open; picks before that would be lost. */
  readonly ready: boolean;
  /** The game language whose names show, null for the fifa.db names. */
  readonly language: string | null;
  readonly onGame: (file: File) => void;
  readonly onSave: (files: readonly File[]) => void;
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
  /** Controls shown between the title and the file input. */
  readonly before?: ReactNode;
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
      <label className="file-label" htmlFor={`${stage}-file`}>
        {props.label}
      </label>
      <input
        id={`${stage}-file`}
        type="file"
        multiple={props.multiple}
        accept={props.accept}
        disabled={!props.ready}
        aria-describedby={describedBy}
        aria-invalid={failed !== null}
        onChange={onChange}
      />
      <div id={`${stage}-help`} className="help">
        {props.help}
      </div>
      {failed === null ? null : (
        <p id={`${stage}-error`} className="error" role="alert">
          {TEXT.error(failed)}
        </p>
      )}
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

export const StartScreen = (props: StartScreenProps): JSX.Element => {
  const { state, hasStoredGame, ready, onGame, onSave } = props;
  const shared = { state, ready };
  return (
    <section className="start" aria-labelledby="start-title">
      <h2 id="start-title">{TEXT.startHeading}</h2>
      <p className="muted">
        {state.players === null ? `${TEXT.noData} ${TEXT.startIntro}` : TEXT.startIntro}
      </p>
      <FileStep
        {...shared}
        stage="game"
        title={TEXT.gameStep}
        label={TEXT.gameInput}
        multiple={false}
        accept=".iso,.db"
        onFiles={([file]) => {
          if (file !== undefined) onGame(file);
        }}
        help={
          <>
            {hasStoredGame || state.players !== null ? <p>{TEXT.gameStored}</p> : null}
            <p>{TEXT.gameHelpPhone}</p>
            <p>{TEXT.gameHelpPc}</p>
          </>
        }
      />
      <FileStep
        {...shared}
        stage="save"
        title={TEXT.saveStep}
        label={TEXT.saveInput}
        multiple
        onFiles={onSave}
        help={<p>{state.myTeamId === null ? TEXT.saveHelp : TEXT.saveLoaded}</p>}
      />
      <LanguageStep {...props} />
      <section className="step install-help" aria-labelledby="install-title">
        <h3 id="install-title">{TEXT.installHeading}</h3>
        <p className="help">{TEXT.installHelp}</p>
      </section>
      <output className="status">
        {state.loading === null ? "" : TEXT.phase(state.loading.phase)}
      </output>
    </section>
  );
};
