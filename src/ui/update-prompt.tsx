import type { JSX } from "react";
import { isDismissible } from "./app-update.ts";
import type { UpdateStatus } from "./app-update.ts";
import { TEXT } from "./text.ts";

/**
 * The update prompt under the top bar. The region is always there, so a screen reader hears each change;
 * it is empty until a check runs, a release waits, is being installed or could not be stored. A result
 * with no action of its own has a close button at the end.
 */
export const UpdatePrompt = (props: {
  status: UpdateStatus;
  install: () => void;
  dismiss: () => void;
}): JSX.Element => {
  const { status, install, dismiss } = props;
  const canReload = status === "waiting" || status === "outdated";
  return (
    <output className="update-prompt">
      {status === "idle" ? null : <p>{TEXT.update[status]}</p>}
      {isDismissible(status) ? (
        <button type="button" className="button" aria-label={TEXT.update.dismiss} onClick={dismiss}>
          <span aria-hidden="true">{TEXT.update.dismissMark}</span>
        </button>
      ) : null}
      {canReload ? (
        <button type="button" className="button primary" onClick={install}>
          {TEXT.update.reload}
        </button>
      ) : null}
    </output>
  );
};
