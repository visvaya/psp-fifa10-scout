// The player attributes and traits fifa.db's players table holds, and their record of one player.
import type { EaDbRow } from "../data/ea-db.ts";
import { SaveFormatError } from "../data/save-format-error.ts";

// Column names, alike by nature. jscpd:ignore-start
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

/** The yes/no columns of `players` (0 or 1), in table order. */
export const TRAIT_NAMES = [
  "injuryprone",
  "adaptability",
  "ambition",
  "comesforcrosses",
  "diver",
  "divesintotackles",
  "earlycrosser",
  "fansfavourite",
  "flexibility",
  "highclubidentification",
  "hightrainingworkrate",
  "holdsup",
  "inflexible",
  "latecrosser",
  "leadership",
  "longshottaker",
  "longthrows",
  "lowclubidentification",
  "lowconcentration",
  "lowtrainingworkrate",
  "mediadarling",
  "onetimepasser",
  "playmaker",
  "puncher",
  "pushesupforcorners",
  "rushesoutofgoal",
  "scandalprone",
  "selfish",
  "staysongoalline",
  "technicaldribbler",
] as const;

// jscpd:ignore-end
export type TraitName = (typeof TRAIT_NAMES)[number];
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
