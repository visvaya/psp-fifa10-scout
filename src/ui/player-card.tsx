import { useCallback } from "react";
import type { JSX, ReactNode } from "react";
import type { AttributeName, Player } from "../logic/players.ts";
import { POSITION_GROUPS } from "../logic/positions.ts";
import { AttributeValue } from "./attribute-value.tsx";
import { ModalDialog } from "./modal-dialog.tsx";
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

const basics = (
  player: Player,
  showPotential: boolean,
): readonly (readonly [string, ReactNode])[] => [
  [TEXT.card.position, player.positionName],
  [TEXT.card.age, TEXT.years(player.age)],
  [TEXT.card.club, player.clubName ?? (player.youth ? TEXT.youth : TEXT.noClub)],
  [TEXT.card.league, optional(player.leagueName)],
  [TEXT.card.nationality, optional(player.nationalityName)],
  [TEXT.card.contract, player.contractEndYear ?? TEXT.card.none],
  [TEXT.columns.overall, <AttributeValue key="overall" value={player.overall} />],
  ...(showPotential
    ? [[TEXT.card.potential, <AttributeValue key="potential" value={player.potential} />] as const]
    : []),
  [TEXT.card.foot, player.preferredFoot === "left" ? TEXT.card.left : TEXT.card.right],
  [TEXT.card.height, TEXT.card.heightValue(player.height)],
  [TEXT.card.weight, TEXT.card.weightValue(player.weight)],
];

export const PlayerCard = (props: {
  player: Player;
  career: boolean;
  showPotential: boolean;
  onClose: () => void;
}): JSX.Element => {
  const { player, career, showPotential, onClose } = props;
  const returnFocus = useCallback(
    () => document.querySelector<HTMLElement>(`[data-player-id="${String(player.id)}"]`),
    [player.id],
  );
  return (
    <ModalDialog title={player.name} className="card" onClose={onClose} returnFocus={returnFocus}>
      <Facts facts={basics(player, showPotential)} />
      {career ? (
        <section aria-labelledby="career-title">
          <h3 id="career-title">{TEXT.card.career}</h3>
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
        <Facts
          facts={POSITION_GROUPS.map((group) => [
            POSITION_GROUP_LABELS[group],
            <AttributeValue key={group} value={player.overallByGroup[group]} />,
          ])}
        />
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
