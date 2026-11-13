// The filtered players on phones: two-line rows with the filtered and sorted values as columns,
// scrolled sideways under the kept name.
import { useLayoutEffect, useMemo, useRef } from "react";
import type { CSSProperties, Dispatch, JSX, ReactNode, RefObject } from "react";
import type { Player } from "../logic/players.ts";
import type { ScoutAction, ScoutSort } from "../logic/scout-state.ts";
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
  useBestPeakRoom,
  useImageRoom,
  useRows,
  widestTextRem,
} from "./player-list.tsx";
import type { ListMarks, ListProps } from "./player-list.tsx";
import { fitRows } from "./fit-rows.ts";
import { crestOf, GameImage, PortraitSlot } from "./game-image.tsx";
import { PositionName } from "./position-name.tsx";
import { TEXT } from "./text.ts";
import { NBSP } from "./typeset.ts";

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
 * scrolling the name keeps the room left by the first fullColumns number columns.
 */
const PHONE = {
  nameMinRem: 9,
  nameMaxCqw: 45,
  fullColumns: 2,
  ratingRem: 2.25,
  paddingRem: 0.5,
  /** The fade at the right edge while columns follow (--space-6 in styles.css). */
  fadeRem: 1.5,
} as const;
/**
 * The width of a phone number column in rem: a rating's, its label's whole (owner, 2026-11-05: labels are
 * not cut) or its widest value's.
 */
const phoneColumnRem = (labelRem: number, valueRem: number): number =>
  Math.max(PHONE.ratingRem, labelRem + PHONE.paddingRem, valueRem + PHONE.paddingRem);

/** The name column's least width in px in a list this wide (--phone-name-least of phoneLayout). */
const leastNamePx = (listWidth: number): number =>
  Math.min(PHONE.nameMinRem * rootFontPx(), (PHONE.nameMaxCqw / 100) * listWidth);

/** A label with each sort mark after it, as styles.css draws TEXT.sortMark once it is sorted. */
const withSortMarks = (label: string): string[] =>
  Object.values(TEXT.sortMark).map((mark) => `${label} ${mark}`);

/**
 * Each label's width in rem with the wider sort mark, counted in every label so none is cut once sorted;
 * in the labels' font (bold, --font-size-sm).
 */
const measureLabels = (labels: readonly string[]): readonly number[] => {
  const root = getComputedStyle(document.documentElement);
  const sizeRem = Number.parseFloat(root.getPropertyValue("--font-size-sm")) || 1;
  const font = `600 ${String(sizeRem * rootFontPx())}px ${getComputedStyle(document.body).fontFamily}`;
  return labels.map((label) => widestTextRem(withSortMarks(label), font));
};

/**
 * Each column's widest text in rem over every player, so the widths stay put whatever the filters; the
 * best peak's badge with its widest position, a name with the game's image before it.
 */
const useValueRems = (
  players: readonly Player[],
  columns: readonly SortKey[],
  ratingCode: number | null,
  besideRem: number,
): readonly number[] => {
  const imageRoom = useImageRoom();
  return useMemo(
    () =>
      columns.map((column) =>
        column === "bestPeak" && besideRem > 0
          ? PHONE.ratingRem + besideRem
          : imageRoom(column) +
            widestTextRem(
              players.flatMap((player) => columnText(player, column, ratingCode) ?? []),
            ),
      ),
    [players, columns, ratingCode, besideRem, imageRoom],
  );
};

/**
 * The phone rows' grid, shared by the header so each label stands over its column: the values for the
 * rules in styles.css.
 */
const phoneLayout = (labelRems: readonly number[], valueRems: readonly number[]): CSSProperties => {
  const widths = labelRems.map((labelRem, index) =>
    phoneColumnRem(labelRem, valueRems[index] ?? 0),
  );
  const sum = widths.reduce((total, width) => total + width, 0);
  const full = widths.slice(0, PHONE.fullColumns);
  const fullRem = full.reduce((total, width) => total + width, 0);
  const least = `min(${String(PHONE.nameMinRem)}rem, ${String(PHONE.nameMaxCqw)}cqw)`;
  // The list's width (cqw: its container) less the first columns, their gaps and the right padding, or
  // the fade at the right edge when more columns follow, so the first columns show clear of it.
  const edge = widths.length > full.length ? "var(--space-6)" : "var(--space-4)";
  const name = `max(${least}, calc(100cqw - ${String(fullRem)}rem - ${String(full.length)} * var(--space-2) - ${edge}))`;
  return {
    "--phone-name-least": least,
    "--phone-name": name,
    "--phone-columns": `minmax(var(--phone-name), 1fr) ${widths.map((width) => `${String(width)}rem`).join(" ")}`,
    // At least the screen; wider when the columns do not fit, so the list scrolls sideways.
    "--phone-width": `max(100%, calc(var(--phone-name) + ${String(sum)}rem + ${String(widths.length)} * var(--space-2) + var(--space-4)))`,
  };
};

/**
 * Labels over the phone rows' numbers, which sort by their column as the wide table's headings do; the
 * mark of the sorted one comes from styles.css, its direction is in the button's name.
 */
const RowsHeader = (props: {
  ref: RefObject<HTMLDivElement | null>;
  columns: readonly SortKey[];
  labels: readonly string[];
  layout: CSSProperties;
  sort: ScoutSort;
  dispatch: Dispatch<ScoutAction>;
  /** A label got the focus: the list scrolls it into view. */
  onLabelFocus: (label: HTMLElement) => void;
}) => {
  const { ref, columns, labels, layout, sort, dispatch, onLabelFocus } = props;
  return (
    <div ref={ref} className="player-rows-header">
      <div className="player-rows-grid" style={layout}>
        {/* Every column named, the players' too (owner, 2026-11-05); it sorts by name. */}
        <LabelButton
          className="name-label"
          column="name"
          label={TEXT.columns.name}
          sort={sort}
          dispatch={dispatch}
        />
        {columns.map((column, index) => (
          <LabelButton
            key={column}
            className="column-label"
            column={column}
            label={labels[index] ?? ""}
            sort={sort}
            dispatch={dispatch}
            onFocus={onLabelFocus}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * The club after its separator, in parts the ellipsis replaces whole: the separator with the image and
 * the first word, then each further word after a non-breaking space, so the line never ends in a space
 * before the ellipsis.
 */
const WholeWords = ({
  text,
  separator,
  image,
}: {
  text: string;
  separator: string;
  image: ReactNode;
}) => {
  const [first = ""] = text.split(" ");
  return (
    <>
      <span className="meta-part">
        {separator}
        {image}
        {first}
      </span>
      {/* Keyed by where each word starts: words may repeat ("Landu Landu"). */}
      {[...text.matchAll(/ (\S+)/gu)].map((match) => (
        <span key={match.index} className="meta-part">
          {NBSP}
          {match[1]}
        </span>
      ))}
    </>
  );
};

/** A column's label: it sorts by the column, another tap turns the order round. */
const LabelButton = (props: {
  className: string;
  column: SortKey;
  label: string;
  sort: ScoutSort;
  dispatch: Dispatch<ScoutAction>;
  onFocus?: (label: HTMLElement) => void;
}) => {
  const { column, label, sort } = props;
  const sorted = sort.key === column;
  return (
    <button
      type="button"
      className={props.className}
      data-sort={sorted ? sort.direction : undefined}
      aria-label={sorted ? TEXT.sortedBy(label, sort.direction) : label}
      onClick={() => {
        props.dispatch({ type: "sort-changed", key: column });
      }}
      onFocus={(event) => {
        props.onFocus?.(event.currentTarget);
      }}
    >
      {label}
    </button>
  );
};

/**
 * The name, also as "A. Surname" when it has two parts, which styles.css shows instead once the full name
 * no longer fits its column (fitNames measures each row, so no length decides it in advance).
 */
const PhoneName = (marks: ListMarks) => {
  const { player } = marks;
  return player.initialName !== null ? (
    <span className="player-row-name has-initial">
      <PortraitSlot player={player} />
      <ShortlistStar {...marks} />
      <span className="player-row-name-full">{player.name}</span>
      <span className="player-row-name-short" aria-hidden="true">
        {player.initialName}
      </span>
      <ShortlistWords {...marks} />
    </span>
  ) : (
    <span className="player-row-name">
      <PortraitSlot player={player} />
      <ShortlistStar {...marks} />
      {player.name}
      <ShortlistWords {...marks} />
    </span>
  );
};

/**
 * Where the list scrolls so a focused label shows whole between the kept name and the right edge (from
 * its start when it does not fit there): a
 * label's padding to spare on the left, the edge's fade on the right, which stays while columns follow.
 * Measured within the header's content, whatever the header's own scroll.
 */
const scrollShowing = (label: HTMLElement, header: HTMLElement, from: number): number => {
  const box = label.getBoundingClientRect();
  const origin = header.getBoundingClientRect().left - header.scrollLeft;
  const rem = rootFontPx();
  const [left, right] = [
    box.left - origin - PHONE.paddingRem * rem,
    box.right - origin + PHONE.fadeRem * rem,
  ];
  // The kept name narrows as the list scrolls, down to its least width (phoneLayout): its right edge
  // in the header's content at a scroll position.
  const name = header.querySelector(".player-rows-grid > :first-child")?.getBoundingClientRect();
  const least = leastNamePx(header.clientWidth);
  const nameEnd = (scroll: number) => Math.max(scroll + least, from + (name?.width ?? 0));
  const fits = (scroll: number) => left >= nameEnd(scroll) && right <= scroll + header.clientWidth;
  if (fits(from)) return from;
  const showEnd = right - header.clientWidth;
  if (showEnd > from && fits(showEnd)) return showEnd;
  // A label wider than the room beside the name shows from its start, the name at its least.
  return left - least;
};

/**
 * Tells styles.css, on the frame of the list and its labels, how far the list has scrolled sideways,
 * whether columns lie beyond its right edge, whether the name column is collapsed (no portraits then,
 * owner 2026-11-13) and how wide its scrollbar is.
 */
const followScroll = (list: HTMLElement, frame: HTMLElement): void => {
  const { scrollLeft, clientWidth, offsetWidth } = list;
  // From where the labels end rather than from the scroll width: Chromium can stop short of the scroll
  // width by the scrollbar's width. A pixel's leeway for rounding.
  const edge = list.getBoundingClientRect().left + clientWidth;
  const cut = [...frame.querySelectorAll(".player-rows-grid > .column-label")]
    .map((label) => label.getBoundingClientRect())
    .find((box) => box.right > edge + 1);
  frame.style.setProperty("--phone-scroll", `${String(scrollLeft)}px`);
  frame.style.setProperty("--phone-scrollbar", `${String(offsetWidth - clientWidth)}px`);
  frame.toggleAttribute("data-scrolled", scrollLeft > 0);
  frame.toggleAttribute("data-more", cut !== undefined);
  // Collapsed: narrowed by the scroll, or at its least width already at rest (wide columns). Half a
  // pixel of leeway for subpixel rounding.
  const name = frame.querySelector(".player-rows-grid > :first-child")?.getBoundingClientRect();
  frame.toggleAttribute(
    "data-collapsed",
    scrollLeft > 0 || (name !== undefined && name.width <= leastNamePx(clientWidth) + 0.5),
  );
  fitRows(frame);
};

/**
 * The line under the name (position, age, club, owner, 2026-11-05): the line's ellipsis replaces the age,
 * and the club's words, whole, never leaving a space before it. What has a column shows there instead.
 */
const MetaLine = ({ player, columns }: { player: Player; columns: readonly SortKey[] }) => {
  const [position, age, club] = [
    !columns.includes("positionCode"),
    !columns.includes("age"),
    !columns.includes("clubName"),
  ];
  if (!(position || age || club)) return null;
  // The first part opens the line and needs no separator.
  return (
    <span className="player-row-meta">
      {position ? <PositionName code={player.positionCode} name={player.positionName} /> : null}
      {age ? (
        <span className="meta-part">
          {position ? TEXT.rowMetaPartSeparator : ""}
          {TEXT.years(player.age)}
        </span>
      ) : null}
      {club ? (
        <WholeWords
          text={clubText(player)}
          separator={position || age ? TEXT.rowMetaPartSeparator : ""}
          image={<GameImage image={crestOf(player.clubId)} />}
        />
      ) : null}
    </span>
  );
};

/** One phone row: the name with what has no column of its own, then the columns. */
const PhoneRow = (
  props: ListMarks & {
    columns: readonly SortKey[];
    labels: readonly string[];
    ratingCode: number | null;
    dispatch: Dispatch<ScoutAction>;
  },
) => {
  const { player, watched, columns, labels, ratingCode, dispatch } = props;
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
        <PhoneName player={player} watched={watched} />
        <MetaLine player={player} columns={columns} />
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

/** The columns' labels and the grid that fits them. */
const usePhoneColumns = (props: ListProps) => {
  const { allPlayers, columns, ratingCode, ratingName, currency } = props;
  const room = useBestPeakRoom(allPlayers);
  const valueRems = useValueRems(allPlayers, columns, ratingCode, room.besideRem);
  // Measured once per change of the columns or their values, not on every render.
  return useMemo(() => {
    // The potential's short label, as the narrow rows have always shown it.
    const labels = columns.map((column) =>
      column === "potential" ? TEXT.potentialShort : columnLabel(column, ratingName, currency),
    );
    const layout = phoneLayout(measureLabels(labels), valueRems);
    return { columns, labels, layout: { ...layout, ...room.style } };
  }, [columns, ratingName, currency, valueRems, room.style]);
};

export const PlayerCards = (props: ListProps): JSX.Element => {
  const { players, ratingCode, sort, watchedIds, dispatch } = props;
  const { columns, labels, layout } = usePhoneColumns(props);
  const headerRef = useRef<HTMLDivElement>(null);
  const { scrollRef, items, before, after } = useRows(players.length, ROW_HEIGHT_REM.list);
  const { frameRef, rowsRef } = useFollowedEdges(scrollRef);
  // Rows come and go as the list scrolls down: each new one fits its name too.
  useLayoutEffect(() => {
    if (frameRef.current !== null) fitRows(frameRef.current);
  });
  return (
    <div ref={frameRef} className="phone-list">
      <RowsHeader
        ref={headerRef}
        columns={columns}
        labels={labels}
        layout={layout}
        sort={sort}
        dispatch={dispatch}
        onLabelFocus={(label) => {
          // The list owns the sideways scroll and the labels follow it, so the two never drift apart,
          // whichever browser also scrolls the labels to the focus by itself.
          const [list, header] = [scrollRef.current, headerRef.current];
          if (list === null || header === null) return;
          list.scrollLeft = scrollShowing(label, header, list.scrollLeft);
          header.scrollLeft = list.scrollLeft;
        }}
      />
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
                  watched={watchedIds.has(player.id)}
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
