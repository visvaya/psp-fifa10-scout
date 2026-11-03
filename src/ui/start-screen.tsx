import type { ChangeEvent, JSX, ReactNode } from "react";
import type { LoadStage } from "../logic/load-scout.ts";
import type { ScoutState } from "../logic/scout-state.ts";
import { TEXT } from "./text.ts";

interface StartScreenProps {
  readonly state: ScoutState;
  readonly hasStoredGame: boolean;
  /** The store and worker are open; picks before that would be lost. */
  readonly ready: boolean;
  readonly onGame: (file: File) => void;
  readonly onSave: (files: readonly File[]) => void;
}

interface FileStepProps {
  readonly stage: LoadStage;
  readonly title: string;
  readonly label: string;
  readonly state: ScoutState;
  readonly ready: boolean;
  readonly multiple: boolean;
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
      <label className="file-label" htmlFor={`${stage}-file`}>
        {props.label}
      </label>
      <input
        id={`${stage}-file`}
        type="file"
        multiple={props.multiple}
        accept={props.multiple ? undefined : ".iso,.db"}
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

export const StartScreen = ({
  state,
  hasStoredGame,
  ready,
  onGame,
  onSave,
}: StartScreenProps): JSX.Element => {
  const shared = { state, ready };
  return (
    // Focusable: on a short screen the section scrolls, and Safari scrolls with the keyboard only what can
    // take focus (axe scrollable-region-focusable; the file inputs stay disabled until the store opens).
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <section className="start" aria-labelledby="start-title" tabIndex={0}>
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
