import { useCallback } from "react";
import type { JSX, ReactNode } from "react";
import type { AttributeName, Player } from "../logic/players.ts";
import { POSITION_GROUP_ROWS, positionCodesOf, rowRating } from "../logic/positions.ts";
import type { PositionGroup } from "../logic/positions.ts";
import { AttributeValue } from "./attribute-value.tsx";
import { ModalDialog } from "./modal-dialog.tsx";
import { PositionName } from "./position-name.tsx";
import { clubText } from "./player-list.tsx";
import {
  ATTRIBUTE_GROUP_LABELS,
  ATTRIBUTE_LABELS,
  formatNumber,
  POSITION_GROUP_LABELS,
  TEXT,
} from "./text.ts";

const ATTRIBUTE_GROUPS: readonly (readonly [
  keyof typeof ATTRIBUTE_GROUP_LABELS,
  readonly AttributeName[],
])[] = [
  ["physical", ["acceleration", "sprintspeed", "stamina", "strength", "aggression"]],
  [
    "technique",
    ["ballcontrol", "dribbling", "crossing", "shortpassing", "longpassing", "freekicks"],
  ],
  ["shooting", ["finishing", "shotpower", "longshotaccuracy", "heading"]],
  ["mental", ["reactions", "positioning", "tacticalawareness", "playercomposure"]],
  ["defending", ["marking", "tackling"]],
  ["goalkeeping", ["gkdiving", "gkpositioning", "handling", "reflexes"]],
];

const Facts = ({ facts }: { facts: readonly (readonly [string, ReactNode])[] }) => (
  <dl className="facts">
    {facts.map(([label, value]) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    ))}
  </dl>
);

const optional = (value: number | string | null): ReactNode =>
  value === null ? TEXT.card.none : typeof value === "number" ? formatNumber(value) : value;

/** Price and wage, career only: the user's squad shows its stored wage, others an estimate. */
const money = ({ price, wage, wageMax }: Player): readonly (readonly [string, ReactNode])[] =>
  price === null || wage === null
    ? []
    : [
        [TEXT.card.price, formatNumber(price)],
        [
          TEXT.card.wage,
          wageMax === null ? formatNumber(wage) : TEXT.card.wageEstimate(wage, wageMax),
        ],
      ];

const basics = (
  player: Player,
  showPotential: boolean,
): readonly (readonly [string, ReactNode])[] => [
  [
    TEXT.card.position,
    <PositionName key="position" code={player.positionCode} name={player.positionName} />,
  ],
  [TEXT.card.age, TEXT.years(player.age)],
  [TEXT.card.club, clubText(player)],
  [TEXT.card.league, optional(player.leagueName)],
  [TEXT.card.nationality, optional(player.nationalityName)],
  [TEXT.card.contract, player.contractEndYear ?? TEXT.card.none],
  ...money(player),
  [TEXT.columns.overall, <AttributeValue key="overall" value={player.overall} />],
  ...(showPotential
    ? [[TEXT.card.potential, <AttributeValue key="potential" value={player.potential} />] as const]
    : []),
  [TEXT.card.foot, player.preferredFoot === "left" ? TEXT.card.left : TEXT.card.right],
  [TEXT.card.height, TEXT.card.heightValue(player.height)],
  [TEXT.card.weight, TEXT.card.weightValue(player.weight)],
];

/** A row's OVR, after "~" where its groups rate differently (the sweeper's rounding). */
const RowRating = (props: {
  ratings: Readonly<Record<PositionGroup, number>>;
  row: readonly [PositionGroup, ...PositionGroup[]];
}) => {
  const { value, approximate } = rowRating(props.ratings, props.row);
  return (
    <>
      {approximate ? (
        <>
          <span aria-hidden="true">{TEXT.card.approximateMark}</span>
          <span className="visually-hidden">{TEXT.card.approximately}</span>
        </>
      ) : null}
      <AttributeValue value={value} />
    </>
  );
};

/** OVR per card row; each row opens to its groups and their positions in the game language. */
const GroupRatings = (props: { player: Player; positionName: (code: number) => string }) => {
  const { player, positionName } = props;
  return (
    <dl className="facts">
      {POSITION_GROUP_ROWS.map((row) => (
        <div key={row[0]}>
          <dt>
            <details>
              <summary>{POSITION_GROUP_LABELS[row[0]]}</summary>
              {row.map((group) => (
                <p key={group}>
                  {TEXT.card.groupPositions(
                    POSITION_GROUP_LABELS[group],
                    positionCodesOf(group).map(positionName),
                    row.length > 1 ? player.overallByGroup[group] : null,
                  )}
                </p>
              ))}
            </details>
          </dt>
          <dd>
            <RowRating ratings={player.overallByGroup} row={row} />
          </dd>
        </div>
      ))}
    </dl>
  );
};

export const PlayerCard = (props: {
  player: Player;
  career: boolean;
  showPotential: boolean;
  /** A position's name in the chosen language (positionNameIn). */
  positionName: (code: number) => string;
  onClose: () => void;
}): JSX.Element => {
  const { player, career, showPotential, positionName, onClose } = props;
  const returnFocus = useCallback(
    () => document.querySelector<HTMLElement>(`[data-player-id="${String(player.id)}"]`),
    [player.id],
  );
  return (
    <ModalDialog title={player.name} className="card" onClose={onClose} returnFocus={returnFocus}>
      <Facts facts={basics(player, showPotential)} />
      {player.wageMax === null ? null : <p className="help">{TEXT.card.wageNote}</p>}
      {career ? (
        <section aria-labelledby="career-title">
          <h3 id="career-title">{TEXT.card.career}</h3>
          <p className="help">{TEXT.card.careerNote}</p>
          <Facts
            facts={[
              [TEXT.card.form, optional(player.form)],
              [TEXT.card.morale, optional(player.morale)],
              [TEXT.card.goals, optional(player.goals)],
              [TEXT.card.appearances, optional(player.appearances)],
            ]}
          />
        </section>
      ) : null}
      <section aria-labelledby="overall-title">
        <h3 id="overall-title">{TEXT.card.overallByGroup}</h3>
        <GroupRatings player={player} positionName={positionName} />
      </section>
      <div className="attribute-groups">
        {ATTRIBUTE_GROUPS.map(([group, names]) => (
          <section key={group} aria-labelledby={`group-${group}`}>
            <h3 id={`group-${group}`}>{ATTRIBUTE_GROUP_LABELS[group]}</h3>
            <Facts
              facts={names.map((name) => [
                ATTRIBUTE_LABELS[name],
                <AttributeValue key={name} value={player.attributes[name]} />,
              ])}
            />
          </section>
        ))}
      </div>
    </ModalDialog>
  );
};
