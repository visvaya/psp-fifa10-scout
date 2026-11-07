// The names of the attributes and of their groups on the player card, a part of the UI texts beside
// text.ts.
import type { AttributeName } from "../logic/players.ts";
import { pl } from "./typeset.ts";

// Label tables: plain data that only the literal-blind duplicate check sees as alike.
// jscpd:ignore-start
export const ATTRIBUTE_LABELS: Readonly<Record<AttributeName, string>> = {
  acceleration: "Przyspieszenie",
  aggression: "Agresja",
  ballcontrol: "Kontrola piłki",
  crossing: "Dośrodkowania",
  dribbling: "Drybling",
  finishing: "Wykończenie",
  freekicks: "Rzuty wolne",
  heading: "Gra głową",
  longpassing: "Długie podania",
  longshotaccuracy: pl`Strzały z dystansu`,
  marking: "Krycie",
  playercomposure: "Opanowanie",
  positioning: "Ustawianie się",
  reactions: "Reakcje",
  shortpassing: "Krótkie podania",
  shotpower: "Siła strzału",
  sprintspeed: "Szybkość",
  stamina: "Wytrzymałość",
  strength: "Siła",
  tackling: "Odbiór",
  tacticalawareness: "Świadomość taktyczna",
  gkdiving: "Parady",
  gkpositioning: "Ustawianie bramkarza",
  handling: "Chwytanie",
  reflexes: "Refleks",
};

export const ATTRIBUTE_GROUP_LABELS = {
  physical: "Fizyczne",
  technique: "Technika",
  shooting: "Strzały",
  mental: "Mentalne",
  defending: "Obrona",
  goalkeeping: "Bramkarz",
} as const;

// jscpd:ignore-end
