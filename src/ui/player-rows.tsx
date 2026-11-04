// The filtered players on phones: two-line rows with the filtered and sorted values as columns,
// scrolled sideways under the kept name.
import { useMemo, useRef } from "react";
import type { CSSProperties, Dispatch, JSX, RefObject } from "react";
import { phoneColumns } from "../logic/phone-columns.ts";
import type { Player } from "../logic/players.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import type { SortKey } from "../logic/sort-players.ts";
import {
  clubText,
  ColumnValue,
  columnLabel,
  ROW_HEIGHT_REM,
  ShortlistMark,
  useRows,
} from "./player-list.tsx";
import type { ListProps } from "./player-list.tsx";
import { PositionName } from "./position-name.tsx";
import { TEXT } from "./text.ts";

declare module "react" {
  // CSS custom properties in the style type: the phone layout passes its computed widths to styles.css.
  interface CSSProperties {
    [property: `--${string}`]: string | undefined;
  }
}

/**
 * The phone rows in rem, alike for the rows and their smaller labels: the name's least width, a rating's
 * width, a label's width per character and its padding. The name never takes more than nameMaxVw of the
 * screen, so with enlarged text the numbers keep room beside it.
 */
const PHONE = {
  nameMinRem: 9,
  nameMaxVw: 45,
  ratingRem: 2.25,
  labelRemPerChar: 0.5,
  labelPaddingRem: 0.5,
} as const;
/** The width of a phone number column in rem: a rating's, or its label's when that is wider. */
const phoneColumnRem = (label: string): number =>
  Math.max(PHONE.ratingRem, label.length * PHONE.labelRemPerChar + PHONE.labelPaddingRem);

/**
 * The phone rows' grid, shared by the header so each label stands over its column: the values for the
 * rules in styles.css.
 */
const phoneLayout = (labels: readonly string[]): CSSProperties => {
  const widths = labels.map(phoneColumnRem);
  const sum = widths.reduce((total, width) => total + width, 0);
  const name = `min(${String(PHONE.nameMinRem)}rem, ${String(PHONE.nameMaxVw)}vw)`;
  return {
    "--phone-columns": `minmax(${name}, 1fr) ${widths.map((width) => `${String(width)}rem`).join(" ")}`,
    // At least the screen; wider when the columns do not fit, so the list scrolls sideways.
    "--phone-width": `max(100%, calc(${name} + ${String(sum)}rem + ${String(widths.length)} * var(--space-2) + var(--space-4)))`,
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
  layout: CSSProperties;
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
  ratingCode: number | null;
  dispatch: Dispatch<ScoutAction>;
}) => {
  const { player, columns, labels, ratingCode, dispatch } = props;
  return (
    <button
      type="button"
      className="player-row"
      data-player-id={player.id}
      onClick={() => {
        dispatch({ type: "player-opened", id: player.id });
      }}
    >
      <span className="player-row-text">
        <span className="player-row-name">
          {player.name}
          <ShortlistMark player={player} />
        </span>
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
  const { players, showPotential, ratingCode, ratingName, ranges, currency, sort, dispatch } =
    props;
  const columns = useMemo(
    () => phoneColumns({ showPotential, ratingCode, ranges, sortKey: sort.key }),
    [showPotential, ratingCode, ranges, sort.key],
  );
  // The potential's short label, as the narrow rows have always shown it.
  const labels = columns.map((column) =>
    column === "potential" ? TEXT.potentialShort : columnLabel(column, ratingName, currency),
  );
  const layout = phoneLayout(labels);
  const headerRef = useRef<HTMLDivElement>(null);
  const { scrollRef, items, before, after } = useRows(players.length, ROW_HEIGHT_REM.list);
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
        <ol className="player-rows" style={{ ...layout, paddingTop: before, paddingBottom: after }}>
          {items.map((item) => {
            const player = players[item.index];
            if (player === undefined) return null;
            return (
              <li key={player.id} aria-setsize={players.length} aria-posinset={item.index + 1}>
                <PhoneRow
                  player={player}
                  columns={columns}
                  labels={labels}
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
