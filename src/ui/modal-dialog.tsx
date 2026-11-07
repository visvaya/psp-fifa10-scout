import { useEffect, useRef } from "react";
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
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      // The close event and this cleanup run after Escape: focus moved on meanwhile stays where it is.
      if (document.activeElement === null || document.activeElement === document.body)
        returnFocus()?.focus();
    };
  }, [returnFocus]);
  return (
    // A mouse shortcut only: Escape and the close button close it from the keyboard.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby="dialog-title"
      onClose={onClose}
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
      <header className="dialog-header">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="button" onClick={onClose}>
          {TEXT.close}
        </button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
};
