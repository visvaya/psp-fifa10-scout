// The card's career section: the role, state and targets (roles.ts), then the season so far.
import { matchesToLevelUp } from "../logic/level-up.ts";
import { SEASON_STAT_KEYS } from "../logic/season-stats.ts";
import type { Player } from "../logic/players.ts";
import { Facts, yesNo } from "./facts.tsx";
import type { Fact } from "./facts.tsx";
import { HelpHeading } from "./field-help.tsx";
import {
  FLAG_LABELS,
  formatNumber,
  formatRating,
  LIST_LABELS,
  RANGE_LABELS,
  TEXT,
  count as countWords,
} from "./text.ts";
import { SQUAD_STATE_LABELS } from "./text-choices.ts";
import { LEVEL_UP_TEXT, MATCHES } from "./text-level-up.ts";
import { FIELD_HELP, HELP_TEXT } from "./text-help.ts";

const count = (value: number | null): string | null =>
  value === null ? null : formatNumber(value);

/** A row only when its value is known: a player without a season in the save gets no rows of "brak"
 * (owner, 2026-11-05). */
const known = (label: string, value: string | null, help?: string): readonly Fact[] =>
  value === null ? [] : [[label, value, help]];

/**
 * The experience bar with the matches to its level-up as a range, and the points the level-up gives, said
 * to come to nothing while his OVR stands at his potential (roadmap 36); the user's squad only.
 */
const levelUpFacts = ({
  levelUpXp,
  levelUpPoints,
  overall,
  potential,
}: Player): readonly Fact[] => {
  if (levelUpXp === null || levelUpPoints === null) return [];
  const { fewest, most } = matchesToLevelUp(levelUpXp);
  const xp = formatNumber(levelUpXp);
  const bar =
    most === 0
      ? LEVEL_UP_TEXT.full(xp)
      : LEVEL_UP_TEXT.bar(
          xp,
          fewest === most
            ? countWords(most, MATCHES)
            : LEVEL_UP_TEXT.range(fewest, countWords(most, MATCHES)),
        );
  const points = formatNumber(levelUpPoints) + (overall >= potential ? LEVEL_UP_TEXT.capped : "");
  return [
    [RANGE_LABELS.levelUpXp, bar, FIELD_HELP.levelUpXp],
    [RANGE_LABELS.levelUpPoints, points, FIELD_HELP.levelUpPoints],
  ];
};

/** Clean sheets, which the game counts for goalkeepers only. */
const CLEAN_SHEETS: ReadonlySet<string> = new Set([
  "totalCleanSheets",
  "cleanSheets",
  "cupCleanSheets",
]);

/** The role, state and targets (roles.ts), the peak's target with the potential. */
const roleFacts = (player: Player, showPotential: boolean): readonly Fact[] => [
  ...known(LIST_LABELS.role, player.roleName, FIELD_HELP.role),
  ...known(
    LIST_LABELS.squadState,
    player.squadState === null ? null : SQUAD_STATE_LABELS[player.squadState],
    FIELD_HELP.squadState,
  ),
  ...known(LIST_LABELS.target, player.targetName, FIELD_HELP.target),
  ...(showPotential
    ? known(LIST_LABELS.peakTarget, player.peakTargetName, FIELD_HELP.peakTarget)
    : []),
];

/** The season so far, career only. */
export const CareerFacts = ({
  player,
  showPotential,
}: {
  player: Player;
  showPotential: boolean;
}) => (
  <section aria-labelledby="career-title">
    <HelpHeading id="career-title" title={TEXT.card.career} help={HELP_TEXT.career} />
    <Facts
      facts={[
        ...roleFacts(player, showPotential),
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
        ...levelUpFacts(player),
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
