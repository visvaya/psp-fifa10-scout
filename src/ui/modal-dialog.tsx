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

/** Outside the dialog's box: on its backdrop. */
const isOutside = (event: MouseEvent<HTMLDialogElement>): boolean => {
  const box = event.currentTarget.getBoundingClientRect();
  const { clientX: x, clientY: y } = event;
  return x < box.left || x > box.right || y < box.top || y > box.bottom;
};

/**
 * A native modal dialog: focus moves in, Escape closes it, focus returns to the opener. With a mouse,
 * a click on the backdrop closes it too; a drag that starts inside (selecting text) does not.
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
      onMouseDown={(event) => {
        pressedOutside.current = isOutside(event);
      }}
      onClick={(event) => {
        const mouse = globalThis.matchMedia("(pointer: fine)").matches;
        if (mouse && pressedOutside.current && isOutside(event)) onClose();
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
