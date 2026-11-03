import { describe, expect, it } from "vitest";
import { sortPlayers } from "./sort-players.ts";
import type { SortDirection, SortKey } from "./sort-players.ts";
import { attributes, testPlayer } from "./test-support/player-fixtures.ts";

const PLAYERS = [
  testPlayer({
    id: 5,
    name: "Żurawski",
    nameOrder: 3,
    age: 30,
    clubName: "Łódź",
    attributes: attributes(60),
  }),
  testPlayer({
    id: 2,
    name: "Brożek",
    nameOrder: 0,
    age: 26,
    clubName: null,
    attributes: attributes(70),
  }),
  testPlayer({
    id: 1,
    name: "Zieliński",
    nameOrder: 2,
    age: 26,
    clubName: "Wisła",
    attributes: attributes(40),
  }),
  testPlayer({
    id: 3,
    name: "Brożek",
    nameOrder: 1,
    age: 26,
    clubName: "Lech",
    attributes: attributes(70),
  }),
];

const ids = (key: SortKey, direction: SortDirection): readonly number[] =>
  sortPlayers(PLAYERS, key, direction).map((player) => player.id);

describe("sortPlayers", () => {
  it("sorts numbers both ways, breaking ties by name then id", () => {
    expect(ids("age", "ascending")).toEqual([2, 3, 1, 5]);
    expect(ids("age", "descending")).toEqual([5, 2, 3, 1]);
  });

  it("sorts names by their precomputed order", () => {
    expect(ids("name", "ascending")).toEqual([2, 3, 1, 5]);
    expect(ids("name", "descending")).toEqual([5, 1, 3, 2]);
  });

  it("sorts text in Polish alphabetical order, missing values last in either direction", () => {
    expect(ids("clubName", "ascending")).toEqual([3, 5, 1, 2]);
    expect(ids("clubName", "descending")).toEqual([1, 5, 3, 2]);
    expect(ids("youth", "ascending")).toEqual([2, 3, 1, 5]);
  });

  it("sorts by an attribute", () => {
    expect(ids("dribbling", "descending")).toEqual([2, 3, 5, 1]);
  });

  it("leaves the input untouched", () => {
    sortPlayers(PLAYERS, "age", "ascending");
    expect(PLAYERS.map((player) => player.id)).toEqual([5, 2, 1, 3]);
  });
});
