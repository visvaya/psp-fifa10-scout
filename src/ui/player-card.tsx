import { useCallback, useState } from "react";
import type { JSX, ReactNode } from "react";
import type { CurrencyCode } from "../data/career-save.ts";
import { offerTerms } from "../logic/offer.ts";
import type { OfferContext } from "../logic/offer.ts";
import type { AttributeName, Player } from "../logic/players.ts";
import { nameTextIdOf, POSITION_CODES, RATING_CHOICES, ratingCodeOf } from "../logic/positions.ts";
import { codeName } from "./text-code-names.ts";
import { AttributeValue, GainValue } from "./attribute-value.tsx";
import { ModalDialog } from "./modal-dialog.tsx";
import { PositionName, ratingChoiceName } from "./position-name.tsx";
import type { PositionNames } from "./position-name.tsx";
import { clubText } from "./player-list.tsx";
import {
  ATTRIBUTE_GROUP_LABELS,
  ATTRIBUTE_LABELS,
  FILTER_SECTION_LABELS,
  FLAG_LABELS,
  formatNumber,
  formatRating,
  LIST_LABELS,
  RANGE_LABELS,
  TEXT,
} from "./text.ts";
import { OFFER_TEXT } from "./text-offer.ts";

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

const yesNo = (value: boolean): string => (value ? TEXT.card.yes : TEXT.card.no);

const count = (value: number | null): string | null =>
  value === null ? null : formatNumber(value);

/** A row only when its value is known: a player without a season in the save gets no rows of "brak"
 * (owner, 2026-11-05). */
const known = (label: string, value: string | null): readonly (readonly [string, string])[] =>
  value === null ? [] : [[label, value]];

/** What the filters offer beyond the basics, labelled as in the filters. */
const profile = (
  player: Player,
  showPotential: boolean,
): readonly (readonly [string, ReactNode])[] => [
  ...(showPotential ? [[RANGE_LABELS.growth, formatNumber(player.growth)] as const] : []),
  ...(showPotential && player.peakGain !== null
    ? [[RANGE_LABELS.peakGain, formatNumber(player.peakGain)] as const]
    : []),
  [TEXT.card.internationalReputation, TEXT.card.outOfFive(player.internationalReputation)],
  [TEXT.card.learningSpeed, TEXT.card.outOfFive(player.learningSpeed)],
  [RANGE_LABELS.retirementAge, TEXT.years(player.retirementAge)],
  [LIST_LABELS.bodyType, codeName("bodyType", player.bodyType)],
  [LIST_LABELS.developmentType, codeName("developmentType", player.developmentType)],
  [LIST_LABELS.developmentStyle, codeName("developmentStyle", player.developmentStyle)],
  [RANGE_LABELS.clubRating, optional(player.clubRating)],
  [FLAG_LABELS.nationalTeam, player.nationalTeamName ?? TEXT.card.no],
  [
    FILTER_SECTION_LABELS.traits,
    player.traits.length === 0
      ? TEXT.card.none
      : player.traits.map((trait) => FLAG_LABELS[trait]).join(", "),
  ],
];

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
  ...(showPotential && player.peak !== null
    ? [[TEXT.card.peak, <AttributeValue key="peak" value={player.peak} />] as const]
    : []),
  [TEXT.card.foot, player.preferredFoot === "left" ? TEXT.card.left : TEXT.card.right],
  [TEXT.card.weakFoot, TEXT.card.outOfFive(player.weakFoot)],
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

/** What an offer needs to succeed (offer.ts), career only, for a player of another club. */
const OfferFacts = (props: { player: Player; context: OfferContext; currency: CurrencyCode }) => {
  const { player, context, currency } = props;
  const terms = offerTerms(player, context);
  if (terms === null) return null;
  const { fee, wage, years } = terms;
  return (
    <section aria-labelledby="offer-title">
      <h3 id="offer-title">{OFFER_TEXT.title}</h3>
      <p className="help">{OFFER_TEXT.note}</p>
      <Facts
        facts={[
          [OFFER_TEXT.fee, fee === null ? OFFER_TEXT.noFee : TEXT.card.money(fee, currency)],
          [
            OFFER_TEXT.wage,
            wage === null
              ? OFFER_TEXT.never
              : OFFER_TEXT.wageValue(TEXT.card.money(wage, currency), TEXT.years(years)),
          ],
        ]}
      />
      {player.clubWillSell === false ? <p className="help">{OFFER_TEXT.clubRefuses}</p> : null}
      {terms.feeOverCap ? <p className="help">{OFFER_TEXT.feeOverCap}</p> : null}
      {terms.wageOverCap ? <p className="help">{OFFER_TEXT.wageOverCap}</p> : null}
    </section>
  );
};

/** The season so far, career only. */
const CareerFacts = ({ player }: { player: Player }) => (
  <section aria-labelledby="career-title">
    <h3 id="career-title">{TEXT.card.career}</h3>
    <p className="help">{TEXT.card.careerNote}</p>
    <Facts
      facts={[
        ...known(TEXT.card.form, player.form === null ? null : formatRating(player.form)),
        ...known(TEXT.card.morale, count(player.morale)),
        ...known(RANGE_LABELS.appearances, count(player.appearances)),
        ...known(RANGE_LABELS.goals, count(player.goals)),
        ...known(RANGE_LABELS.cupAppearances, count(player.cupAppearances)),
        ...known(RANGE_LABELS.cupGoals, count(player.cupGoals)),
        ...known(RANGE_LABELS.assists, count(player.assists)),
        ...known(RANGE_LABELS.cupAssists, count(player.cupAssists)),
        ...(player.positionGroup === "goalkeeper"
          ? [
              ...known(RANGE_LABELS.cleanSheets, count(player.cleanSheets)),
              ...known(RANGE_LABELS.cupCleanSheets, count(player.cupCleanSheets)),
            ]
          : []),
        ...known(RANGE_LABELS.injuryDays, count(player.injuryDays)),
        [FLAG_LABELS.transferListed, yesNo(player.transferListed)],
        [FLAG_LABELS.loanListed, yesNo(player.loanListed)],
        ...(player.loanedFromId === null
          ? []
          : [[TEXT.card.loanedFrom, player.loanedFromName ?? TEXT.card.none] as const]),
        ...(player.clubWillSell === null
          ? []
          : [[FLAG_LABELS.clubWillSell, yesNo(player.clubWillSell)] as const]),
      ]}
    />
  </section>
);

export const PlayerCard = (props: {
  player: Player;
  career: boolean;
  /** The career's currency, null without a career. */
  currency: CurrencyCode | null;
  /** The user's side of an offer; null without a career and for the user's own players. */
  offer: OfferContext | null;
  showPotential: boolean;
  /** Position names in the chosen language. */
  names: PositionNames;
  onClose: () => void;
}): JSX.Element => {
  const { player, career, currency, offer, showPotential, names, onClose } = props;
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
      {showPotential && player.peak !== null ? (
        <p className="help">{TEXT.card.peakNote(player.potential, player.peak)}</p>
      ) : null}
      {player.wageMax === null ? null : <p className="help">{TEXT.card.wageNote}</p>}
      {offer === null || currency === null ? null : (
        <OfferFacts player={player} context={offer} currency={currency} />
      )}
      {career ? <CareerFacts player={player} /> : null}
      <section aria-labelledby="profile-title">
        <h3 id="profile-title">{TEXT.card.profile}</h3>
        <Facts facts={profile(player, showPotential)} />
      </section>
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
