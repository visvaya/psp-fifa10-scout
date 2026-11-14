// The club dialog (roadmap 98), opened from the top bar beside the notes with a career: the formations
// of the game's database ranked by the best eleven the user's squad can field in each, and that eleven.
import { useMemo, useState } from "react";
import type { Dispatch, JSX } from "react";
import { chosenFormation, fitOf, rankFormations } from "../logic/best-eleven.ts";
import type { RankedFormation, SquadMember } from "../logic/best-eleven.ts";
import type { CareerSummary } from "../logic/load-scout.ts";
import type { Player } from "../logic/players.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import { AttributeValue } from "./attribute-value.tsx";
import { HelpHeading } from "./field-help.tsx";
import { RadioField } from "./filter-form.tsx";
import { BarDialogButton } from "./modal-dialog.tsx";
import { CLUB_TEXT } from "./text-club.ts";
import { REDUCED_MOTION_QUERY } from "./use-media-query.ts";

const VALUES = ["now", "peak"] as const;
const GOALKEEPER_CODE = 0;
type ValueKind = (typeof VALUES)[number];

interface ClubProps {
  readonly players: readonly Player[];
  readonly myTeamId: number;
  readonly career: CareerSummary;
  readonly showPotential: boolean;
  /** Position abbreviations in the chosen language. */
  readonly positionName: (code: number) => string;
  readonly dispatch: Dispatch<ScoutAction>;
}

/** The players at the user's club now, valued by OVR or by peak at each code, a tie by fitOf. */
const squadOf = (players: readonly Player[], myTeamId: number, kind: ValueKind) =>
  players
    .filter((player) => player.clubId === myTeamId)
    .map((player): SquadMember => ({
      id: player.id,
      valueAt: (code) =>
        (kind === "peak" ? player.peakByCode[code] : player.overallByCode[code]) ?? 0,
      fitAt: fitOf(player),
    }));

/**
 * The formations with their averages and differences; each name chooses the eleven shown under it, and
 * the outfield positions under it tell apart formations of one name.
 */
const FormationTable = (props: {
  ranked: readonly RankedFormation[];
  chosen: RankedFormation | undefined;
  onChoose: (formation: RankedFormation) => void;
  positionName: (code: number) => string;
}) => {
  const current = props.ranked.find((formation) => formation.current);
  return (
    <table className="formation-table">
      <caption className="visually-hidden">{CLUB_TEXT.table}</caption>
      <thead>
        <tr>
          <th scope="col">{CLUB_TEXT.formation}</th>
          <th scope="col">{CLUB_TEXT.average}</th>
          <th scope="col">{CLUB_TEXT.difference}</th>
        </tr>
      </thead>
      <tbody>
        {props.ranked.map((formation) => (
          <tr key={formation.codes.join()}>
            <th scope="row">
              <button
                type="button"
                className="link-button"
                aria-pressed={formation === props.chosen}
                onClick={() => {
                  props.onChoose(formation);
                }}
              >
                {CLUB_TEXT.name(formation.name, formation.current)}
              </button>
              <span className="formation-codes">
                {formation.codes
                  .filter((code) => code !== GOALKEEPER_CODE)
                  .toSorted(byGameOrder)
                  .map(props.positionName)
                  .join(" ")}
              </span>
            </th>
            <td>{CLUB_TEXT.average1(formation.average)}</td>
            <td>
              {current === undefined
                ? "–"
                : CLUB_TEXT.difference1(formation.average - current.average)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/**
 * The game lists a team's positions by code, from the goalkeeper and the right side (its team sheet:
 * BR, CPS, PŚO, ŚO, LŚO; owner, 2026-11-14), not in the order of the formation's row.
 */
const byGameOrder = (one: number, other: number): number => one - other;

const ELEVEN_TITLE_ID = "eleven-title";

/**
 * Brings the eleven, above the table, into view after a formation is chosen in it, so a press never
 * shows no change.
 */
const showEleven = (): void => {
  const heading = document.getElementById(ELEVEN_TITLE_ID);
  if (heading === null) return;
  // The dialog's sticky header covers the top of its scroll: measured now, as it wraps on narrow screens.
  const header = heading.closest("dialog")?.querySelector(".dialog-header");
  heading.style.scrollMarginTop = `${String(header?.getBoundingClientRect().height ?? 0)}px`;
  const reduced = globalThis.matchMedia(REDUCED_MOTION_QUERY).matches;
  heading.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
};

/** The chosen formation's eleven: each slot's position, player (his card on a press) and value. */
const ElevenList = (props: {
  formation: RankedFormation;
  names: ReadonlyMap<number, string>;
  positionName: (code: number) => string;
  dispatch: Dispatch<ScoutAction>;
}) => (
  <section aria-labelledby={ELEVEN_TITLE_ID}>
    <h3 id={ELEVEN_TITLE_ID}>{CLUB_TEXT.eleven(props.formation.name)}</h3>
    <ol className="eleven-list">
      {props.formation.slots
        .toSorted((one, other) => byGameOrder(one.code, other.code))
        .map(({ code, playerId, value }, index) => (
          // A formation can hold a code twice (two centre-backs as one code): the place keys the slot.
          // oxlint-disable-next-line react/no-array-index-key -- slots have no id but their place
          <li key={index}>
            <span className="eleven-position">{props.positionName(code)}</span>
            {playerId === null ? (
              <span>{CLUB_TEXT.noPlayer}</span>
            ) : (
              <>
                <button
                  type="button"
                  className="link-button"
                  data-player-id={playerId}
                  onClick={() => {
                    props.dispatch({ type: "player-opened", id: playerId });
                  }}
                >
                  {props.names.get(playerId) ?? String(playerId)}
                </button>
                <AttributeValue value={value} />
              </>
            )}
          </li>
        ))}
    </ol>
  </section>
);

export const ClubView = (props: ClubProps): JSX.Element => {
  const { players, myTeamId, career, showPotential } = props;
  const [kind, setKind] = useState<ValueKind>("now");
  // The codes, not the place in the ranking: another value kind can reorder the formations.
  const [chosen, setChosen] = useState<readonly number[] | null>(null);
  const shownKind = showPotential ? kind : "now";
  const ranked = useMemo(
    () =>
      rankFormations(
        squadOf(players, myTeamId, shownKind),
        career.formations,
        career.formationCodes,
      ),
    [players, myTeamId, shownKind, career],
  );
  const names = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players],
  );
  // The club's formation until another is chosen (owner, 2026-11-14), else the best one.
  const formation = chosenFormation(
    ranked,
    chosen ?? ranked.find((each) => each.current)?.codes ?? null,
  );
  return (
    <section aria-labelledby="formations-title">
      <HelpHeading
        id="formations-title"
        title={CLUB_TEXT.formations}
        help={CLUB_TEXT.formationsHelp}
      />
      {showPotential ? (
        <RadioField
          legend={CLUB_TEXT.valueLegend}
          name="club-values"
          options={VALUES}
          labels={CLUB_TEXT.values}
          value={kind}
          onChange={setKind}
        />
      ) : null}
      {formation === undefined ? null : (
        <ElevenList
          formation={formation}
          names={names}
          positionName={props.positionName}
          dispatch={props.dispatch}
        />
      )}
      <FormationTable
        ranked={ranked}
        chosen={formation}
        onChoose={(picked) => {
          setChosen(picked.codes);
          showEleven();
        }}
        positionName={props.positionName}
      />
    </section>
  );
};

/** The club dialog's button; with a career whose database has formations only. */
export const ClubButton = (props: ClubProps): JSX.Element | null =>
  props.career.formations.length === 0 ? null : (
    <BarDialogButton title={CLUB_TEXT.title}>
      <ClubView {...props} />
    </BarDialogButton>
  );
