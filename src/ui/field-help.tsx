// The "?" beside a field's name and the explanation it shows in a small panel. The panel is a native
// popover: the browser closes it on a tap outside and when another opens, and keeps it above dialogs and
// scrolling panels; the code places it beside the button (help-place.ts) and handles Escape itself, so a
// dialog under the panel stays open and the focus returns to the button.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { JSX } from "react";
import { helpPanelPlace } from "./help-place.ts";
import { rootFontPx } from "./player-list.tsx";
import { HELP_TEXT } from "./text-help.ts";

/** Where the panel goes beside its button: 1rem from the viewport's sides, 0.25rem from the button. */
const panelPlace = (button: HTMLElement, panel: HTMLElement) => {
  const rem = rootFontPx();
  return helpPanelPlace({
    button: button.getBoundingClientRect(),
    panel: panel.getBoundingClientRect(),
    viewport: { width: document.documentElement.clientWidth, height: window.innerHeight },
    edge: rem,
    gap: rem / 4,
  });
};

/** A field's explanation behind a "?" after its name; nothing for a field without one. */
export const OptionalHelp = (props: { label: string; help: string | undefined }) =>
  props.help === undefined ? null : <FieldHelp label={props.label} text={props.help} />;

/** label: the field's name, which the button's name repeats; text: the explanation. */
export const FieldHelp = (props: { label: string; text: string }): JSX.Element => {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const follow = useCallback(() => {
    const shown = panel.current;
    if (button.current === null || shown === null) return;
    const { left, top } = panelPlace(button.current, shown);
    shown.style.left = `${String(left)}px`;
    shown.style.top = `${String(top)}px`;
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Taken before the browser's own Escape, which would also close a dialog under the panel.
      event.preventDefault();
      panel.current?.hidePopover();
      button.current?.focus();
    };
    follow();
    window.addEventListener("resize", follow);
    document.addEventListener("scroll", follow, { capture: true, passive: true });
    document.addEventListener("keydown", closeOnEscape, { capture: true });
    return () => {
      window.removeEventListener("resize", follow);
      document.removeEventListener("scroll", follow, { capture: true });
      document.removeEventListener("keydown", closeOnEscape, { capture: true });
    };
  }, [open, follow]);
  return (
    <>
      <button
        ref={button}
        type="button"
        className="field-help"
        aria-label={HELP_TEXT.label(props.label)}
        aria-expanded={open}
        aria-controls={id}
        popoverTarget={id}
      >
        {HELP_TEXT.mark}
      </button>
      <span
        ref={panel}
        id={id}
        popover="auto"
        className="field-help-panel"
        onBeforeToggle={(event) => {
          // Beside the button from its first frame; the effect corrects for the panel's size once shown.
          if (event.newState === "open") follow();
        }}
        onToggle={(event) => {
          setOpen(event.newState === "open");
        }}
      >
        {props.text}
      </span>
    </>
  );
};
