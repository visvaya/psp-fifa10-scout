import type { JSX } from "react";
import { useAppUpdate } from "./app-update.ts";
import { TEXT } from "./text.ts";

/**
 * The "new version" prompt under the top bar. The region is always there, so a screen reader hears each
 * change; it is empty until a release waits, is being installed or could not be stored.
 */
export const UpdatePrompt = (): JSX.Element => {
  const { status, install } = useAppUpdate();
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
