// The filtered players, virtualized with fixed row heights: a sortable native table on wide
// screens; the phone rows (player-rows.tsx) share its columns, values and virtual rows.
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Dispatch, JSX, ReactNode } from "react";
import { isRangeKey, rangeValue, ratingGain } from "../logic/filter-players.ts";
import type { PlayerFilters } from "../logic/filter-players.ts";
import { isAttributeName } from "../logic/players.ts";
import type { CurrencyCode } from "../data/career-save.ts";
import type { AttributeName, Player } from "../logic/players.ts";
import type { ScoutAction, ScoutSort } from "../logic/scout-state.ts";
import type { SortKey } from "../logic/sort-players.ts";
import { AttributeValue, GainValue } from "./attribute-value.tsx";
import { PositionName } from "./position-name.tsx";
import { ATTRIBUTE_LABELS, formatNumber, RANGE_LABELS, TEXT } from "./text.ts";
import { useColumnWidths } from "./use-column-widths.ts";

/** Row heights as styles.css sets them (td 2.5rem, .player-row 4rem). */
export const ROW_HEIGHT_REM = { table: 2.5, list: 4 } as const;
const OVERSCAN_ROWS = 12;

type TextColumn = keyof typeof TEXT.columns;

// The ratings follow the position, before the wide text columns, so they show without scrolling sideways.
const LEAD_COLUMNS: readonly TextColumn[] = ["name", "age", "positionCode"];
const DETAIL_COLUMNS: readonly TextColumn[] = [
  "clubName",
  "leagueName",
  "nationalityName",
  "contractEndYear",
  "price",
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

/**
 * ratingName: the name of the position rating filter's position, in the game language; currency: the
 * career's, named in the price and wage headings.
 */
export const columnLabel = (
  key: SortKey,
  ratingName: string | null = null,
  currency: CurrencyCode | null = null,
): string => {
  if ((key === "price" || key === "wage") && currency !== null) {
    return TEXT.withCurrency(columnLabel(key, ratingName), currency);
  }
  if (key === "positionRating") {
    return ratingName === null ? TEXT.columns.overall : TEXT.ratingAt(ratingName);
  }
  if (key === "ratingGain") return ratingName === null ? TEXT.ratingGain : TEXT.gainAt(ratingName);
  if (isAttributeName(key)) return ATTRIBUTE_LABELS[key];
  if (isTextColumn(key)) return TEXT.columns[key];
  return isRangeField(key) ? RANGE_LABELS[key] : key;
};

export interface ListProps {
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
  /** The range filters, whose values the phone rows show as columns. */
  readonly ranges: PlayerFilters["ranges"];
  /** The career's currency, null without a career. */
  readonly currency: CurrencyCode | null;
  readonly dispatch: Dispatch<ScoutAction>;
}

/** The root font size in px, which enlarged text raises. */
export const rootFontPx = (): number =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

export const useRows = (count: number, rowHeightRem: number) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowHeight = rowHeightRem * rootFontPx();
  // oxlint-disable-next-line react/incompatible-library -- no React Compiler in this build
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN_ROWS,
  });
  // The virtualizer keeps its sizes; a new root font size (larger text) must lay the rows out again.
  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, rowHeight]);
  const items = virtualizer.getVirtualItems();
  const before = items[0]?.start ?? 0;
  const after = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0);
  return { scrollRef, items, before, after };
};

/** A star before the name of a player on the game's shortlist, where a cut-off name cannot hide it. */
export const ShortlistStar = ({ player }: { player: Player }) =>
  player.shortlisted ? (
    <span className="shortlist-mark" aria-hidden="true">
      {TEXT.shortlistedMark}
    </span>
  ) : null;

/** The star in words for screen readers, after the name and a space. */
export const ShortlistWords = ({ player }: { player: Player }) =>
  player.shortlisted ? <span className="visually-hidden">{` ${TEXT.shortlisted}`}</span> : null;

/** The club name, or what stands in for it: a free agent, or a junior of the user's academy. */
export const clubText = (player: Player): string =>
  player.clubName ?? (player.youth && !player.freeAgent ? TEXT.youth : TEXT.freeAgent);

const cellText = (player: Player, key: TextColumn): string | number => {
  if (key === "positionCode") return player.positionName;
  if (key === "clubName") return clubText(player);
  if (key === "price") return player.price === null ? "" : formatNumber(player.price);
  return player[key] ?? "";
};

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
  if (column === "peak") return player.peak;
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

/** A column's text as ColumnValue shows it, or null for a rating or the gain, drawn as badges. */
export const columnText = (
  player: Player,
  column: SortKey,
  ratingCode: number | null,
): string | null => {
  if (numberIn(player, column, ratingCode) !== null) return null;
  if (isTextColumn(column)) return String(cellText(player, column));
  const field = isRangeKey(column) ? rangeValue(player, column) : null;
  return field === null ? null : formatNumber(field);
};

/** A column's value: a rating with its colour band, the gain with its sign, a number, or the text. */
export const ColumnValue = (props: {
  player: Player;
  column: SortKey;
  ratingCode: number | null;
}) => {
  const { player, column, ratingCode } = props;
  const value = numberIn(player, column, ratingCode);
  if (value !== null) {
    return column === "ratingGain" ? <GainValue value={value} /> : <AttributeValue value={value} />;
  }
  return isTextColumn(column)
    ? cellContent(player, column)
    : columnText(player, column, ratingCode);
};

const isNumberColumn = (column: SortKey): boolean => column !== "name" && !column.endsWith("Name");

const SortMark = (props: { column: SortKey; sort: ScoutSort }) => (
  <span aria-hidden="true" className="sort-mark">
    {props.sort.key === props.column ? TEXT.sortMark[props.sort.direction] : ""}
  </span>
);

const HeaderCell = ({
  column,
  label,
  sort,
  dispatch,
}: { column: SortKey; label: string } & Pick<ListProps, "sort" | "dispatch">) => (
  <th
    scope="col"
    aria-sort={sort.key === column ? sort.direction : undefined}
    className={isNumberColumn(column) ? "num" : ""}
  >
    <button
      type="button"
      className="sort-button"
      onClick={() => {
        dispatch({ type: "sort-changed", key: column });
      }}
    >
      {/* In a number column the mark goes first, so the heading ends where the right-aligned values end. */}
      {isNumberColumn(column) ? <SortMark column={column} sort={sort} /> : null}
      <span className="sort-label">{label}</span>
      {isNumberColumn(column) ? null : <SortMark column={column} sort={sort} />}
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
        <ShortlistStar player={player} />
        {player.name}
        <ShortlistWords player={player} />
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
  currency,
  priced,
}: Pick<
  ListProps,
  "ratingCode" | "ratingName" | "showPotential" | "rangedAttributes" | "currency"
> & {
  readonly priced: boolean;
}) => {
  const columns = useMemo(
    (): readonly SortKey[] => [
      ...LEAD_COLUMNS,
      "overall",
      ...(ratingCode === null ? [] : (["positionRating", "ratingGain"] as const)),
      ...(showPotential ? (["potential", ...(priced ? (["peak"] as const) : [])] as const) : []),
      ...ranged,
      ...DETAIL_COLUMNS.filter((column) => priced || column !== "price"),
      ...TABLE_ATTRIBUTES.filter((name) => !ranged.includes(name)),
    ],
    [ratingCode, showPotential, ranged, priced],
  );
  const label = useCallback(
    (column: SortKey) => columnLabel(column, ratingName, currency),
    [ratingName, currency],
  );
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
  const { players, allPlayers, sort, ratingCode, dispatch } = props;
  const { scrollRef, items, before, after } = useRows(players.length, ROW_HEIGHT_REM.table);
  // Prices exist only in a career.
  const priced = useMemo(() => allPlayers.some((player) => player.price !== null), [allPlayers]);
  const { columns, label } = useTableColumns({ ...props, priced });
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
                label={label(column)}
                sort={sort}
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
