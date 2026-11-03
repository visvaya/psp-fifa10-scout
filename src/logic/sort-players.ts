// Player ordering by any scalar summary field or attribute; missing values go last either way,
// and ties fall back to the name, then the id (nameOrder), so the order is total. Every key is
// turned into a number first: text by its Polish alphabetical rank, the name by nameOrder.
import { isAttributeName, nameCollator } from "./players.ts";
import type { AttributeName, Player } from "./players.ts";

type Scalar = number | string | boolean | null;
type ScalarKey = {
  [K in keyof Player]: Player[K] extends Scalar ? K : never;
}[keyof Player];

export type SortKey = ScalarKey | AttributeName;
export type SortDirection = "ascending" | "descending";

const valueOf = (player: Player, key: SortKey): Scalar => {
  if (key === "name") return player.nameOrder;
  return isAttributeName(key) ? player.attributes[key] : player[key];
};

/** The values as numbers (null stays null), text replaced by its rank among the distinct values. */
const numericValues = (values: readonly Scalar[]): readonly (number | null)[] => {
  const texts = [...new Set(values.filter((value) => typeof value === "string"))];
  const rank = new Map(texts.toSorted(nameCollator.compare).map((text, index) => [text, index]));
  return values.map((value) =>
    value === null ? null : typeof value === "string" ? (rank.get(value) ?? 0) : Number(value),
  );
};

export const sortPlayers = (
  players: readonly Player[],
  key: SortKey,
  direction: SortDirection,
): readonly Player[] => {
  const sign = direction === "ascending" ? 1 : -1;
  const values = numericValues(players.map((player) => valueOf(player, key)));
  const primary = values.map((value) => (value === null ? null : sign * value));
  const present = primary.filter((value) => value !== null);
  // Missing values sort after every present one, whatever the direction.
  const [lowest, missing] = [Math.min(0, ...present), Math.max(0, ...present) + 1];
  // One integer per player, (value, nameOrder, index), sorted natively: the slow laptop needs that
  // for 13 000 players within the 30 ms budget. The largest key (ids near 4e5 times two counts near
  // 1.3e4) stays far below 2^53.
  const count = players.length;
  const scale = Math.max(0, ...players.map((player) => player.nameOrder)) + 1;
  const keys = Float64Array.from(
    players,
    (player, index) =>
      (((primary[index] ?? missing) - lowest) * scale + player.nameOrder) * count + index,
  ).toSorted();
  return Array.from(keys).flatMap((combined) => players[combined % count] ?? []);
};
