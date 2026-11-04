import { useCallback, useState } from "react";
import type { JSX, ReactNode } from "react";
import type { CurrencyCode } from "../data/career-save.ts";
import type { AttributeName, Player } from "../logic/players.ts";
import { nameTextIdOf, POSITION_CODES, RATING_CHOICES, ratingCodeOf } from "../logic/positions.ts";
import { AttributeValue, GainValue } from "./attribute-value.tsx";
import { ModalDialog } from "./modal-dialog.tsx";
import { PositionName, ratingChoiceName } from "./position-name.tsx";
import type { PositionNames } from "./position-name.tsx";
import { clubText } from "./player-list.tsx";
import { ATTRIBUTE_GROUP_LABELS, ATTRIBUTE_LABELS, formatNumber, TEXT } from "./text.ts";

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
const money = (
  { price, wage, wageMax }: Player,
  currency: CurrencyCode | null,
): readonly (readonly [string, ReactNode])[] =>
  price === null || wage === null || currency === null
    ? []
    : [
        [TEXT.card.price, TEXT.card.money(price, currency)],
        [
          // A null wageMax: the wage stored in the user's own player's contract.
          wageMax === null ? TEXT.card.contractWage : TEXT.card.wage,
          wageMax === null
            ? TEXT.card.money(wage, currency)
            : TEXT.card.wageEstimate(wage, wageMax, currency),
        ],
      ];

const basics = (
  player: Player,
  showPotential: boolean,
  currency: CurrencyCode | null,
  names: PositionNames,
): readonly (readonly [string, ReactNode])[] => [
  [
    TEXT.card.position,
    <PositionName
      key="position"
      code={player.positionCode}
      name={names.short(player.positionCode)}
    />,
  ],
  [TEXT.card.age, TEXT.years(player.age)],
  [TEXT.card.club, clubText(player)],
  [TEXT.card.league, optional(player.leagueName)],
  [TEXT.card.nationality, optional(player.nationalityName)],
  [TEXT.card.contract, player.contractEndYear ?? TEXT.card.none],
  ...money(player, currency),
  [TEXT.columns.overall, <AttributeValue key="overall" value={player.overall} />],
  ...(showPotential
    ? [[TEXT.card.potential, <AttributeValue key="potential" value={player.potential} />] as const]
    : []),
  [TEXT.card.foot, player.preferredFoot === "left" ? TEXT.card.left : TEXT.card.right],
  [TEXT.card.weakFoot, TEXT.card.weakFootValue(player.weakFoot)],
  [TEXT.card.height, TEXT.card.heightValue(player.height)],
  [TEXT.card.weight, TEXT.card.weightValue(player.weight)],
];

/** The positions a rating choice covers, by their full names in the game language where it has them. */
const choicePositions = (code: number, names: PositionNames): string =>
  POSITION_CODES.filter(
    (other) => ratingCodeOf(other) === code && nameTextIdOf(other) !== undefined,
  )
    .map((other) => {
      const full = names.full(other);
      return full === undefined
        ? names.short(other)
        : TEXT.card.positionWithName(full, names.abbreviation(other));
    })
    .join(TEXT.rowMetaSeparator);

/**
 * OVR per rating choice, after the gain over the OVR so the ratings line up; one switch at the heading shows the positions
 * each choice covers.
 */
const ChoiceRatings = (props: { player: Player; names: PositionNames }) => {
  const { player, names } = props;
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="overall-title">
      <h3 id="overall-title">
        <button
          type="button"
          className="sort-button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
        >
          {TEXT.card.overallByGroup}{" "}
          <span aria-hidden="true" className="sort-mark">
            {open ? TEXT.card.openMark : TEXT.card.closedMark}
          </span>
        </button>
      </h3>
      <dl className="facts">
        {RATING_CHOICES.map(([code]) => {
          const rating = player.overallByCode[code] ?? null;
          return (
            <div key={code}>
              <dt>
                {ratingChoiceName(code)}
                {open ? <p>{choicePositions(code, names)}</p> : null}
              </dt>
              <dd className="rated">
                {rating === null ? null : <GainValue value={rating - player.overall} bracketed />}
                {rating === null ? null : <AttributeValue value={rating} />}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
};

export const PlayerCard = (props: {
  player: Player;
  career: boolean;
  /** The career's currency, null without a career. */
  currency: CurrencyCode | null;
  showPotential: boolean;
  /** Position names in the chosen language. */
  names: PositionNames;
  onClose: () => void;
}): JSX.Element => {
  const { player, career, currency, showPotential, names, onClose } = props;
  const returnFocus = useCallback(
    () => document.querySelector<HTMLElement>(`[data-player-id="${String(player.id)}"]`),
    [player.id],
  );
  return (
    <ModalDialog title={player.name} className="card" onClose={onClose} returnFocus={returnFocus}>
      {player.shortlisted ? (
        <p className="shortlisted">
          <span aria-hidden="true">{TEXT.shortlistedMark}</span> {TEXT.card.shortlisted}
        </p>
      ) : null}
      <Facts facts={basics(player, showPotential, currency, names)} />
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
      <ChoiceRatings player={player} names={names} />
      <div className="attribute-groups">
        {ATTRIBUTE_GROUPS.map(([group, attributes]) => (
          <section key={group} aria-labelledby={`group-${group}`}>
            <h3 id={`group-${group}`}>{ATTRIBUTE_GROUP_LABELS[group]}</h3>
            <Facts
              facts={attributes.map((name) => [
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
