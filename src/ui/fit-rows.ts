// Fitting the phone rows to the name column's room as it narrows and widens: the full name or its
// initial, and the line under it losing or regaining whole parts (player-rows.tsx).

/** The width of an element's text as laid out, also while it is visually hidden (clipped, not removed). */
const textWidth = (element: Element): number => {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect().width;
};

/** An element's width with its side margins, as it takes room in its line. */
const outerWidth = (element: HTMLElement): number => {
  const style = getComputedStyle(element);
  return (
    element.offsetWidth +
    (Number.parseFloat(style.marginLeft) || 0) +
    (Number.parseFloat(style.marginRight) || 0)
  );
};

/**
 * Each long name gives its first name as an initial only once the full name no longer fits its column,
 * row by row as the column narrows (owner, 2026-11-05: smoother than all at once on scrolling).
 */
const fitNames = (frame: HTMLElement): void => {
  for (const name of frame.querySelectorAll<HTMLElement>(".player-row-name.has-initial")) {
    const full = name.querySelector(".player-row-name-full");
    if (full === null) continue;
    // The room beside the stars before the name: the game's shortlist and the own list.
    const stars = [
      ...name.querySelectorAll<HTMLElement>(":scope > :is(.shortlist-mark, .watch-mark)"),
    ];
    const room = stars.reduce((left, star) => left - outerWidth(star), name.clientWidth);
    // Half a pixel of leeway for subpixel rounding.
    const fit = textWidth(full) > room + 0.5 ? "short" : "full";
    const was = name.dataset["fit"];
    if (was === fit) continue;
    name.dataset["fit"] = fit;
    // Only a change of a row already shown fades; a row just come into the list does not.
    if (was !== undefined) name.dataset["swap"] = fit;
  }
};

/** How many of the line's parts show whole: the browser's ellipsis hides those past its right edge. */
const shownParts = (meta: HTMLElement): number => {
  // Half a pixel of leeway for subpixel rounding.
  const right = meta.getBoundingClientRect().right + 0.5;
  return [...meta.children].filter((part) => part.getBoundingClientRect().right <= right).length;
};

/**
 * The line under each name (position, age, club) loses or regains a whole part as its column narrows or
 * widens; a row already shown fades the new line in, as a name does (owner, 2026-11-05: consistent).
 */
const fitMetaLines = (frame: HTMLElement): void => {
  for (const meta of frame.querySelectorAll<HTMLElement>(".player-row-meta")) {
    const parts = String(shownParts(meta));
    const was = meta.dataset["parts"];
    if (was === parts) continue;
    meta.dataset["parts"] = parts;
    // Two values in turn, each with its own animation, so every change replays the fade.
    if (was !== undefined) meta.dataset["swap"] = meta.dataset["swap"] === "a" ? "b" : "a";
  }
};

/** Each shown row's name and the line under it, fitted to the name column's room now. */
export const fitRows = (frame: HTMLElement): void => {
  fitNames(frame);
  fitMetaLines(frame);
};
