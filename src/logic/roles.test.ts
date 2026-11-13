import { describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import { buildPlayers } from "./players.ts";
import type { Player } from "./players.ts";
import { NO_ROLES, playerRoles, roleNameOf, squadStateOf } from "./roles.ts";
import { testPlayer } from "./test-support/player-fixtures.ts";
import { buildPlainSave, buildScoutDb, SCOUT_USER_TEAM_ID } from "./test-support/scout-db.ts";

/** GK, CB and ST. */
const FORMATION = [0, 5, 30];
const BENCH = 33;

/** OVRs (or peaks) of 40 at every code but the goalkeeper's, the centre-back's and the striker's. */
const atCodes = (gk: number, cb: number, st: number): readonly number[] =>
  Array.from({ length: 32 }, (_, code) => ({ 0: gk, 5: cb, 30: st })[code] ?? 40);

/** A player with OVRs and peaks at GK, CB and ST. */
const member = (
  id: number,
  [gk, cb, st]: readonly [number, number, number],
  extra: Partial<Player> = {},
) =>
  testPlayer({ id, overallByCode: atCodes(gk, cb, st), peakByCode: atCodes(gk, cb, st), ...extra });

/** Three players placed in the eleven, one at each slot. */
const [KEEPER, STOPPER, STRIKER] = [
  member(1, [70, 40, 40]),
  member(2, [40, 70, 40]),
  member(3, [40, 40, 70]),
];
const PLACED_SHEET: readonly (readonly [number, number])[] = [
  [1, 0],
  [2, 5],
  [3, 30],
];

const rolesOf = (squad: readonly Player[], bench: readonly number[], formation = FORMATION) =>
  playerRoles(
    [KEEPER, STOPPER, STRIKER, ...squad],
    new Map([...PLACED_SHEET, ...bench.map((id) => [id, BENCH] as const)]),
    formation,
  );

describe("playerRoles in the club", () => {
  it("makes a placed player 1. at his slot and a benched one his best number", () => {
    const backup = member(4, [60, 70, 50]);
    const centreBack = member(5, [40, 75, 40]);
    const roles = rolesOf([backup, centreBack], [4, 5]);
    expect(roles(KEEPER).roleName).toBe("1. GK");
    expect(roles(STRIKER).roleName).toBe("1. ST");
    // 2. at GK and ST alike; GK, where his OVR is higher.
    expect(roles(backup).roleName).toBe("2. GK");
    expect(roles(centreBack).roleName).toBe("2. CB");
  });

  it("puts the lower id first when two benched players tie at a code", () => {
    const [first, second] = [member(10, [30, 70, 30]), member(11, [30, 70, 30])];
    const roles = rolesOf([second, first], [10, 11]);
    expect(roles(first).roleName).toBe("2. CB");
    expect(roles(second).roleName).toBe("3. CB");
  });

  it("sorts the role by its number, then by the slot's place in the formation", () => {
    const [keeper, striker] = [member(4, [60, 30, 30]), member(5, [30, 30, 60])];
    const roles = rolesOf([keeper, striker], [4, 5]);
    const values = [roles(STRIKER), roles(striker), roles(keeper), roles(KEEPER)].map(
      (fields) => fields.role ?? 0,
    );
    expect(values.toSorted((a, b) => a - b)).toEqual([
      roles(KEEPER).role,
      roles(STRIKER).role,
      roles(keeper).role,
      roles(striker).role,
    ]);
  });

  it("gives no target to his own players and no role to anyone without a formation", () => {
    const backup = member(4, [60, 70, 50]);
    expect(rolesOf([backup], [4])(backup)).toMatchObject({ target: null, peakTarget: null });
    expect(rolesOf([backup], [4], [])(backup)).toEqual(NO_ROLES);
    expect(rolesOf([], [], [])(member(9, [99, 99, 99]))).toEqual(NO_ROLES);
  });
});

describe("playerRoles outside the club", () => {
  it("targets the slot where he would be first or second, today and at the peak", () => {
    const roles = rolesOf([], []);
    const striker = member(20, [40, 40, 80], { clubId: 241, peakByCode: atCodes(40, 40, 65) });
    expect(roles(striker)).toMatchObject({
      role: null,
      squadState: null,
      targetName: "1. ST",
      peakTargetName: "2. ST",
    });
  });

  it("puts him behind a club player of the same value and shows no target past 2.", () => {
    const roles = rolesOf([member(4, [40, 40, 70])], [4]);
    expect(roles(member(20, [40, 40, 70], { clubId: 241 })).targetName).toBe(null);
    expect(roles(member(21, [40, 40, 71], { clubId: 241 })).targetName).toBe("1. ST");
  });

  it("names a target in the game language", () => {
    const value = rolesOf([], [])(member(20, [40, 40, 80])).target;
    expect(roleNameOf(value, (code) => (code === 30 ? "N" : "?"))).toBe("1. N");
    expect(roleNameOf(null, () => "N")).toBe(null);
  });
});

describe("squadStateOf", () => {
  const youngster = { age: 20, peakGain: 6, overallByAge: [60, 62] };
  const veteran = { age: 31, peakGain: 0, overallByAge: [70, 68] };

  it("takes the first rule that matches, retirement and the contract first", () => {
    expect(squadStateOf(testPlayer({ retiring: true, contractYearsLeft: 0 }), 1)).toBe("retiring");
    expect(squadStateOf(testPlayer({ contractYearsLeft: 0, ...youngster }), 3)).toBe(
      "contractEnding",
    );
  });

  it("loans a youngster out and sells a declining player from 3. down", () => {
    expect(squadStateOf(testPlayer(youngster), 3)).toBe("toLoan");
    expect(squadStateOf(testPlayer(youngster), 2)).toBe("toDevelop");
    expect(squadStateOf(testPlayer(veteran), 3)).toBe("toSell");
    expect(squadStateOf(testPlayer(veteran), 2)).toBe("declining");
  });

  it("never loans out or sells a player on loan to the club", () => {
    const loanedIn = { loanedFromId: 241, contractYearsLeft: null };
    expect(squadStateOf(testPlayer({ ...youngster, ...loanedIn }), 3)).toBe("toDevelop");
    expect(squadStateOf(testPlayer({ ...veteran, ...loanedIn }), 3)).toBe("declining");
  });

  it("calls a player at his peak developed and the rest growing", () => {
    expect(squadStateOf(testPlayer({ age: 27, peakGain: 0, overallByAge: [70, 70] }), 1)).toBe(
      "developed",
    );
    expect(squadStateOf(testPlayer({ age: 22, peakGain: 6, overallByAge: [60, 62] }), 1)).toBe(
      "growing",
    );
  });

  it("gives a club player his state with his role", () => {
    const veteranBackup = member(4, [30, 30, 69], veteran);
    const roles = rolesOf([member(5, [40, 40, 70]), veteranBackup], [4, 5]);
    expect(roles(veteranBackup)).toMatchObject({ roleName: "3. ST", squadState: "toSell" });
  });
});

describe("buildPlayers with roles", () => {
  it("gives the user's club roles and states and the others targets, nothing without a career", () => {
    const db = parseEaDb(buildScoutDb());
    const career = buildPlayers(db, parseCareerSave(db, buildPlainSave().dataBin));
    const squad = career.filter((player) => player.clubId === SCOUT_USER_TEAM_ID);
    expect(squad.length).toBeGreaterThan(0);
    expect(squad.every((player) => player.role !== null && player.squadState !== null)).toBe(true);
    expect(career.some((player) => player.target !== null)).toBe(true);
    expect(buildPlayers(db).every((player) => player.role === null && player.target === null)).toBe(
      true,
    );
  });
});
