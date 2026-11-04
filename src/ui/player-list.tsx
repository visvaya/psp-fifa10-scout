// The filtered players, virtualized with fixed row heights: a sortable native table on wide
// screens, a two-line list on phones.
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef } from "react";
import type { Dispatch, JSX, ReactNode } from "react";
import { ratingGain } from "../logic/filter-players.ts";
import { isAttributeName } from "../logic/players.ts";
import type { AttributeName, Player } from "../logic/players.ts";
import type { ScoutAction, ScoutSort } from "../logic/scout-state.ts";
import type { SortKey } from "../logic/sort-players.ts";
import { AttributeValue } from "./attribute-value.tsx";
import { PositionName } from "./position-name.tsx";
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

/** ratingName: the name of the position rating filter's position, in the game language. */
export const columnLabel = (key: SortKey, ratingName: string | null = null): string => {
  if (key === "positionRating") {
    return ratingName === null ? TEXT.columns.overall : TEXT.ratingAt(ratingName);
  }
  if (key === "ratingGain") return ratingName === null ? TEXT.ratingGain : TEXT.gainAt(ratingName);
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
  /** That position's name in the game language; null without that filter. */
  readonly ratingName: string | null;
  /** Attributes with a range filter, shown as columns after OVR (rangedAttributes). */
  readonly rangedAttributes: readonly AttributeName[];
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

/** A text cell; the position in the colour of its line. */
const cellContent = (player: Player, key: TextColumn): ReactNode =>
  key === "positionCode" ? (
    <PositionName code={player.positionCode} name={player.positionName} />
  ) : (
    cellText(player, key)
  );

/** The rating a column shows with its colour band, or null for a text column. */
const ratingIn = (player: Player, column: SortKey, ratingCode: number | null): number | null => {
  if (column === "overall") return player.overall;
  if (column === "potential") return player.potential;
  if (column === "positionRating")
    return player.overallByCode[ratingCode ?? player.positionCode] ?? null;
  return isAttributeName(column) ? player.attributes[column] : null;
};

/** A column's number: a rating, or the gain of the chosen position over the OVR. */
const numberIn = (player: Player, column: SortKey, ratingCode: number | null): number | null =>
  column === "ratingGain"
    ? ratingCode === null
      ? null
      : ratingGain(player, ratingCode)
    : ratingIn(player, column, ratingCode);

/** A column's value: a rating with its colour band, the gain with its sign, or the text. */
const ColumnValue = (props: { player: Player; column: SortKey; ratingCode: number | null }) => {
  const { player, column, ratingCode } = props;
  const value = numberIn(player, column, ratingCode);
  if (value !== null) {
    return column === "ratingGain" ? TEXT.signed(value) : <AttributeValue value={value} />;
  }
  return isTextColumn(column) ? cellContent(player, column) : null;
};

const HeaderCell = ({
  column,
  sort,
  ratingName,
  dispatch,
}: { column: SortKey } & Pick<ListProps, "sort" | "ratingName" | "dispatch">) => (
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
      {columnLabel(column, ratingName)}
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
    {columns.slice(1).map((column) => (
      <td key={column} className={column.endsWith("Name") ? "" : "num"}>
        <ColumnValue player={player} column={column} ratingCode={ratingCode} />
      </td>
    ))}
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

/** The table's columns and their labels, stable while the position rating, potential and ranged
 * attributes stay. */
const useTableColumns = ({
  ratingCode,
  ratingName,
  showPotential,
  rangedAttributes: ranged,
}: Pick<ListProps, "ratingCode" | "ratingName" | "showPotential" | "rangedAttributes">) => {
  const columns = useMemo(
    (): readonly SortKey[] => [
      ...TEXT_COLUMNS.slice(0, -2),
      "overall",
      ...(ratingCode === null ? [] : (["positionRating", "ratingGain"] as const)),
      ...(showPotential ? ["potential" as const] : []),
      ...ranged,
      ...TABLE_ATTRIBUTES.filter((name) => !ranged.includes(name)),
    ],
    [ratingCode, showPotential, ranged],
  );
  const label = useCallback((column: SortKey) => columnLabel(column, ratingName), [ratingName]);
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
  const { players, allPlayers, sort, ratingCode, ratingName, dispatch } = props;
  const { scrollRef, items, before, after } = useRows(players.length, ROW_HEIGHT_PX.table);
  const { columns, label } = useTableColumns(props);
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
                ratingName={ratingName}
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

/** The column the phone row shows before OVR: the position rating, else the sorted attribute, else
 * the first ranged attribute. One column only: two long attribute labels would not fit side by side. */
const keyColumn = ({
  sort,
  ratingCode,
  rangedAttributes: ranged,
}: Pick<ListProps, "sort" | "ratingCode" | "rangedAttributes">): SortKey | null => {
  if (ratingCode !== null) return sort.key === "ratingGain" ? "ratingGain" : "positionRating";
  return isAttributeName(sort.key) ? sort.key : (ranged[0] ?? null);
};

/** Labels over the phone rows' numbers; visual only, as each row names its numbers for screen readers. */
const RowsHeader = ({
  column,
  ratingName,
  showPotential,
}: { column: SortKey | null } & Pick<ListProps, "ratingName" | "showPotential">) => (
  <div className="player-rows-header" aria-hidden="true">
    {column === null ? null : <span>{columnLabel(column, ratingName)}</span>}
    <span>{TEXT.columns.overall}</span>
    {showPotential ? <span>{TEXT.potentialShort}</span> : null}
  </div>
);

export const PlayerCards = (props: ListProps): JSX.Element => {
  const { players, showPotential, ratingCode, ratingName, dispatch } = props;
  const column = keyColumn(props);
  const { scrollRef, items, before, after } = useRows(players.length, ROW_HEIGHT_PX.list);
  return (
    <>
      <RowsHeader column={column} ratingName={ratingName} showPotential={showPotential} />
      <div ref={scrollRef} className="scroll">
        <ol className="player-rows" style={{ paddingTop: before, paddingBottom: after }}>
          {items.map((item) => {
            const player = players[item.index];
            if (player === undefined) return null;
            const extra = column === null ? null : numberIn(player, column, ratingCode);
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
                      {clubText(player)}
                      {TEXT.rowMetaSeparator}
                      <PositionName code={player.positionCode} name={player.positionName} />
                      {TEXT.rowMetaSeparator}
                      {TEXT.years(player.age)}
                    </span>
                  </span>
                  <span className="player-row-numbers">
                    {extra === null || column === null ? null : (
                      <>
                        <span className="visually-hidden">{columnLabel(column, ratingName)}</span>
                        <ColumnValue player={player} column={column} ratingCode={ratingCode} />
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
