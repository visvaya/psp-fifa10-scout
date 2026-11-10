// The "?" beside a field's name and the explanation it shows in a small panel, and the "!" before a
// value with its note in the same panel. The panel is a native popover: the browser closes it on a tap
// outside and when another opens, and keeps it above dialogs and scrolling panels; the code places it
// beside the button (help-place.ts) and handles Escape itself, so a dialog under the panel stays open
// and the focus returns to the button.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { JSX, ReactNode, RefObject } from "react";
import { helpPanelPlace } from "./help-place.ts";
import { rootFontPx } from "./player-list.tsx";
import { HELP_TEXT, WARNING_TEXT } from "./text-help.ts";

/** Where the panel goes beside its button: 1rem from the viewport's sides, 0.25rem from the button. */
const panelPlace = (button: HTMLElement, panel: HTMLElement) => {
  const rem = rootFontPx();
  // Its full height, also when an earlier placement cut it short: the content plus the borders.
  const height = panel.scrollHeight + panel.offsetHeight - panel.clientHeight;
  return helpPanelPlace({
    button: button.getBoundingClientRect(),
    panel: { width: panel.getBoundingClientRect().width, height },
    viewport: { width: document.documentElement.clientWidth, height: window.innerHeight },
    edge: rem,
    gap: rem / 4,
  });
};

/** The button can be seen: its middle is not scrolled away or under a sticky header. */
const inSight = (button: HTMLElement): boolean => {
  const box = button.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  return hit !== null && button.contains(hit);
};

/**
 * While the panel is open: Escape closes it (before the browser's own Escape, which would also close a
 * dialog under it) and gives the focus back to the button; a scroll moves it with its button, or closes
 * it once the button is out of sight, rather than let it float over a header; a resize moves it.
 */
const useWhileOpen = (
  open: boolean,
  button: RefObject<HTMLButtonElement | null>,
  panel: RefObject<HTMLSpanElement | null>,
  follow: () => void,
) => {
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      panel.current?.hidePopover();
      button.current?.focus();
    };
    const onScroll = () => {
      if (button.current !== null && inSight(button.current)) follow();
      else panel.current?.hidePopover();
    };
    window.addEventListener("resize", follow);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("keydown", closeOnEscape, { capture: true });
    return () => {
      window.removeEventListener("resize", follow);
      document.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("keydown", closeOnEscape, { capture: true });
    };
  }, [open, button, panel, follow]);
};

/** A field's explanation behind a "?" after its name; nothing for a field without one. */
export const OptionalHelp = (props: { label: string; help: string | undefined }) =>
  props.help === undefined ? null : <FieldHelp label={props.label} text={props.help} />;

/** A mark button ("?" or "!") named `name` and the panel with `text` it opens. */
const PanelButton = (props: {
  name: string;
  mark: string;
  className: string;
  text: string;
}): JSX.Element => {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  // Measured while still hidden (styles.css keeps a panel without data-placed invisible), then shown.
  const follow = useCallback(() => {
    const shown = panel.current;
    if (button.current === null || shown === null) return;
    const { left, top, maxHeight } = panelPlace(button.current, shown);
    shown.style.left = `${String(left)}px`;
    shown.style.top = `${String(top)}px`;
    shown.style.maxHeight = `${String(maxHeight)}px`;
    shown.setAttribute("data-placed", "");
  }, []);
  useWhileOpen(open, button, panel, follow);
  return (
    <>
      <button
        ref={button}
        type="button"
        className={props.className}
        aria-label={props.name}
        aria-expanded={open}
        aria-controls={id}
        popoverTarget={id}
      >
        {props.mark}
      </button>
      <span
        ref={panel}
        id={id}
        popover="auto"
        className="field-help-panel"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a long text scrolls inside the panel; focusable, its end is in a keyboard's reach (axe scrollable-region-focusable)
        tabIndex={0}
        onToggle={(event) => {
          const opened = event.newState === "open";
          if (opened) follow();
          else panel.current?.removeAttribute("data-placed");
          setOpen(opened);
        }}
      >
        {props.text}
      </span>
    </>
  );
};

/** label: the field's name, which the button's name repeats; text: the explanation. */
export const FieldHelp = (props: { label: string; text: string }): JSX.Element => (
  <PanelButton
    name={HELP_TEXT.label(props.label)}
    mark={HELP_TEXT.mark}
    className="field-help"
    text={props.text}
  />
);

/** A card section's heading with its "?" beside it, not in it, so the heading keeps its own name. */
/** A section's heading with its "?"; `children`, such as a clear button, follow the "?". */
export const HelpHeading = (props: {
  id: string;
  title: string;
  help: string;
  children?: ReactNode;
}): JSX.Element => (
  <div className="heading-help">
    <h3 id={props.id}>{props.title}</h3>
    <FieldHelp label={props.title} text={props.help} />
    {props.children}
  </div>
);

/** A value with a "!" before it while a note on it holds; label: the field's name. */
export const WarnedValue = (props: {
  label: string;
  warning: string | null;
  children: ReactNode;
}): JSX.Element => (
  <>
    {props.warning === null ? null : (
      <PanelButton
        name={WARNING_TEXT.label(props.label)}
        mark={WARNING_TEXT.mark}
        className="field-help field-warning"
        text={props.warning}
      />
    )}
    {props.children}
  </>
);
