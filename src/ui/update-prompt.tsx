import type { JSX } from "react";
import type { UpdateStatus } from "./app-update.ts";
import { TEXT } from "./text.ts";

/**
 * The update prompt under the top bar. The region is always there, so a screen reader hears each change;
 * it is empty until a check runs, a release waits, is being installed or could not be stored.
 */
export const UpdatePrompt = (props: { status: UpdateStatus; install: () => void }): JSX.Element => {
  const { status, install } = props;
  const canReload = status === "waiting" || status === "outdated";
  return (
    <output className="update-prompt">
      {status === "idle" ? null : <p>{TEXT.update[status]}</p>}
      {canReload ? (
        <button type="button" className="button primary" onClick={install}>
          {TEXT.update.reload}
        </button>
      ) : null}
    </output>
  );
};
