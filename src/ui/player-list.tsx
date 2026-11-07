// The filtered players, virtualized with fixed row heights: a sortable native table on wide
// screens; the phone rows (player-rows.tsx) share its columns, values and virtual rows.
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { CSSProperties, Dispatch, JSX } from "react";
import { isRangeKey, rangeValue } from "../logic/filter-players.ts";
import { isAttributeName } from "../logic/players.ts";
import type { CurrencyCode } from "../data/career-save.ts";
import type { Player } from "../logic/players.ts";
import type { ScoutAction, ScoutSort } from "../logic/scout-state.ts";
import { ratingValueOf } from "../logic/sort-players.ts";
import type { SortKey } from "../logic/sort-players.ts";
import { AttributeValue, GainValue } from "./attribute-value.tsx";
import { PositionName } from "./position-name.tsx";
import { ATTRIBUTE_LABELS, formatNumber, formatRating, RANGE_LABELS, TEXT } from "./text.ts";
import { useColumnWidths } from "./use-column-widths.ts";
import type { WidthSource } from "./use-column-widths.ts";

/** Row heights as styles.css sets them (td 2.5rem, .player-row 4rem). */
export const ROW_HEIGHT_REM = { table: 2.5, list: 4 } as const;
const OVERSCAN_ROWS = 12;

type TextColumn = keyof typeof TEXT.columns;

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
  if (currency !== null) return TEXT.withCurrency(key, columnLabel(key, ratingName), currency);
  if (key === "positionRating") {
    return ratingName === null ? TEXT.columns.overall : TEXT.ratingAt(ratingName);
  }
  if (key === "ratingGain") return ratingName === null ? TEXT.ratingGain : TEXT.gainAt(ratingName);
  if (key === "positionPeak")
    return ratingName === null ? RANGE_LABELS.peak : TEXT.peakAt(ratingName);
  if (isAttributeName(key)) return ATTRIBUTE_LABELS[key];
  if (isTextColumn(key)) return TEXT.columns[key];
  return isRangeField(key) ? RANGE_LABELS[key] : key;
};

export interface ListProps {
  readonly players: readonly Player[];
  /** Every player of the game: the table's column widths fit them all, whatever the filters. */
  readonly allPlayers: readonly Player[];
  readonly sort: ScoutSort;
  /** The columns to show, the name first in the table (effectiveColumns). */
  readonly columns: readonly SortKey[];
  /** The position of the position rating filter, shown as a column; null without that filter. */
  readonly ratingCode: number | null;
  /** That position's name in the game language; null without that filter. */
  readonly ratingName: string | null;
  /** The career's currency, null without a career. */
  readonly currency: CurrencyCode | null;
  readonly dispatch: Dispatch<ScoutAction>;
}

/** The root font size in px, which enlarged text raises. */
export const rootFontPx = (): number =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

/**
 * The widest of these texts in rem, in the body's font or the given one; every digit as wide as a 0, as
 * the page's tabular digits are (a canvas does not apply them).
 */
export const widestTextRem = (texts: readonly string[], font?: string): number => {
  const context = document.createElement("canvas").getContext("2d");
  if (context === null || texts.length === 0) return 0;
  const style = getComputedStyle(document.body);
  context.font = font ?? `${style.fontSize} ${style.fontFamily}`;
  const shapes = new Set(texts.map((text) => text.replaceAll(/\d/gu, "0")));
  const widest = Math.max(...[...shapes].map((text) => context.measureText(text).width));
  return widest / rootFontPx();
};

/**
 * The best peak cell's two sub-columns (owner, 2026-11-06: in line in every row, not stepped): its badge,
 * then after a --space-1 gap the position, as wide as the widest of these players' in its bold font. The
 * room beside the badge in rem (0 without positions), and that width for styles.css (--best-peak-name).
 */
export const useBestPeakRoom = (
  players: readonly Player[],
): { readonly besideRem: number; readonly style: CSSProperties } =>
  useMemo(() => {
    const body = getComputedStyle(document.body);
    const nameRem = widestTextRem(
      players.flatMap((player) => player.bestPeakName ?? []),
      `600 ${body.fontSize} ${body.fontFamily}`,
    );
    const root = getComputedStyle(document.documentElement);
    const gapRem = Number.parseFloat(root.getPropertyValue("--space-1")) || 0;
    return {
      besideRem: nameRem > 0 ? gapRem + nameRem : 0,
      style: { "--best-peak-name": `${String(nameRem)}rem` },
    };
  }, [players]);

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

/** The results' heading: it takes the focus a closed card cannot give back to a player no longer listed. */
export const RESULTS_TITLE_ID = "results-title";

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

/**
 * The club name, or what stands in for it: a junior of the user's academy, a scouted junior not signed
 * yet (the game: no contract), or a free agent.
 */
export const clubText = (player: Player): string =>
  player.clubName ??
  (player.academy
    ? TEXT.youth
    : player.youth && !player.freeAgent
      ? TEXT.noContract
      : TEXT.freeAgent);

const cellText = (player: Player, key: TextColumn): string | number | null => {
  if (key === "positionCode") return player.positionName;
  if (key === "clubName") return clubText(player);
  if (key === "price") return player.price === null ? null : formatNumber(player.price);
  return player[key];
};

/** A cell without a value: a dash, named for screen readers. */
export const MissingValue = () => (
  <span className="missing-value">
    <span aria-hidden="true">{TEXT.missingMark}</span>
    <span className="visually-hidden">{TEXT.missingValue}</span>
  </span>
);

/** The rating a column shows with its colour band, or null for a text column. */
const ratingIn = (player: Player, column: SortKey, ratingCode: number | null): number | null => {
  if (column === "overall") return player.overall;
  if (column === "potential") return player.potential;
  if (column === "peak") return player.peak;
  if (column === "bestPeak") return player.bestPeak;
  if (column === "positionRating" || column === "positionPeak")
    return ratingValueOf(player, column, ratingCode);
  return isAttributeName(column) ? player.attributes[column] : null;
};

/** A column's number: a rating, or the gain of the chosen position over the OVR. */
const numberIn = (player: Player, column: SortKey, ratingCode: number | null): number | null =>
  column === "ratingGain"
    ? ratingValueOf(player, column, ratingCode)
    : ratingIn(player, column, ratingCode);

/** A column's text when it has no badge, or null when the player has no value for it. */
const valueText = (player: Player, column: SortKey): string | null => {
  if (isTextColumn(column)) {
    const text = cellText(player, column);
    return text === null ? null : String(text);
  }
  const field = isRangeKey(column) || column === "bestPeakGain" ? rangeValue(player, column) : null;
  if (field === null) return null;
  return column === "form" ? formatRating(field) : formatNumber(field);
};

/**
 * A column's text as ColumnValue shows it, the dash of a missing value included, or null for a rating
 * or the gain, drawn as badges.
 */
export const columnText = (
  player: Player,
  column: SortKey,
  ratingCode: number | null,
): string | null =>
  numberIn(player, column, ratingCode) === null
    ? (valueText(player, column) ?? TEXT.missingMark)
    : null;

/** A column's value: a rating with its colour band, the gain with its sign, a number, or the text. */
export const ColumnValue = (props: {
  player: Player;
  column: SortKey;
  ratingCode: number | null;
}) => {
  const { player, column, ratingCode } = props;
  const value = numberIn(player, column, ratingCode);
  if (value !== null) {
    if (column === "ratingGain") return <GainValue value={value} />;
    return column === "bestPeak" && player.bestPeakCode !== null && player.bestPeakName !== null ? (
      <span className="best-peak">
        <AttributeValue value={value} />{" "}
        <PositionName code={player.bestPeakCode} name={player.bestPeakName} />
      </span>
    ) : (
      <AttributeValue value={value} />
    );
  }
  // The position in the colour of its line.
  if (column === "positionCode")
    return <PositionName code={player.positionCode} name={player.positionName} />;
  return valueText(player, column) ?? <MissingValue />;
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
  columnText(player, column, null);

/**
 * The table's column widths (useColumnWidths), the best peak's with room for its widest position beside
 * the badges, and that position's width for styles.css.
 */
const useTableWidths = (source: Omit<WidthSource<Player, SortKey>, "text" | "besidePx">) => {
  const { besideRem, style } = useBestPeakRoom(source.rows);
  const besidePx = useCallback(
    (column: SortKey) => (column === "bestPeak" ? besideRem * rootFontPx() : 0),
    [besideRem],
  );
  const widths = useColumnWidths({ ...source, text: widthText, besidePx });
  return { widths, style };
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
  const { players, allPlayers, sort, columns, ratingCode, ratingName, currency, dispatch } = props;
  const { scrollRef, items, before, after } = useRows(players.length, ROW_HEIGHT_REM.table);
  const label = useCallback(
    (column: SortKey) => columnLabel(column, ratingName, currency),
    [ratingName, currency],
  );
  const tableRef = useRef<HTMLTableElement>(null);
  const { widths, style } = useTableWidths({
    table: tableRef,
    drawn: items.length > 0,
    rows: allPlayers,
    columns,
    label,
  });
  return (
    <div ref={scrollRef} className="scroll table-scroll">
      <table
        ref={tableRef}
        className={widths === null ? "players" : "players measured"}
        style={style}
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
