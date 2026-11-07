// The order of the rules that break a best peak tie (owner, 2026-11-07): each rule moves up or down by
// a button, no dragging. A view setting beside the best peak checkbox, not a filter.
import { useEffect, useId, useRef } from "react";
import type { Dispatch, JSX, RefObject } from "react";
import { isDefaultOrder, movedRule, TIE_RULES } from "../logic/best-peak.ts";
import type { TieRule } from "../logic/best-peak.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import { TIE_RULE_LABELS } from "./text-choices.ts";
import { TEXT } from "./text.ts";

type Move = -1 | 1;

/** The button to focus once the list shows a change: a rule's move. */
interface Target {
  readonly rule: TieRule;
  readonly by: Move;
}

const MOVES: readonly { readonly by: Move; readonly mark: string }[] = [
  { by: -1, mark: TEXT.upMark },
  { by: 1, mark: TEXT.downMark },
];

const moveLabel = (by: Move, rule: TieRule): string =>
  (by < 0 ? TEXT.tieRuleUp : TEXT.tieRuleDown)(TIE_RULE_LABELS[rule]);

/**
 * Where the keyboard goes once the list shows a change: it stays with the moved rule, on the same
 * button or, at an end where that one goes, on the other.
 */
const useFocusAfterChange = (list: RefObject<HTMLOListElement | null>) => {
  const target = useRef<Target | null>(null);
  useEffect(() => {
    const next = target.current;
    target.current = null;
    if (next === null || list.current === null) return;
    const buttons = [
      ...list.current.querySelectorAll<HTMLButtonElement>(`[data-rule="${next.rule}"] button`),
    ];
    (buttons.find((button) => button.dataset["by"] === String(next.by)) ?? buttons[0])?.focus();
  });
  return (next: Target) => {
    target.current = next;
  };
};

/** A rule with its buttons; the first has no "up", the last no "down". */
const RuleItem = (props: {
  rule: TieRule;
  index: number;
  count: number;
  onMove: (rule: TieRule, by: Move) => void;
}) => {
  const { rule, index } = props;
  return (
    <li data-rule={rule}>
      <span>{TIE_RULE_LABELS[rule]}</span>
      {MOVES.filter(({ by }) => index + by >= 0 && index + by < props.count).map(({ by, mark }) => (
        <button
          key={by}
          type="button"
          className="button tie-order-move"
          data-by={by}
          aria-label={moveLabel(by, rule)}
          onClick={() => {
            props.onMove(rule, by);
          }}
        >
          {mark}
        </button>
      ))}
    </li>
  );
};

/** The rules in their order, and the way back to the default one (the keyboard then goes to the first rule). */
export const TieOrderField = (props: {
  order: readonly TieRule[];
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => {
  const { order, dispatch } = props;
  const labelId = useId();
  const list = useRef<HTMLOListElement>(null);
  const focusAfterChange = useFocusAfterChange(list);
  const choose = (chosen: readonly TieRule[], focus: Target) => {
    focusAfterChange(focus);
    dispatch({ type: "tie-order-chosen", order: chosen });
  };
  return (
    <fieldset className="field" aria-labelledby={labelId}>
      <legend className="field-legend">
        <span id={labelId}>{TEXT.tieOrder}</span>
      </legend>
      <ol ref={list} className="tie-order">
        {order.map((rule, index) => (
          <RuleItem
            key={rule}
            rule={rule}
            index={index}
            count={order.length}
            onMove={(moved, by) => {
              choose(movedRule(order, moved, by), { rule: moved, by });
            }}
          />
        ))}
      </ol>
      <button
        type="button"
        className="button"
        disabled={isDefaultOrder(order)}
        onClick={() => {
          choose(TIE_RULES, { rule: TIE_RULES[0], by: 1 });
        }}
      >
        {TEXT.tieOrderDefault}
      </button>
    </fieldset>
  );
};
