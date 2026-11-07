import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { JSX, MouseEvent, ReactNode } from "react";
import { TEXT } from "./text.ts";

interface ModalDialogProps {
  readonly title: string;
  readonly className: string;
  readonly onClose: () => void;
  /** Where focus goes on close; Safari does not focus a clicked button, so the opener is named. */
  readonly returnFocus: () => HTMLElement | null;
  readonly children: ReactNode;
}

/**
 * On the backdrop: aimed at the dialog itself, outside its box. A panel of the dialog that reaches past its
 * box (a field's explanation, field-help.tsx) is aimed at that panel, so a press there does not count.
 */
const isOutside = (event: MouseEvent<HTMLDialogElement>): boolean => {
  if (event.target !== event.currentTarget) return false;
  const box = event.currentTarget.getBoundingClientRect();
  const { clientX: x, clientY: y } = event;
  return x < box.left || x > box.right || y < box.top || y > box.bottom;
};

/**
 * A native modal dialog: focus moves in, Escape closes it, focus returns to the opener. A click or tap
 * on the backdrop closes it too; a press that starts inside (selecting text, scrolling the card) does
 * not.
 */
export const ModalDialog = ({
  returnFocus,
  title,
  className,
  onClose,
  children,
}: ModalDialogProps): JSX.Element => {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOutside = useRef(false);
  // Where the browser puts focus back on close: in Safari not the clicked opener, so it is moved on.
  // Taken once: a second run of the effect (StrictMode) would find focus inside the dialog.
  const focusedBefore = useRef<Element | null>(null);
  // A dialog may open over another (the card's large chart): each names itself by its own title.
  const titleId = useId();
  useEffect(() => {
    focusedBefore.current ??= document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      // The close event and this cleanup run after Escape: focus moved on meanwhile stays where it is.
      const focused = document.activeElement;
      if (focused === null || focused === document.body || focused === focusedBefore.current)
        returnFocus()?.focus();
    };
  }, [returnFocus]);
  return (
    // A mouse shortcut only: Escape and the close button close it from the keyboard.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby={titleId}
      onClose={(event) => {
        // React passes a dialog's close on to the dialogs around it: only its own closes this one.
        if (event.target === event.currentTarget) onClose();
      }}
      onPointerDown={(event) => {
        pressedOutside.current = isOutside(event);
      }}
      onClick={(event) => {
        // Each press counts once; a keyboard click (detail 0) never closes, whatever came before.
        const startedOutside = pressedOutside.current;
        pressedOutside.current = false;
        if (event.detail > 0 && startedOutside && isOutside(event)) onClose();
      }}
    >
      {/* Not a <header>: a dialog opened from the top bar would put a banner inside its banner. */}
      <div className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="button" onClick={onClose}>
          {TEXT.close}
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
};

/** A button that opens a modal dialog and gets the focus back when it closes. */
export const DialogButton = (props: {
  label: string;
  title: string;
  className: string;
  buttonClassName: string;
  children: ReactNode;
}): JSX.Element => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useCallback(() => buttonRef.current, []);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={props.buttonClassName}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
      >
        {props.label}
      </button>
      {open ? (
        <ModalDialog
          title={props.title}
          className={props.className}
          returnFocus={returnFocus}
          onClose={() => {
            setOpen(false);
          }}
        >
          {props.children}
        </ModalDialog>
      ) : null}
    </>
  );
};
