// The filtered players, virtualized with fixed row heights: a sortable native table on wide
// screens, a two-line list on phones.
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef } from "react";
import type { Dispatch, JSX } from "react";
import { isAttributeName } from "../logic/players.ts";
import type { AttributeName, Player } from "../logic/players.ts";
import type { ScoutAction, ScoutSort } from "../logic/scout-state.ts";
import type { SortKey } from "../logic/sort-players.ts";
import { AttributeValue } from "./attribute-value.tsx";
import { positionOf } from "../logic/positions.ts";
import { ATTRIBUTE_LABELS, RANGE_LABELS, TEXT } from "./text.ts";
import { useColumnWidths } from "./use-column-widths.ts";

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
  "overall",
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

const isRangeField = (key: string): key is keyof typeof RANGE_LABELS => key in RANGE_LABELS;

export const columnLabel = (key: SortKey, ratingCode: number | null = null): string => {
  if (key === "positionRating") {
    return ratingCode === null ? TEXT.columns.overall : TEXT.ratingAt(positionOf(ratingCode).name);
  }
  if (isAttributeName(key)) return ATTRIBUTE_LABELS[key];
  if (isTextColumn(key)) return TEXT.columns[key];
  return isRangeField(key) ? RANGE_LABELS[key] : key;
};

interface ListProps {
  readonly players: readonly Player[];
  /** Every player of the game: the table's column widths fit them all, whatever the filters. */
  readonly allPlayers: readonly Player[];
  readonly sort: ScoutSort;
  readonly showPotential: boolean;
  /** The position of the position rating filter, shown as a column; null without that filter. */
  readonly ratingCode: number | null;
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

/** The club name, or what stands in for it: a free agent, or a junior of the user's academy. */
export const clubText = (player: Player): string =>
  player.clubName ?? (player.youth && !player.freeAgent ? TEXT.youth : TEXT.freeAgent);

const cellText = (player: Player, key: TextColumn): string | number =>
  key === "positionCode"
    ? player.positionName
    : key === "clubName"
      ? clubText(player)
      : (player[key] ?? "");

/** The rating a column shows with its colour band, or null for a text column. */
const ratingIn = (player: Player, column: SortKey, ratingCode: number | null): number | null => {
  if (column === "overall") return player.overall;
  if (column === "potential") return player.potential;
  if (column === "positionRating")
    return player.overallByCode[ratingCode ?? player.positionCode] ?? null;
  return isAttributeName(column) ? player.attributes[column] : null;
};

const HeaderCell = ({
  column,
  sort,
  ratingCode,
  dispatch,
}: { column: SortKey } & Pick<ListProps, "sort" | "ratingCode" | "dispatch">) => (
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
      {columnLabel(column, ratingCode)}
      <span aria-hidden="true" className="sort-mark">
        {sort.key === column ? TEXT.sortMark[sort.direction] : ""}
      </span>
    </button>
  </th>
);

const TableRow = ({
  player,
  index,
  columns,
  ratingCode,
  dispatch,
}: {
  player: Player;
  index: number;
  columns: readonly SortKey[];
  ratingCode: number | null;
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
    {columns.slice(1).map((column) => {
      const rating = ratingIn(player, column, ratingCode);
      return (
        <td key={column} className={column.endsWith("Name") ? "" : "num"}>
          {rating !== null ? (
            <AttributeValue value={rating} />
          ) : isTextColumn(column) ? (
            cellText(player, column)
          ) : null}
        </td>
      );
    })}
  </tr>
);

const Spacer = ({ height, columns }: { height: number; columns: number }) =>
  height > 0 ? (
    <tr aria-hidden="true" style={{ height }}>
      {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- an empty spacer, hidden */}
      <td colSpan={columns} />
    </tr>
  ) : null;

/** A cell's text for its width, null for a rating cell. */
const widthText = (player: Player, column: SortKey): string | null =>
  isTextColumn(column) && column !== "overall" && column !== "potential"
    ? String(cellText(player, column))
    : null;

/** The table's columns and their labels, stable while the position rating and potential stay. */
const useTableColumns = (ratingCode: number | null, showPotential: boolean) => {
  const columns = useMemo(
    (): readonly SortKey[] => [
      ...TEXT_COLUMNS.slice(0, -2),
      "overall",
      ...(ratingCode === null ? [] : ["positionRating" as const]),
      ...(showPotential ? ["potential" as const] : []),
      ...TABLE_ATTRIBUTES,
    ],
    [ratingCode, showPotential],
  );
  const label = useCallback((column: SortKey) => columnLabel(column, ratingCode), [ratingCode]);
  return { columns, label };
};

const ColumnGroup = ({ widths }: { widths: readonly number[] | null }) =>
  widths === null ? null : (
    <colgroup>
      {widths.map((width, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- one col per column, in column order
        <col key={index} style={{ width }} />
      ))}
    </colgroup>
  );

export const PlayerTable = (props: ListProps): JSX.Element => {
  const { players, allPlayers, sort, showPotential, ratingCode, dispatch } = props;
  const { scrollRef, items, before, after } = useRows(players.length, ROW_HEIGHT_PX.table);
  const { columns, label } = useTableColumns(ratingCode, showPotential);
  const tableRef = useRef<HTMLTableElement>(null);
  const widths = useColumnWidths({
    table: tableRef,
    drawn: items.length > 0,
    rows: allPlayers,
    columns,
    label,
    text: widthText,
  });
  return (
    <div ref={scrollRef} className="scroll table-scroll">
      <table
        ref={tableRef}
        className={widths === null ? "players" : "players measured"}
        aria-rowcount={players.length + 1}
      >
        <ColumnGroup widths={widths} />
        <thead>
          <tr aria-rowindex={1}>
            {columns.map((column) => (
              <HeaderCell
                key={column}
                column={column}
                sort={sort}
                ratingCode={ratingCode}
                dispatch={dispatch}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          <Spacer height={before} columns={columns.length} />
          {items.map((item) => {
            const player = players[item.index];
            return player === undefined ? null : (
              <TableRow
                key={player.id}
                player={player}
                index={item.index}
                columns={columns}
                ratingCode={ratingCode}
                dispatch={dispatch}
              />
            );
          })}
          <Spacer height={after} columns={columns.length} />
        </tbody>
      </table>
    </div>
  );
};

/** The column the phone row shows before OVR: the position rating, else the sorted attribute. */
const keyColumn = (sort: ScoutSort, ratingCode: number | null): SortKey | null => {
  if (ratingCode !== null) return "positionRating";
  return isAttributeName(sort.key) ? sort.key : null;
};

/** Labels over the phone rows' numbers; visual only, as each row names its numbers for screen readers. */
const RowsHeader = ({
  column,
  ratingCode,
  showPotential,
}: { column: SortKey | null } & Pick<ListProps, "ratingCode" | "showPotential">) => (
  <div className="player-rows-header" aria-hidden="true">
    {column === null ? null : <span>{columnLabel(column, ratingCode)}</span>}
    <span>{TEXT.columns.overall}</span>
    {showPotential ? <span>{TEXT.potentialShort}</span> : null}
  </div>
);

export const PlayerCards = (props: ListProps): JSX.Element => {
  const { players, sort, showPotential, ratingCode, dispatch } = props;
  const column = keyColumn(sort, ratingCode);
  const { scrollRef, items, before, after } = useRows(players.length, ROW_HEIGHT_PX.list);
  return (
    <>
      <RowsHeader column={column} ratingCode={ratingCode} showPotential={showPotential} />
      <div ref={scrollRef} className="scroll">
        <ol className="player-rows" style={{ paddingTop: before, paddingBottom: after }}>
          {items.map((item) => {
            const player = players[item.index];
            if (player === undefined) return null;
            const extra = column === null ? null : ratingIn(player, column, ratingCode);
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
                        <span className="visually-hidden">
                          {column === null ? null : columnLabel(column, ratingCode)}
                        </span>
                        <AttributeValue value={extra} />
                      </>
                    )}
                    <span className="visually-hidden">{TEXT.columns.overall}</span>
                    <AttributeValue value={player.overall} />
                    {showPotential ? (
                      <>
                        <span className="visually-hidden">{TEXT.columns.potential}</span>
                        <AttributeValue value={player.potential} />
                      </>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
};
