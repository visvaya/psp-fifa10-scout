// The filtered players, virtualized with fixed row heights: a sortable native table on wide
// screens, a two-line list on phones.
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import type { Dispatch, JSX } from "react";
import { isAttributeName } from "../logic/players.ts";
import type { AttributeName, Player } from "../logic/players.ts";
import type { ScoutAction, ScoutSort } from "../logic/scout-state.ts";
import type { SortKey } from "../logic/sort-players.ts";
import { AttributeValue } from "./attribute-value.tsx";
import { ATTRIBUTE_LABELS, TEXT } from "./text.ts";

const ROW_HEIGHT_PX = { table: 40, list: 64 } as const;
const OVERSCAN_ROWS = 12;

type TextColumn = keyof typeof TEXT.columns;

const TEXT_COLUMNS: readonly TextColumn[] = [
  "name",
  "age",
  "positionCode",
  "clubName",
  "leagueName",
  "nationalityName",
  "contractEndYear",
  "potential",
];
const TABLE_ATTRIBUTES: readonly AttributeName[] = [
  "sprintspeed",
  "dribbling",
  "shortpassing",
  "finishing",
  "tackling",
  "reactions",
];

const isTextColumn = (key: string): key is TextColumn => key in TEXT.columns;

export const columnLabel = (key: SortKey): string => {
  if (isAttributeName(key)) return ATTRIBUTE_LABELS[key];
  return isTextColumn(key) ? TEXT.columns[key] : key;
};

interface ListProps {
  readonly players: readonly Player[];
  readonly sort: ScoutSort;
  readonly dispatch: Dispatch<ScoutAction>;
}

const useRows = (count: number, rowHeight: number) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  // oxlint-disable-next-line react/incompatible-library -- no React Compiler in this build
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN_ROWS,
  });
  const items = virtualizer.getVirtualItems();
  const before = items[0]?.start ?? 0;
  const after = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0);
  return { scrollRef, items, before, after };
};

const clubText = (player: Player): string =>
  player.clubName ?? (player.youth ? TEXT.youth : TEXT.noClub);

const cellText = (player: Player, key: TextColumn): string | number =>
  key === "positionCode"
    ? player.positionName
    : key === "clubName"
      ? clubText(player)
      : (player[key] ?? "");

const HeaderCell = ({
  column,
  sort,
  dispatch,
}: { column: SortKey } & Omit<ListProps, "players">) => (
  <th
    scope="col"
    aria-sort={sort.key === column ? sort.direction : undefined}
    className={column === "name" || column.endsWith("Name") ? "" : "num"}
  >
    <button
      type="button"
      className="sort-button"
      onClick={() => {
        dispatch({ type: "sort-changed", key: column });
      }}
    >
      {columnLabel(column)}
      <span aria-hidden="true" className="sort-mark">
        {sort.key === column ? TEXT.sortMark[sort.direction] : ""}
      </span>
    </button>
  </th>
);

const TableRow = ({
  player,
  index,
  dispatch,
}: {
  player: Player;
  index: number;
  dispatch: Dispatch<ScoutAction>;
}) => (
  <tr aria-rowindex={index + 2}>
    <th scope="row">
      <button
        type="button"
        className="link-button"
        data-player-id={player.id}
        onClick={() => {
          dispatch({ type: "player-opened", id: player.id });
        }}
      >
        {player.name}
      </button>
    </th>
    {TEXT_COLUMNS.slice(1, -1).map((key) => (
      <td key={key} className={key.endsWith("Name") ? "" : "num"}>
        {cellText(player, key)}
      </td>
    ))}
    <td className="num">
      <AttributeValue value={player.potential} />
    </td>
    {TABLE_ATTRIBUTES.map((name) => (
      <td key={name} className="num">
        <AttributeValue value={player.attributes[name]} />
      </td>
    ))}
  </tr>
);

const COLUMN_COUNT = TEXT_COLUMNS.length + TABLE_ATTRIBUTES.length;

const Spacer = ({ height }: { height: number }) =>
  height > 0 ? (
    <tr aria-hidden="true" style={{ height }}>
      {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- an empty spacer, hidden */}
      <td colSpan={COLUMN_COUNT} />
    </tr>
  ) : null;

export const PlayerTable = ({ players, sort, dispatch }: ListProps): JSX.Element => {
  const { scrollRef, items, before, after } = useRows(players.length, ROW_HEIGHT_PX.table);
  return (
    <div ref={scrollRef} className="scroll table-scroll">
      <table className="players" aria-rowcount={players.length + 1}>
        <thead>
          <tr aria-rowindex={1}>
            {[...TEXT_COLUMNS, ...TABLE_ATTRIBUTES].map((column) => (
              <HeaderCell key={column} column={column} sort={sort} dispatch={dispatch} />
            ))}
          </tr>
        </thead>
        <tbody>
          <Spacer height={before} />
          {items.map((item) => {
            const player = players[item.index];
            return player === undefined ? null : (
              <TableRow key={player.id} player={player} index={item.index} dispatch={dispatch} />
            );
          })}
          <Spacer height={after} />
        </tbody>
      </table>
    </div>
  );
};

/** The number the phone row shows next to potential: the sorted attribute, when sorting by one. */
const keyNumber = (player: Player, sort: ScoutSort): number | null =>
  isAttributeName(sort.key) ? player.attributes[sort.key] : null;

export const PlayerCards = ({ players, sort, dispatch }: ListProps): JSX.Element => {
  const { scrollRef, items, before, after } = useRows(players.length, ROW_HEIGHT_PX.list);
  return (
    <div ref={scrollRef} className="scroll">
      <ol className="player-rows" style={{ paddingTop: before, paddingBottom: after }}>
        {items.map((item) => {
          const player = players[item.index];
          if (player === undefined) return null;
          const extra = keyNumber(player, sort);
          return (
            <li key={player.id} aria-setsize={players.length} aria-posinset={item.index + 1}>
              <button
                type="button"
                className="player-row"
                data-player-id={player.id}
                onClick={() => {
                  dispatch({ type: "player-opened", id: player.id });
                }}
              >
                <span className="player-row-text">
                  <span className="player-row-name">{player.name}</span>
                  <span className="player-row-meta">
                    {TEXT.rowMeta(clubText(player), player.positionName, TEXT.years(player.age))}
                  </span>
                </span>
                <span className="player-row-numbers">
                  {extra === null ? null : (
                    <>
                      <span className="visually-hidden">{columnLabel(sort.key)}</span>
                      <AttributeValue value={extra} />
                    </>
                  )}
                  <span className="visually-hidden">{TEXT.columns.potential}</span>
                  <AttributeValue value={player.potential} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
