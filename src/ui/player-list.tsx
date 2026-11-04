// The filtered players, virtualized with fixed row heights: a sortable native table on wide
// screens, a two-line list on phones.
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef } from "react";
import type { Dispatch, JSX, ReactNode, RefObject } from "react";
import { isRangeKey, rangeValue, ratingGain } from "../logic/filter-players.ts";
import type { PlayerFilters } from "../logic/filter-players.ts";
import { phoneColumns } from "../logic/phone-columns.ts";
import { isAttributeName } from "../logic/players.ts";
import type { AttributeName, Player } from "../logic/players.ts";
import type { ScoutAction, ScoutSort } from "../logic/scout-state.ts";
import type { SortKey } from "../logic/sort-players.ts";
import { AttributeValue, GainValue } from "./attribute-value.tsx";
import { PositionName } from "./position-name.tsx";
import { ATTRIBUTE_LABELS, formatNumber, RANGE_LABELS, TEXT } from "./text.ts";
import { useColumnWidths } from "./use-column-widths.ts";

const ROW_HEIGHT_PX = { table: 40, list: 64 } as const;
/**
 * The phone rows in rem, alike for the rows and their smaller labels: the name's least width, a rating's
 * width, a label's width per character and its padding.
 */
const PHONE = {
  nameMinRem: 9,
  ratingRem: 2.25,
  labelRemPerChar: 0.5,
  labelPaddingRem: 0.5,
} as const;
const OVERSCAN_ROWS = 12;

type TextColumn = keyof typeof TEXT.columns;

// The ratings follow the position, before the wide text columns, so they show without scrolling sideways.
const LEAD_COLUMNS: readonly TextColumn[] = ["name", "age", "positionCode"];
const DETAIL_COLUMNS: readonly TextColumn[] = [
  "clubName",
  "leagueName",
  "nationalityName",
  "contractEndYear",
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
  /** The range filters, whose values the phone rows show as columns. */
  readonly ranges: PlayerFilters["ranges"];
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

/** A column's value: a rating with its colour band, the gain with its sign, a number, or the text. */
const ColumnValue = (props: { player: Player; column: SortKey; ratingCode: number | null }) => {
  const { player, column, ratingCode } = props;
  const value = numberIn(player, column, ratingCode);
  if (value !== null) {
    return column === "ratingGain" ? <GainValue value={value} /> : <AttributeValue value={value} />;
  }
  if (isTextColumn(column)) return cellContent(player, column);
  const field = isRangeKey(column) ? rangeValue(player, column) : null;
  return field === null ? null : formatNumber(field);
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
      ...LEAD_COLUMNS,
      "overall",
      ...(ratingCode === null ? [] : (["positionRating", "ratingGain"] as const)),
      ...(showPotential ? ["potential" as const] : []),
      ...ranged,
      ...DETAIL_COLUMNS,
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

/** The width of a phone number column in rem: a rating's, or its label's when that is wider. */
const phoneColumnRem = (label: string): number =>
  Math.max(PHONE.ratingRem, label.length * PHONE.labelRemPerChar + PHONE.labelPaddingRem);

/** The phone rows' grid, shared by the header so each label stands over its column. */
const phoneLayout = (labels: readonly string[]) => {
  const widths = labels.map(phoneColumnRem);
  const sum = widths.reduce((total, width) => total + width, 0);
  return {
    gridTemplateColumns: `minmax(${String(PHONE.nameMinRem)}rem, 1fr) ${widths.map((width) => `${String(width)}rem`).join(" ")}`,
    // At least the screen; wider when the columns do not fit, so the list scrolls sideways.
    width: `max(100%, calc(${String(PHONE.nameMinRem)}rem + ${String(sum)}rem + ${String(widths.length)} * var(--space-2) + var(--space-4) * 2))`,
  };
};

/** Labels over the phone rows' numbers; visual only, as each row names its numbers for screen readers. */
const RowsHeader = ({
  ref,
  labels,
  layout,
}: {
  ref: RefObject<HTMLDivElement | null>;
  labels: readonly string[];
  layout: ReturnType<typeof phoneLayout>;
}) => (
  <div ref={ref} className="player-rows-header" aria-hidden="true">
    <div className="player-rows-grid" style={layout}>
      <span />
      {labels.map((label) => (
        <span key={label} className="column-label">
          {label}
        </span>
      ))}
    </div>
  </div>
);

/** One phone row: the name with club, position and age, then the number columns. */
const PhoneRow = (props: {
  player: Player;
  columns: readonly SortKey[];
  labels: readonly string[];
  gridTemplateColumns: string;
  ratingCode: number | null;
  dispatch: Dispatch<ScoutAction>;
}) => {
  const { player, columns, labels, gridTemplateColumns, ratingCode, dispatch } = props;
  return (
    <button
      type="button"
      className="player-row"
      style={{ gridTemplateColumns }}
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
      {columns.map((column, index) => (
        <span key={column} className="player-row-cell">
          <span className="visually-hidden">{labels[index]}</span>
          <ColumnValue player={player} column={column} ratingCode={ratingCode} />
        </span>
      ))}
    </button>
  );
};

export const PlayerCards = (props: ListProps): JSX.Element => {
  const { players, showPotential, ratingCode, ratingName, ranges, sort, dispatch } = props;
  const columns = useMemo(
    () => phoneColumns({ showPotential, ratingCode, ranges, sortKey: sort.key }),
    [showPotential, ratingCode, ranges, sort.key],
  );
  // The potential's short label, as the narrow rows have always shown it.
  const labels = columns.map((column) =>
    column === "potential" ? TEXT.potentialShort : columnLabel(column, ratingName),
  );
  const layout = phoneLayout(labels);
  const headerRef = useRef<HTMLDivElement>(null);
  const { scrollRef, items, before, after } = useRows(players.length, ROW_HEIGHT_PX.list);
  return (
    <>
      <RowsHeader ref={headerRef} labels={labels} layout={layout} />
      <div
        ref={scrollRef}
        className="scroll"
        onScroll={(event) => {
          // The labels follow the columns sideways.
          if (headerRef.current !== null)
            headerRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      >
        <ol
          className="player-rows"
          style={{ width: layout.width, paddingTop: before, paddingBottom: after }}
        >
          {items.map((item) => {
            const player = players[item.index];
            if (player === undefined) return null;
            return (
              <li key={player.id} aria-setsize={players.length} aria-posinset={item.index + 1}>
                <PhoneRow
                  player={player}
                  columns={columns}
                  labels={labels}
                  gridTemplateColumns={layout.gridTemplateColumns}
                  ratingCode={ratingCode}
                  dispatch={dispatch}
                />
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
};
