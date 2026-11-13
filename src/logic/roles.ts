// Roles, states and targets in a career (owner's design, item 85(a)): the slots are the codes of the user's
// starting eleven. Each slot has a queue: the player the team sheet places there first, then the others by
// their value at its code. A club player's role is his best place in any queue, his state follows from it
// and from his curves; a player outside the club gets the place he would take as a target.
import { SCOUT_CONFIG } from "./config.ts";
import { BENCH_POSITION_FROM } from "./offer.ts";
import { positionOf } from "./positions.ts";

/** One per club player: the first in this order that applies (squadStateOf). */
export const SQUAD_STATES = [
  "retiring",
  "contractEnding",
  "toLoan",
  "toSell",
  "toDevelop",
  "declining",
  "developed",
  "growing",
] as const;

export type SquadState = (typeof SQUAD_STATES)[number];

/** What roles and states read of a player. */
export interface RoleInput {
  readonly id: number;
  /** The preferred position; a goalkeeper (code 0) is queued only at GK slots. */
  readonly positionCode: number;
  readonly age: number;
  readonly overallByCode: readonly number[];
  readonly peakByCode: readonly number[];
  readonly overallByAge: readonly number[];
  readonly peakGain: number | null;
  readonly retiring: boolean;
  readonly contractYearsLeft: number | null;
  readonly loanedFromId: number | null;
}

export const NO_ROLES = {
  role: null,
  roleName: null,
  squadState: null,
  target: null,
  targetName: null,
  peakTarget: null,
  peakTargetName: null,
} as const;

export type RoleKey = keyof typeof NO_ROLES;

/** The role fields a Player carries; all null without a career, a formation, or for the other side. */
export interface RoleFields {
  /** The club player's role (a role value, roleNameOf); null outside the club. */
  readonly role: number | null;
  readonly roleName: string | null;
  readonly squadState: SquadState | null;
  /** The slot a player outside the club would be 1. or 2. at by OVR today, as a role value. */
  readonly target: number | null;
  readonly targetName: string | null;
  /** The same by his peak at each code, against the club players' peaks. */
  readonly peakTarget: number | null;
  readonly peakTargetName: string | null;
}

/**
 * A role or target is one number, number * 1024 + slot index * 32 + code: it sorts by the number, then by
 * the slot's place in the formation, and filters stay valid while the formation does.
 */
const CODE_SPAN = 32;
const NUMBER_SPAN = CODE_SPAN * CODE_SPAN;

const roleValue = (number: number, index: number, code: number): number =>
  number * NUMBER_SPAN + index * CODE_SPAN + code;

const numberOf = (value: number): number => Math.floor(value / NUMBER_SPAN);

/** "2. CB": the number and the slot's position, named by `nameOf`; null for none. */
export const roleNameOf = (value: number | null, nameOf: (code: number) => string): string | null =>
  value === null ? null : `${String(numberOf(value))}. ${nameOf(value % CODE_SPAN)}`;

const englishName = (code: number): string => positionOf(code).name;

type ValueAt = (player: RoleInput, code: number) => number;

const overallAt: ValueAt = (player, code) => player.overallByCode[code] ?? 0;
const peakAt: ValueAt = (player, code) => player.peakByCode[code] ?? 0;

const GOALKEEPER_CODE = 0;

/** Goalkeepers are queued only at goalkeeper slots, outfield players only at outfield slots. */
const fits = ({ positionCode }: RoleInput, code: number): boolean =>
  (positionCode === GOALKEEPER_CODE) === (code === GOALKEEPER_CODE);

/**
 * The slot with the lowest number in its queue, a tie to the one where `valueAt` is higher, then to the
 * earlier slot, among the slots of his kind (fits); as a role value.
 */
const bestSlot = (
  player: RoleInput,
  formationCodes: readonly number[],
  numberAt: (code: number, index: number) => number,
  valueAt: (code: number) => number,
): number => {
  const all = formationCodes.map((code, index) => ({ code, index }));
  const ofKind = all.filter(({ code }) => fits(player, code));
  // A formation without a slot of his kind leaves him every slot.
  const ranked = (ofKind.length > 0 ? ofKind : all).map(({ code, index }) => ({
    code,
    index,
    number: numberAt(code, index),
  }));
  const best = ranked.reduce((kept, slot) =>
    slot.number < kept.number ||
    (slot.number === kept.number && valueAt(slot.code) > valueAt(kept.code))
      ? slot
      : kept,
  );
  return roleValue(best.number, best.index, best.code);
};

const isDeclining = ({ overallByAge: [now, nextYear] }: RoleInput): boolean =>
  now !== undefined && nextYear !== undefined && nextYear < now;

/** A club player's state from his role's number; one on loan to the club is not his to loan out or sell. */
export const squadStateOf = (player: RoleInput, roleNumber: number): SquadState => {
  const config = SCOUT_CONFIG;
  const benched = roleNumber >= config.benchRoleNumberFrom && player.loanedFromId === null;
  const developing =
    player.age <= config.developAgeMaxYears && (player.peakGain ?? 0) >= config.developGainMinOvr;
  if (player.retiring) return "retiring";
  if (player.contractYearsLeft === 0) return "contractEnding";
  if (benched && developing) return "toLoan";
  if (benched && isDeclining(player)) return "toSell";
  if (developing) return "toDevelop";
  if (isDeclining(player)) return "declining";
  return player.peakGain === 0 ? "developed" : "growing";
};

/**
 * Targets by `valueAt` for players outside the club: at each slot, behind every club player whose value
 * there is at least his; the club's values are read once for everyone.
 */
const targetsBy = (
  squad: readonly RoleInput[],
  formationCodes: readonly number[],
  valueAt: ValueAt,
) => {
  const club = formationCodes.map((code) =>
    squad.filter((other) => fits(other, code)).map((other) => valueAt(other, code)),
  );
  return (player: RoleInput): number | null => {
    const value = bestSlot(
      player,
      formationCodes,
      (slot, index) => {
        const own = valueAt(player, slot);
        return 1 + (club[index] ?? []).filter((other) => other >= own).length;
      },
      (slot) => valueAt(player, slot),
    );
    return numberOf(value) <= SCOUT_CONFIG.targetRoleNumberMax ? value : null;
  };
};

/**
 * Each player's role fields, from the players, the user club's team sheet (player id to its position) and
 * the formation's codes. A placed player is 1. at his slot; a benched one is, at each slot, behind those
 * placed there and the benched with a higher OVR at its code (a tie: the lower id first). Players outside the
 * club get targets (targetsBy). Nothing without a formation.
 */
export const playerRoles = (
  players: readonly RoleInput[],
  sheet: ReadonlyMap<number, number>,
  formationCodes: readonly number[],
): ((player: RoleInput) => RoleFields) => {
  if (formationCodes.length === 0) return () => NO_ROLES;
  const squad = players.filter((player) => sheet.has(player.id));
  const placedCode = (player: RoleInput): number | null => {
    const position = sheet.get(player.id) ?? BENCH_POSITION_FROM;
    return position < BENCH_POSITION_FROM ? position : null;
  };
  const benched = squad.filter((player) => placedCode(player) === null);
  const placedAt = (code: number): number =>
    squad.filter((player) => placedCode(player) === code).length;
  const ahead = (other: RoleInput, player: RoleInput, code: number): boolean =>
    overallAt(other, code) > overallAt(player, code) ||
    (overallAt(other, code) === overallAt(player, code) && other.id < player.id);
  const roleOf = (player: RoleInput): number => {
    const code = placedCode(player);
    if (code !== null) {
      const index = formationCodes.indexOf(code);
      return roleValue(1, index < 0 ? formationCodes.length : index, code);
    }
    return bestSlot(
      player,
      formationCodes,
      (slot) =>
        1 +
        placedAt(slot) +
        benched.filter((other) => fits(other, slot) && ahead(other, player, slot)).length,
      (slot) => overallAt(player, slot),
    );
  };
  const [targetOf, peakTargetOf] = [
    targetsBy(squad, formationCodes, overallAt),
    targetsBy(squad, formationCodes, peakAt),
  ];
  return (player) => {
    if (sheet.has(player.id)) {
      const role = roleOf(player);
      return {
        ...NO_ROLES,
        role,
        roleName: roleNameOf(role, englishName),
        squadState: squadStateOf(player, numberOf(role)),
      };
    }
    const [target, peakTarget] = [targetOf(player), peakTargetOf(player)];
    return {
      ...NO_ROLES,
      target,
      targetName: roleNameOf(target, englishName),
      peakTarget,
      peakTargetName: roleNameOf(peakTarget, englishName),
    };
  };
};
