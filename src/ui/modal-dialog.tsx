import { useEffect, useRef } from "react";
import type { JSX, ReactNode } from "react";
import { TEXT } from "./text.ts";

interface ModalDialogProps {
  readonly title: string;
  readonly className: string;
  readonly onClose: () => void;
  /** Where focus goes on close; Safari does not focus a clicked button, so the opener is named. */
  readonly returnFocus: () => HTMLElement | null;
  readonly children: ReactNode;
}

/** A native modal dialog: focus moves in, Escape closes it, focus returns to the opener. */
export const ModalDialog = ({
  returnFocus,
  title,
  className,
  onClose,
  children,
}: ModalDialogProps): JSX.Element => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      returnFocus()?.focus();
    };
  }, [returnFocus]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby="dialog-title"
      onClose={onClose}
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
