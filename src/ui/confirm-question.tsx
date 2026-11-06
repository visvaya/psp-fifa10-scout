import { useEffect, useId, useRef } from "react";
import type { JSX } from "react";
import { TEXT } from "./text.ts";

/**
 * A question with "Anuluj" and a confirm button; the confirm button takes the focus and carries the
 * question. The caller lays the pair out (the class of the question and the wrapper). A subject, read
 * after each button's label but not shown, tells apart the buttons of a list's rows for screen readers.
 */
export const ConfirmQuestion = (props: {
  question: string;
  confirmLabel: string;
  questionClassName?: string;
  subject?: string;
  onAnswer: (confirmed: boolean) => void;
}): JSX.Element => {
  const confirm = useRef<HTMLButtonElement>(null);
  const questionId = useId();
  const subject =
    props.subject === undefined ? null : <span className="visually-hidden">{props.subject}</span>;
  useEffect(() => {
    confirm.current?.focus();
  }, []);
  return (
    <>
      <p id={questionId} className={props.questionClassName}>
        {props.question}
      </p>
      <button
        type="button"
        className="button"
        onClick={() => {
          props.onAnswer(false);
        }}
      >
        {TEXT.cancel}
        {subject}
      </button>
      <button
        ref={confirm}
        type="button"
        className="button primary"
        aria-describedby={questionId}
        onClick={() => {
          props.onAnswer(true);
        }}
      >
        {props.confirmLabel}
        {subject}
      </button>
    </>
  );
};
