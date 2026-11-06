import { describe, expect, it } from "vitest";
import { RANGE_KEYS } from "./filter-players.ts";
import { ratingValueOf, SORTABLE_KEYS, sortPlayers } from "./sort-players.ts";
import type { SortDirection, SortKey } from "./sort-players.ts";
import { attributes, testPlayer } from "./test-support/player-fixtures.ts";

// Data rows, alike by nature. jscpd:ignore-start
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
// jscpd:ignore-end

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

  it("sorts text with the given collation", () => {
    const clubs = [
      testPlayer({ id: 1, clubName: "Hradec" }),
      testPlayer({ id: 2, clubName: "Chrudim" }),
    ];
    const order = (collator?: Intl.Collator) =>
      sortPlayers(clubs, "clubName", "ascending", collator && { collator }).map(
        (player) => player.id,
      );
    expect(order()).toEqual([2, 1]);
    expect(order(new Intl.Collator("cs"))).toEqual([1, 2]);
  });

  it("sorts a number with missing values last in either direction", () => {
    const rated = PLAYERS.map((player) => ({
      ...player,
      clubRating: player.clubName === null ? null : player.id,
    }));
    const order = (direction: SortDirection) =>
      sortPlayers(rated, "clubRating", direction).map((player) => player.id);
    expect(order("ascending")).toEqual([1, 3, 5, 2]);
    expect(order("descending")).toEqual([5, 3, 1, 2]);
  });

  // The sort packs each value into one integer key: a rating with a decimal must not lose a player.
  it("sorts by the average match rating, one decimal, keeping every player", () => {
    const rated = PLAYERS.map((player, index) => ({
      ...player,
      form: [6.9, 7.2, 6.3, 7.2][index] ?? null,
    }));
    const order = (direction: SortDirection) =>
      sortPlayers(rated, "form", direction).map((player) => player.id);
    expect(order("descending")).toEqual([2, 3, 5, 1]);
    expect(order("ascending")).toEqual([1, 5, 2, 3]);
  });

  it("sorts by the OVR at a chosen position, or at the preferred one without a choice", () => {
    const rated = PLAYERS.map((player) => ({
      ...player,
      positionCode: player.id,
      overallByCode: player.overallByCode.map((_, code) => (code === 4 ? 90 - player.id : code)),
    }));
    const order = (code?: number) =>
      sortPlayers(rated, "positionRating", "descending", { ratingCode: code }).map(
        (player) => player.id,
      );
    expect(order(4)).toEqual([1, 2, 3, 5]);
    expect(order()).toEqual([5, 3, 2, 1]);
  });

  it("sorts by the gain of the chosen position over the OVR, missing without a choice", () => {
    const rated = PLAYERS.map((player) => ({
      ...player,
      overall: 50 + player.id,
      overallByCode: player.overallByCode.map((value, code) => (code === 4 ? 60 : value)),
    }));
    const order = (code?: number) =>
      sortPlayers(rated, "ratingGain", "descending", { ratingCode: code }).map(
        (player) => player.id,
      );
    expect(order(4)).toEqual([1, 2, 3, 5]);
    expect(order()).toEqual(sortPlayers(rated, "name", "ascending").map((player) => player.id));
  });

  it("sorts by the peak at the chosen position, missing without a choice or a career", () => {
    const rated = PLAYERS.map((player) => ({
      ...player,
      peakByCode:
        player.id === 3
          ? []
          : Array.from({ length: 32 }, (_, code) => (code === 4 ? 90 - player.id : 50)),
    }));
    const order = (code?: number) =>
      sortPlayers(rated, "positionPeak", "descending", { ratingCode: code }).map(
        (player) => player.id,
      );
    expect(order(4)).toEqual([1, 2, 5, 3]);
    expect(order()).toEqual(sortPlayers(rated, "name", "ascending").map((player) => player.id));
  });

  // Prices reach 1e8: a key that packed the raw value with the name order and index passed 2^53.
  it("keeps every player of a full database sorted by a large price, missing prices last", () => {
    const priced = Array.from({ length: 13_000 }, (_, index) =>
      testPlayer({
        id: index,
        nameOrder: (index * 7919) % 13_000,
        price: index % 10 === 0 ? null : ((index * 104_729) % 100_000) * 1000,
      }),
    );
    for (const direction of ["ascending", "descending"] as const) {
      const sorted = sortPlayers(priced, "price", direction);
      expect(new Set(sorted.map((player) => player.id)).size).toBe(priced.length);
      const prices = sorted.map((player) => player.price);
      const present = prices.filter((price) => price !== null);
      expect(prices.slice(present.length).every((price) => price === null)).toBe(true);
      const sign = direction === "ascending" ? 1 : -1;
      expect(
        present.every(
          (price, index) => index === 0 || sign * (price - (present[index - 1] ?? 0)) >= 0,
        ),
      ).toBe(true);
    }
  });

  it("sorts by an attribute", () => {
    expect(ids("dribbling", "descending")).toEqual([2, 3, 5, 1]);
  });

  it("offers every range field as a sort key", () => {
    expect(RANGE_KEYS.filter((key) => !SORTABLE_KEYS.includes(key))).toEqual([]);
  });

  it("leaves the input untouched", () => {
    sortPlayers(PLAYERS, "age", "ascending");
    expect(PLAYERS.map((player) => player.id)).toEqual([5, 2, 1, 3]);
  });
});

describe("ratingValueOf", () => {
  const player = testPlayer({
    overall: 60,
    positionCode: 2,
    overallByCode: Array.from({ length: 32 }, (_, code) => 50 + code),
    peakByCode: Array.from({ length: 32 }, (_, code) => 70 + code),
  });

  it("gives the OVR at the chosen position, or at the preferred one without a choice", () => {
    expect(ratingValueOf(player, "positionRating", 4)).toBe(54);
    expect(ratingValueOf(player, "positionRating", null)).toBe(52);
  });

  it("gives the gain and the peak at the chosen position, none without a choice", () => {
    expect(ratingValueOf(player, "ratingGain", 4)).toBe(-6);
    expect(ratingValueOf(player, "positionPeak", 4)).toBe(74);
    expect(ratingValueOf(player, "ratingGain", null)).toBeNull();
    expect(ratingValueOf(player, "positionPeak", null)).toBeNull();
  });
});
