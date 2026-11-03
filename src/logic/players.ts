// One immutable summary per player: fifa.db's players joined with their club, league, national team
// and nationality, and with a career save also the save's links, date and season stats.
import { careerManager, effectiveRows } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { ageOn, birthdateToDate, readTable } from "../data/ea-db.ts";
import type { EaDb, EaDbRow } from "../data/ea-db.ts";
import { SaveFormatError } from "../data/save-format-error.ts";
import { SCOUT_CONFIG } from "./config.ts";
import { baseOverall, careerOverall, potentialDeltas, readCurves } from "./overall-rating.ts";
import { byGroup, positionOf } from "./positions.ts";
import type { PositionGroup } from "./positions.ts";

/** The attribute columns of `players`, in table order (potential is a separate field). */
export const ATTRIBUTE_NAMES = [
  "acceleration",
  "aggression",
  "ballcontrol",
  "crossing",
  "dribbling",
  "finishing",
  "freekicks",
  "heading",
  "longpassing",
  "longshotaccuracy",
  "marking",
  "playercomposure",
  "positioning",
  "reactions",
  "shortpassing",
  "shotpower",
  "sprintspeed",
  "stamina",
  "strength",
  "tackling",
  "tacticalawareness",
  "gkdiving",
  "gkpositioning",
  "handling",
  "reflexes",
] as const;

export type AttributeName = (typeof ATTRIBUTE_NAMES)[number];
export type Attributes = Readonly<Record<AttributeName, number>>;

export const isAttributeName = (name: string): name is AttributeName =>
  (ATTRIBUTE_NAMES as readonly string[]).includes(name);

const isAttributes = (record: Readonly<Record<string, number>>): record is Attributes =>
  ATTRIBUTE_NAMES.every((name) => Number.isFinite(record[name]));

/** The attribute columns of a players row; throws SaveFormatError when one is missing. */
export const attributesOf = (row: EaDbRow): Attributes => {
  const record = Object.fromEntries(ATTRIBUTE_NAMES.map((name) => [name, Number(row[name])]));
  if (!isAttributes(record)) throw new SaveFormatError("Database players lack attribute columns");
  return Object.freeze(record);
};

export interface Player {
  readonly id: number;
  readonly name: string;
  /** The name folded by searchKey, for text search. */
  readonly searchName: string;
  /** Position in Polish alphabetical order of names (ties by id) among the built players. */
  readonly nameOrder: number;
  /** From the generated youth pool (shown only when a save links the player to a team). */
  readonly youth: boolean;
  readonly age: number;
  readonly positionCode: number;
  readonly positionName: string;
  readonly positionGroup: PositionGroup;
  readonly preferredFoot: "left" | "right";
  /** Centimetres. */
  readonly height: number;
  /** Kilograms. */
  readonly weight: number;
  readonly potential: number;
  /** OVR at the preferred position: aged to the career date with a save, from fifa.db without. */
  readonly overall: number;
  /** OVR at each position group, rated the same way. */
  readonly overallByGroup: Readonly<Record<PositionGroup, number>>;
  readonly attributes: Attributes;
  readonly clubId: number | null;
  readonly clubName: string | null;
  readonly leagueId: number | null;
  readonly leagueName: string | null;
  readonly contractEndYear: number | null;
  readonly jerseyNumber: number | null;
  readonly nationalTeamId: number | null;
  readonly nationalTeamName: string | null;
  readonly nationalityId: number;
  readonly nationalityName: string | null;
  readonly form: number | null;
  readonly morale: number | null;
  readonly goals: number | null;
  readonly appearances: number | null;
}

interface Team {
  readonly id: number;
  readonly name: string;
  readonly leagueId: number;
  readonly leagueName: string;
  readonly level: number;
}

interface Placement {
  readonly club?: { readonly team: Team; readonly link: EaDbRow };
  readonly national?: Team;
}

interface Context {
  readonly referenceDate: Date;
  readonly placements: ReadonlyMap<number, Placement>;
  readonly countries: ReadonlyMap<number, string>;
  readonly stats: ReadonlyMap<number, EaDbRow>;
  readonly rate: (row: EaDbRow, attributes: Attributes, positionCode: number) => number;
}

const num = (row: EaDbRow, key: string): number => Number(row[key]);

/** Polish alphabetical order, shared by every text sort. */
export const nameCollator = new Intl.Collator("pl");

/** Text without case and diacritics (ł included, which has no decomposition), for search. */
export const searchKey = (text: string): string =>
  text.normalize("NFD").replaceAll(/\p{M}/gu, "").replaceAll(/ł/giu, "l").toLowerCase();

/** Teams that belong to a league, with that league. */
const teamsById = (db: EaDb): ReadonlyMap<number, Team> => {
  const leagues = new Map(readTable(db, "leagues").map((row) => [num(row, "leagueid"), row]));
  const leagueOfTeam = new Map(
    readTable(db, "leagueteamlinks").map((row) => [num(row, "teamid"), num(row, "leagueid")]),
  );
  return new Map(
    readTable(db, "teams").flatMap((row): [number, Team][] => {
      const id = num(row, "teamid");
      const league = leagues.get(leagueOfTeam.get(id) ?? -1);
      if (league === undefined) return [];
      const leagueId = num(league, "leagueid");
      const [name, leagueName] = [String(row["teamname"]), String(league["leaguename"])];
      return [[id, { id, name, leagueId, leagueName, level: num(league, "level") }]];
    }),
  );
};

/** Each linked player's club (first link to a club league) and national team. */
const placementsOf = (
  links: readonly EaDbRow[],
  teams: ReadonlyMap<number, Team>,
): ReadonlyMap<number, Placement> => {
  const placements = new Map<number, Placement>();
  for (const link of links) {
    const team = teams.get(num(link, "teamid"));
    const playerId = num(link, "playerid");
    const placement = placements.get(playerId) ?? {};
    if (team === undefined) continue;
    if (team.level < SCOUT_CONFIG.clubLeagueLevelBelow && placement.club === undefined) {
      placements.set(playerId, { ...placement, club: { team, link } });
    } else if (team.level === SCOUT_CONFIG.nationalLeagueLevel) {
      placements.set(playerId, { ...placement, national: team });
    }
  }
  return placements;
};

const statOf = (stats: EaDbRow | undefined, key: string): number | null =>
  stats === undefined ? null : num(stats, key);

const teamFields = ({ club, national }: Placement) => ({
  clubId: club?.team.id ?? null,
  clubName: club?.team.name ?? null,
  leagueId: club?.team.leagueId ?? null,
  leagueName: club?.team.leagueName ?? null,
  contractEndYear: club === undefined ? null : num(club.link, "yearcontractvalidtil"),
  jerseyNumber: club === undefined ? null : num(club.link, "jerseynumber"),
  nationalTeamId: national?.id ?? null,
  nationalTeamName: national?.name ?? null,
});

const summary = (row: EaDbRow, context: Context): Omit<Player, "nameOrder"> => {
  const id = num(row, "playerid");
  const position = positionOf(num(row, "preferredposition1"));
  const stats = context.stats.get(id);
  const nationalityId = num(row, "nationality");
  const name = `${String(row["firstname"])} ${String(row["surname"])}`.trim();
  const attributes = attributesOf(row);
  const rate = (code: number): number => context.rate(row, attributes, code);
  return {
    id,
    name,
    searchName: searchKey(name),
    youth: id >= SCOUT_CONFIG.youthPlayerIdStart,
    age: ageOn(birthdateToDate(num(row, "birthdate")), context.referenceDate),
    positionCode: num(row, "preferredposition1"),
    positionName: position.name,
    positionGroup: position.group,
    preferredFoot: num(row, "preferredfoot") === 1 ? "left" : "right",
    height: num(row, "height"),
    weight: num(row, "weight"),
    potential: num(row, "potential"),
    overall: rate(num(row, "preferredposition1")),
    overallByGroup: byGroup(rate),
    attributes,
    ...teamFields(context.placements.get(id) ?? {}),
    nationalityId,
    nationalityName: context.countries.get(nationalityId) ?? null,
    form: statOf(stats, "form"),
    morale: statOf(stats, "morale"),
    goals: statOf(stats, "goals"),
    appearances: statOf(stats, "appearances"),
  };
};

/** Each summary frozen with its nameOrder; the order is computed once so sorts stay numeric. */
const withNameOrder = (players: readonly Omit<Player, "nameOrder">[]): readonly Player[] => {
  const order = new Map(
    players
      .toSorted((a, b) => nameCollator.compare(a.name, b.name) || a.id - b.id)
      .map((player, index) => [player, index]),
  );
  return Object.freeze(
    players.map((player) => Object.freeze({ ...player, nameOrder: order.get(player) ?? 0 })),
  );
};

/** OVR from fifa.db without a save; with one, aged to its last game date (overall-rating.md). */
const rater = (db: EaDb, save: CareerSave | undefined): Context["rate"] => {
  if (save === undefined) return (_row, attributes, code) => baseOverall(attributes, code);
  const curves = readCurves(db);
  const deltas = potentialDeltas(db, save);
  const date = careerManager(db, save).lastGameDate;
  return (row, attributes, code) =>
    careerOverall(
      {
        attributes,
        potential: num(row, "potential") + (deltas.get(num(row, "playerid")) ?? 0),
        birthdate: birthdateToDate(num(row, "birthdate")),
        developmentTypeCode: num(row, "developmenttypecode"),
        developmentStyleCode: num(row, "developmentstylecode"),
      },
      code,
      date,
      curves,
    );
};

/**
 * Every player with his club and nationality; youth-pool players only when a team link, or the
 * save's youth academy or transfer list, places them. With a save, links and stats come from it and ages are taken on its last game date.
 */
export const buildPlayers = (db: EaDb, save?: CareerSave): readonly Player[] => {
  const links =
    save === undefined
      ? readTable(db, "teamplayerlinks")
      : effectiveRows(db, save, "teamplayerlinks");
  const stats = save === undefined ? [] : effectiveRows(db, save, "playerstats");
  const context: Context = {
    referenceDate:
      save === undefined
        ? new Date(SCOUT_CONFIG.referenceDateIso)
        : careerManager(db, save).lastGameDate,
    placements: placementsOf(links, teamsById(db)),
    countries: new Map(
      readTable(db, "country").map((row) => [num(row, "countryid"), String(row["countryname"])]),
    ),
    stats: new Map(stats.map((row) => [num(row, "playerid"), row])),
    rate: rater(db, save),
  };
  // The game keeps generated players out of the leagues until it places them (overall-rating.md, F2).
  const placed = new Set(
    [
      ...links,
      ...(save === undefined
        ? []
        : [
            ...effectiveRows(db, save, "career_youth_accademy"),
            ...effectiveRows(db, save, "career_transfer_list"),
          ]),
    ].map((row) => num(row, "playerid")),
  );
  return withNameOrder(
    readTable(db, "players")
      .filter(
        (row) =>
          num(row, "playerid") < SCOUT_CONFIG.youthPlayerIdStart ||
          placed.has(num(row, "playerid")),
      )
      .map((row) => summary(row, context)),
  );
};
