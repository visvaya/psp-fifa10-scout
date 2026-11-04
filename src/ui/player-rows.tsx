// The filtered players on phones: two-line rows with the filtered and sorted values as columns,
// scrolled sideways under the kept name.
import { useLayoutEffect, useMemo, useRef } from "react";
import type { CSSProperties, Dispatch, JSX, RefObject } from "react";
import { phoneColumns } from "../logic/phone-columns.ts";
import type { Player } from "../logic/players.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import type { SortKey } from "../logic/sort-players.ts";
import {
  clubText,
  ColumnValue,
  columnLabel,
  columnText,
  ROW_HEIGHT_REM,
  rootFontPx,
  ShortlistStar,
  ShortlistWords,
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
 * width, a label's width per character and the padding of a label or a value. The name never takes more
 * than nameMaxCqw of the list's width, so with enlarged text the numbers keep room beside it. Before
 * scrolling the name keeps the room left by the first fullColumns number columns; a name longer than
 * initialAboveChars shows its first name as an initial once the list scrolls.
 */
const PHONE = {
  nameMinRem: 9,
  nameMaxCqw: 45,
  fullColumns: 2,
  initialAboveChars: 14,
  ratingRem: 2.25,
  labelRemPerChar: 0.5,
  paddingRem: 0.5,
} as const;
/** The width of a phone number column in rem: a rating's, its label's or its widest value's. */
const phoneColumnRem = (label: string, valueRem: number): number =>
  Math.max(
    PHONE.ratingRem,
    label.length * PHONE.labelRemPerChar + PHONE.paddingRem,
    valueRem + PHONE.paddingRem,
  );

/**
 * The widest of these texts in rem, in the rows' font; every digit as wide as a 0, as the page's tabular
 * digits are (a canvas does not apply them).
 */
const widestTextRem = (texts: readonly string[]): number => {
  const context = document.createElement("canvas").getContext("2d");
  if (context === null || texts.length === 0) return 0;
  const style = getComputedStyle(document.body);
  context.font = `${style.fontSize} ${style.fontFamily}`;
  const shapes = new Set(texts.map((text) => text.replaceAll(/\d/gu, "0")));
  const widest = Math.max(...[...shapes].map((text) => context.measureText(text).width));
  return widest / rootFontPx();
};

/** Each column's widest text in rem over every player, so the widths stay put whatever the filters. */
const useValueRems = (
  players: readonly Player[],
  columns: readonly SortKey[],
  ratingCode: number | null,
): readonly number[] =>
  useMemo(
    () =>
      columns.map((column) =>
        widestTextRem(players.flatMap((player) => columnText(player, column, ratingCode) ?? [])),
      ),
    [players, columns, ratingCode],
  );

/**
 * The phone rows' grid, shared by the header so each label stands over its column: the values for the
 * rules in styles.css.
 */
const phoneLayout = (labels: readonly string[], valueRems: readonly number[]): CSSProperties => {
  const widths = labels.map((label, index) => phoneColumnRem(label, valueRems[index] ?? 0));
  const sum = widths.reduce((total, width) => total + width, 0);
  const full = widths.slice(0, PHONE.fullColumns);
  const fullRem = full.reduce((total, width) => total + width, 0);
  const least = `min(${String(PHONE.nameMinRem)}rem, ${String(PHONE.nameMaxCqw)}cqw)`;
  // The list's width (cqw: its container) less the first columns, their gaps and the right padding.
  const name = `max(${least}, calc(100cqw - ${String(fullRem)}rem - ${String(full.length)} * var(--space-2) - var(--space-4)))`;
  return {
    "--phone-name-least": least,
    "--phone-name": name,
    "--phone-columns": `minmax(var(--phone-name), 1fr) ${widths.map((width) => `${String(width)}rem`).join(" ")}`,
    // At least the screen; wider when the columns do not fit, so the list scrolls sideways.
    "--phone-width": `max(100%, calc(var(--phone-name) + ${String(sum)}rem + ${String(widths.length)} * var(--space-2) + var(--space-4)))`,
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

/** The name; a long one also as "A. Surname", which styles.css shows instead once the list scrolls. */
const PhoneName = ({ player }: { player: Player }) =>
  player.initialName !== null && player.name.length > PHONE.initialAboveChars ? (
    <span className="player-row-name has-initial">
      <ShortlistStar player={player} />
      <span className="player-row-name-full">{player.name}</span>
      <span className="player-row-name-short" aria-hidden="true">
        {player.initialName}
      </span>
      <ShortlistWords player={player} />
    </span>
  ) : (
    <span className="player-row-name">
      <ShortlistStar player={player} />
      {player.name}
      <ShortlistWords player={player} />
    </span>
  );

/**
 * Tells styles.css, on the frame of the list and its labels, how far the list has scrolled sideways,
 * whether columns lie beyond its right edge and how wide its scrollbar is.
 */
const followScroll = (list: HTMLElement, frame: HTMLElement): void => {
  const { scrollLeft, clientWidth, offsetWidth } = list;
  // From where the last label ends rather than from the scroll width: Chromium can stop short of the
  // scroll width by the scrollbar's width. A pixel's leeway for rounding.
  const lastLabel = frame.querySelector(".player-rows-grid > :last-child");
  const more =
    (lastLabel?.getBoundingClientRect().right ?? 0) >
    list.getBoundingClientRect().left + clientWidth + 1;
  frame.style.setProperty("--phone-scroll", `${String(scrollLeft)}px`);
  frame.style.setProperty("--phone-scrollbar", `${String(offsetWidth - clientWidth)}px`);
  frame.toggleAttribute("data-scrolled", scrollLeft > 0);
  frame.toggleAttribute("data-more", more);
};

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
        <PhoneName player={player} />
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

/**
 * The frame and the rows for followScroll, which also runs as the screen, the text size and the columns
 * change, as they move the edges as much as scrolling does.
 */
const useFollowedEdges = (scrollRef: RefObject<HTMLDivElement | null>) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    const [frame, list, rows] = [frameRef.current, scrollRef.current, rowsRef.current];
    if (frame === null || list === null || rows === null) return undefined;
    const observer = new ResizeObserver(() => {
      followScroll(list, frame);
    });
    observer.observe(list);
    observer.observe(rows);
    return () => {
      observer.disconnect();
    };
  }, [scrollRef]);
  return { frameRef, rowsRef };
};

export const PlayerCards = (props: ListProps): JSX.Element => {
  const {
    players,
    allPlayers,
    showPotential,
    ratingCode,
    ratingName,
    ranges,
    currency,
    sort,
    dispatch,
  } = props;
  const columns = useMemo(
    () => phoneColumns({ showPotential, ratingCode, ranges, sortKey: sort.key }),
    [showPotential, ratingCode, ranges, sort.key],
  );
  // The potential's short label, as the narrow rows have always shown it.
  const labels = columns.map((column) =>
    column === "potential" ? TEXT.potentialShort : columnLabel(column, ratingName, currency),
  );
  const layout = phoneLayout(labels, useValueRems(allPlayers, columns, ratingCode));
  const headerRef = useRef<HTMLDivElement>(null);
  const { scrollRef, items, before, after } = useRows(players.length, ROW_HEIGHT_REM.list);
  const { frameRef, rowsRef } = useFollowedEdges(scrollRef);
  return (
    <div ref={frameRef} className="phone-list">
      <RowsHeader ref={headerRef} labels={labels} layout={layout} />
      <div
        ref={scrollRef}
        className="scroll phone-scroll"
        onScroll={(event) => {
          const list = event.currentTarget;
          // The labels follow the columns sideways; the kept name narrows as they go.
          if (headerRef.current !== null) headerRef.current.scrollLeft = list.scrollLeft;
          if (frameRef.current !== null) followScroll(list, frameRef.current);
        }}
      >
        <ol
          ref={rowsRef}
          className="player-rows"
          style={{ ...layout, paddingTop: before, paddingBottom: after }}
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
                  ratingCode={ratingCode}
                  dispatch={dispatch}
                />
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
