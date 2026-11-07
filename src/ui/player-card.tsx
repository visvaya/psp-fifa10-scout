import { useCallback } from "react";
import type { Dispatch, JSX, ReactNode } from "react";
import type { CurrencyCode } from "../data/career-save.ts";
import { codesAtPeak } from "../logic/best-peak.ts";
import { curveChart } from "../logic/curve-chart.ts";
import { curveSparklines } from "../logic/curve-sparkline.ts";
import type { OfferContext } from "../logic/offer.ts";
import { skillCurveId } from "../logic/overall-rating.ts";
import type { Curves } from "../logic/overall-rating.ts";
import { SEASON_STAT_KEYS } from "../logic/players.ts";
import type { AttributeName, Player } from "../logic/players.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import { ChoiceRatings } from "./card-folds.tsx";
import { CurveButton } from "./curve-chart.tsx";
import { Stars, WatchMark } from "./stars.tsx";
import { NoteSection } from "./note-section.tsx";
import { WatchlistSection } from "./watchlist-section.tsx";
import { codeName } from "./text-code-names.ts";
import { AttributeValue } from "./attribute-value.tsx";
import { ModalDialog } from "./modal-dialog.tsx";
import { PositionName } from "./position-name.tsx";
import type { PositionNames } from "./position-name.tsx";
import { clubText, MissingValue, RESULTS_TITLE_ID } from "./player-list.tsx";
import {
  FILTER_SECTION_LABELS,
  FLAG_LABELS,
  formatNumber,
  formatRating,
  LIST_LABELS,
  RANGE_LABELS,
  TEXT,
} from "./text.ts";
import { ATTRIBUTE_GROUP_LABELS, ATTRIBUTE_LABELS } from "./text-attributes.ts";
import { Facts } from "./facts.tsx";
import type { Fact } from "./facts.tsx";
import { OfferFacts } from "./offer-facts.tsx";
import { HelpHeading, WarnedValue } from "./field-help.tsx";
import { FIELD_HELP, HELP_TEXT, WARNING_TEXT } from "./text-help.ts";

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

const optional = (value: number | string | null): ReactNode =>
  value === null ? TEXT.card.none : typeof value === "number" ? formatNumber(value) : value;

const yesNo = (value: boolean): string => (value ? TEXT.card.yes : TEXT.card.no);

const count = (value: number | null): string | null =>
  value === null ? null : formatNumber(value);

/** A row only when its value is known: a player without a season in the save gets no rows of "brak"
 * (owner, 2026-11-05). */
const known = (label: string, value: string | null, help?: string): readonly Fact[] =>
  value === null ? [] : [[label, value, help]];

/** Clean sheets, which the game counts for goalkeepers only. */
const CLEAN_SHEETS: ReadonlySet<string> = new Set(["cleanSheets", "cupCleanSheets"]);

/**
 * His own skill curve, the one his projection follows, when the game has curves; it opens a large chart
 * marking the age this season's development uses (the season's first match day, not the card's age).
 */
const curveFacts = (
  { name, seasonAge, developmentStyle: style, developmentType: type }: Player,
  curves: Curves,
): readonly Fact[] => {
  const id = skillCurveId(style, type);
  const line = curveSparklines(curves)(id);
  const chart = curveChart(curves, id, seasonAge);
  return line === null || chart === null
    ? []
    : [
        [
          TEXT.card.curve,
          <span key="curve" className="curve-row">
            <CurveButton name={name} line={line} chart={chart} />
            {TEXT.card.curvePhases[chart.phase]}
          </span>,
          HELP_TEXT.curve(chart.peak.age),
        ],
      ];
};

/** The club's stars and prestige under its rating; a dash without a club. */
const clubFields = ({ clubStars, leaguePrestige, clubPrestige }: Player): readonly Fact[] => [
  [
    RANGE_LABELS.clubStars,
    clubStars === null ? <MissingValue key="stars" /> : <Stars key="stars" value={clubStars} />,
    FIELD_HELP.clubStars,
  ],
  [
    RANGE_LABELS.leaguePrestige,
    leaguePrestige === null ? <MissingValue key="league" /> : formatNumber(leaguePrestige),
    FIELD_HELP.leaguePrestige,
  ],
  [
    RANGE_LABELS.clubPrestige,
    clubPrestige === null ? <MissingValue key="club" /> : formatNumber(clubPrestige),
    FIELD_HELP.clubPrestige,
  ],
];

/** What the filters offer beyond the basics, labelled as in the filters. */
const profile = (player: Player, showPotential: boolean, curves: Curves): readonly Fact[] => [
  ...(showPotential
    ? [[RANGE_LABELS.growth, formatNumber(player.growth), FIELD_HELP.growth] as const]
    : []),
  ...(showPotential && player.peakGain !== null
    ? [[RANGE_LABELS.peakGain, formatNumber(player.peakGain), FIELD_HELP.peakGain] as const]
    : []),
  [
    TEXT.card.internationalReputation,
    <Stars key="reputation" value={player.internationalReputation} />,
    FIELD_HELP.internationalReputation,
  ],
  [
    TEXT.card.learningSpeed,
    <Stars key="learning" value={player.learningSpeed} />,
    FIELD_HELP.learningSpeed,
  ],
  [RANGE_LABELS.retirementAge, TEXT.years(player.retirementAge), FIELD_HELP.retirementAge],
  [LIST_LABELS.bodyType, codeName("bodyType", player.bodyType), FIELD_HELP.bodyType],
  [
    LIST_LABELS.developmentType,
    codeName("developmentType", player.developmentType),
    FIELD_HELP.developmentType,
  ],
  [
    LIST_LABELS.developmentStyle,
    codeName("developmentStyle", player.developmentStyle),
    FIELD_HELP.developmentStyle,
  ],
  ...curveFacts(player, curves),
  [RANGE_LABELS.clubRating, optional(player.clubRating), FIELD_HELP.clubRating],
  ...clubFields(player),
  ...(player.loanedFromId === null
    ? []
    : [
        [
          TEXT.card.parentClubRating,
          optional(player.loanedFromRating),
          FIELD_HELP.clubRating,
        ] as const,
      ]),
  [FLAG_LABELS.nationalTeam, player.nationalTeamName ?? TEXT.card.no, FIELD_HELP.nationalTeam],
  [
    FILTER_SECTION_LABELS.traits,
    player.traits.length === 0
      ? TEXT.card.none
      : player.traits.map((trait) => FLAG_LABELS[trait]).join(", "),
    TEXT.traitsNote,
  ],
];

/**
 * Price and wage, career only: the user's squad shows its stored wage, others an estimate. A loaned
 * player has no price and, unless lent by the user's club or to it, no wage: a dash for each.
 */
const money = (
  { price, wage, storedWage, loanedFromId }: Player,
  currency: CurrencyCode | null,
): readonly Fact[] =>
  currency === null || (price === null && loanedFromId === null)
    ? []
    : [
        [
          TEXT.card.price,
          price === null ? <MissingValue key="price" /> : TEXT.card.money(price, currency),
          FIELD_HELP.price,
        ],
        [
          storedWage ? TEXT.card.contractWage : TEXT.card.wage,
          wage === null ? (
            <MissingValue key="wage" />
          ) : storedWage ? (
            TEXT.card.money(wage, currency)
          ) : (
            TEXT.card.wageEstimate(wage, currency)
          ),
          FIELD_HELP.wage,
        ],
      ];

/** The club; for a loaned player with the loan noted and his parent club right under it. */
const clubFacts = (player: Player): readonly Fact[] =>
  player.loanedFromId === null
    ? [[TEXT.card.club, clubText(player)]]
    : [
        [TEXT.card.club, TEXT.card.onLoanAt(clubText(player))],
        [TEXT.card.loanedFrom, player.loanedFromName ?? TEXT.card.none],
      ];

/** The other positions with the same best peak, in code order, or undefined without any. */
const samePeakNote = (others: readonly number[], names: PositionNames): string | undefined =>
  others.length === 0 ? undefined : TEXT.card.samePeakAlso(others.map(names.short));

/**
 * His best peak and where it comes, when that position peaks above the preferred one, with the other
 * positions where it comes as high.
 */
export const bestPeak = (
  player: Player,
  showPotential: boolean,
  names: PositionNames,
): readonly Fact[] =>
  showPotential &&
  player.peak !== null &&
  player.bestPeak !== null &&
  player.bestPeakCode !== null &&
  player.bestPeak > player.peak
    ? [
        [
          TEXT.card.bestPeak,
          // The position first, so the badge ends the row in line with the other ratings' badges.
          <>
            <PositionName code={player.bestPeakCode} name={names.short(player.bestPeakCode)} />{" "}
            <AttributeValue value={player.bestPeak} />
          </>,
          HELP_TEXT.peakAtBest,
          samePeakNote(
            codesAtPeak(player.peakByCode, player.bestPeak).filter(
              (code) => code !== player.bestPeakCode,
            ),
            names,
          ),
        ],
      ]
    : [];

const basics = (
  player: Player,
  showPotential: boolean,
  currency: CurrencyCode | null,
  names: PositionNames,
): readonly Fact[] => [
  [
    TEXT.card.position,
    <PositionName
      key="position"
      code={player.positionCode}
      name={names.short(player.positionCode)}
    />,
  ],
  [TEXT.card.age, TEXT.years(player.age), FIELD_HELP.age],
  ...clubFacts(player),
  [TEXT.card.league, optional(player.leagueName)],
  [TEXT.card.nationality, optional(player.nationalityName)],
  [TEXT.card.contract, player.contractEndYear ?? <MissingValue key="contract" />],
  ...money(player, currency),
  [
    TEXT.columns.overall,
    <AttributeValue key="overall" value={player.overall} />,
    FIELD_HELP.overall,
  ],
  ...(showPotential
    ? [
        [
          TEXT.card.potential,
          <WarnedValue
            key="potential"
            label={TEXT.card.potential}
            warning={
              player.peak !== null && player.peak < player.potential
                ? WARNING_TEXT.peakBelowPotential(player.potential)
                : null
            }
          >
            <AttributeValue value={player.potential} />
          </WarnedValue>,
          FIELD_HELP.potential,
        ] as const,
      ]
    : []),
  ...(showPotential && player.peak !== null
    ? [
        [
          TEXT.card.peak,
          <AttributeValue key="peak" value={player.peak} />,
          TEXT.card.peakNote,
        ] as const,
      ]
    : []),
  ...bestPeak(player, showPotential, names),
  [TEXT.card.foot, player.preferredFoot === "left" ? TEXT.card.left : TEXT.card.right],
  [TEXT.card.weakFoot, <Stars key="weak-foot" value={player.weakFoot} />, FIELD_HELP.weakFoot],
  [TEXT.card.height, TEXT.card.heightValue(player.height)],
  [TEXT.card.weight, TEXT.card.weightValue(player.weight)],
];

/** The season so far, career only. */
const CareerFacts = ({ player }: { player: Player }) => (
  <section aria-labelledby="career-title">
    <HelpHeading id="career-title" title={TEXT.card.career} help={HELP_TEXT.career} />
    <Facts
      facts={[
        ...known(
          RANGE_LABELS.form,
          player.form === null ? null : formatRating(player.form),
          FIELD_HELP.form,
        ),
        ...known(RANGE_LABELS.morale, count(player.morale), FIELD_HELP.morale),
        ...SEASON_STAT_KEYS.filter(
          (key) => player.positionGroup === "goalkeeper" || !CLEAN_SHEETS.has(key),
        ).flatMap((key) => known(RANGE_LABELS[key], count(player[key]))),
        ...known(RANGE_LABELS.injuryDays, count(player.injuryDays), FIELD_HELP.injuryDays),
        [FLAG_LABELS.transferListed, yesNo(player.transferListed), FIELD_HELP.transferListed],
        [FLAG_LABELS.loanListed, yesNo(player.loanListed), FIELD_HELP.loanListed],
        ...(player.clubWillSell === null
          ? []
          : [
              [
                FLAG_LABELS.clubWillSell,
                yesNo(player.clubWillSell),
                FIELD_HELP.clubWillSell,
              ] as const,
            ]),
      ]}
    />
  </section>
);

/** Which lists the player is on: the game's shortlist and the own list. */
const ListMarks = ({ shortlisted, watched }: { shortlisted: boolean; watched: boolean }) => (
  <>
    {shortlisted ? (
      <p className="shortlisted">
        <span aria-hidden="true">{TEXT.shortlistedMark}</span> {TEXT.card.shortlisted}
      </p>
    ) : null}
    {watched ? (
      <p className="watched">
        <WatchMark />
        {TEXT.card.watched}
      </p>
    ) : null}
  </>
);

export const PlayerCard = (props: {
  player: Player;
  career: boolean;
  /** The currency money shows in, null without a career. */
  currency: CurrencyCode | null;
  /** The loaded game's development curves. */
  curves: Curves;
  /** The user's side of an offer; null without a career and for the user's own players. */
  offer: OfferContext | null;
  showPotential: boolean;
  /** Position names in the chosen language. */
  names: PositionNames;
  /** Whether the player is on the own watchlist. */
  watched: boolean;
  /** The user's note on the player, empty while there is none. */
  note: string;
  dispatch: Dispatch<ScoutAction>;
  onClose: () => void;
}): JSX.Element => {
  const { player, career, currency, offer, showPotential, names, watched, dispatch, onClose } =
    props;
  const returnFocus = useCallback(
    () =>
      document.querySelector<HTMLElement>(`[data-player-id="${String(player.id)}"]`) ??
      document.getElementById(RESULTS_TITLE_ID),
    [player.id],
  );
  return (
    <ModalDialog title={player.name} className="card" onClose={onClose} returnFocus={returnFocus}>
      <ListMarks shortlisted={player.shortlisted} watched={watched} />
      <WatchlistSection playerId={player.id} watched={watched} dispatch={dispatch} />
      <NoteSection
        playerId={player.id}
        playerName={player.name}
        text={props.note}
        dispatch={dispatch}
      />
      <Facts facts={basics(player, showPotential, currency, names)} />
      {offer === null || currency === null ? null : (
        <OfferFacts key={player.id} player={player} context={offer} currency={currency} />
      )}
      {career ? <CareerFacts player={player} /> : null}
      <section aria-labelledby="profile-title">
        <h3 id="profile-title">{TEXT.card.profile}</h3>
        <Facts facts={profile(player, showPotential, props.curves)} />
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
