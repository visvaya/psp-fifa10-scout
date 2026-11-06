import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A new release of the app, as the update prompt shows it. The service worker
 * (scripts/service-worker-template.js) stores a new release in the background and lets it wait until every
 * window of the app is closed; the prompt lets the user install a waiting one at once.
 * - waiting: a new release is stored and waits;
 * - installing: the user asked for it, the page reloads once it has taken over;
 * - outdated: another window installed it, this page still runs the old code;
 * - failed: a new release could not be stored or did not take over;
 * - unregistered: the service worker could not be registered, so the app does not work offline;
 * - checking, downloading, current, unreachable: a check the user asked for (checkForUpdate).
 */
export type UpdateStatus =
  | "idle"
  | "waiting"
  | "installing"
  | "outdated"
  | "failed"
  | "unregistered"
  | "checking"
  | "downloading"
  | "current"
  | "unreachable";

/** What the app reads of a service worker and of its registration; the browser's objects satisfy it. */
interface WorkerLike {
  readonly state: string;
  postMessage: (message: unknown) => void;
  addEventListener: (type: "statechange", listener: () => void) => void;
  removeEventListener: (type: "statechange", listener: () => void) => void;
}

export interface RegistrationLike {
  readonly active: WorkerLike | null;
  readonly installing: WorkerLike | null;
  readonly waiting: WorkerLike | null;
  addEventListener: (type: "updatefound", listener: () => void) => void;
  removeEventListener: (type: "updatefound", listener: () => void) => void;
}

/** A registration that can look for a new worker: the browser's registration satisfies it. */
export interface UpdatableRegistration extends RegistrationLike {
  update: () => Promise<unknown>;
}

/**
 * Looks for a new release on request. The server is asked first: without a network the browser resolves
 * update() as if nothing were new, which would tell an offline user the app is up to date. A new worker
 * found is still downloading; the watcher reports it once it waits.
 */
export const checkForUpdate = async (
  registration: UpdatableRegistration,
  reachable: () => Promise<boolean>,
): Promise<UpdateStatus> => {
  if (!(await reachable())) return "unreachable";
  try {
    await registration.update();
  } catch {
    return "failed";
  }
  if (registration.installing !== null) return "downloading";
  return registration.waiting === null ? "current" : "waiting";
};

/** The message the worker answers with skipWaiting; the worker names it too. */
const TAKE_OVER_MESSAGE = { type: "psp-fifa10-scout:take-over" };

/**
 * On the first launch after an update the browser can report the new release as waiting for a moment
 * before it takes over; shown only after this long, the prompt does not flash.
 */
const WAITING_SHOWN_AFTER_MS = 1500;

/**
 * Reports a release that waits now or later, one that could not be stored, and one that another window
 * installed. A new worker of the very first visit is the app being stored, not an update. Returns the
 * means to stop.
 */
export const watchForUpdates = (
  registration: RegistrationLike,
  report: (status: UpdateStatus) => void,
): (() => void) => {
  const followed = new Set<() => void>();
  const follow = (worker: WorkerLike) => {
    const isUpdate = registration.active !== null;
    // A stored release that a still newer one replaces is not a failure; one that never got stored is.
    let stored = worker.state === "installed";
    const onState = () => {
      if (worker.state === "installed") stored = true;
      if (isUpdate && worker.state === "installed") report("waiting");
      if (isUpdate && worker.state === "redundant" && !stored) report("failed");
      // This page did not ask (installUpdate stops the watcher first): another window did.
      if (isUpdate && worker.state === "activated") report("outdated");
      if (worker.state === "activated" || worker.state === "redundant") stop();
    };
    const stop = () => {
      worker.removeEventListener("statechange", onState);
      followed.delete(stop);
    };
    worker.addEventListener("statechange", onState);
    followed.add(stop);
  };
  const onFound = () => {
    if (registration.installing !== null) follow(registration.installing);
  };
  if (registration.waiting !== null && registration.active !== null) {
    report("waiting");
    follow(registration.waiting);
  }
  if (registration.installing !== null) follow(registration.installing);
  registration.addEventListener("updatefound", onFound);
  return () => {
    registration.removeEventListener("updatefound", onFound);
    for (const stop of followed) stop();
  };
};

/**
 * Asks the waiting release to take over and reloads the page once it has. Followed by the worker's own
 * state rather than the page's controller: a page loaded past the worker (a forced reload) has no
 * controller to change, and is reloaded all the same. The caller stops its watcher first; when no release
 * waits, or one does not take over, this reports the failure and starts the watcher again (watchAgain), so
 * a later release is still reported. Returns the means to stop what it follows, the release or the new
 * watcher: once stopped, it neither reloads, reports nor watches again.
 */
export const installUpdate = (
  registration: RegistrationLike,
  report: (status: UpdateStatus) => void,
  reload: () => void,
  watchAgain: () => () => void,
): (() => void) => {
  const waiting = registration.waiting;
  if (waiting === null) {
    report("failed");
    return watchAgain();
  }
  const onState = () => {
    if (waiting.state !== "activated" && waiting.state !== "redundant") return;
    waiting.removeEventListener("statechange", onState);
    if (waiting.state === "activated") return reload();
    report("failed");
    stop = watchAgain();
  };
  let stop = () => {
    waiting.removeEventListener("statechange", onState);
  };
  waiting.addEventListener("statechange", onState);
  report("installing");
  // A service worker's postMessage takes no target origin; the rule knows only window.postMessage.
  // oxlint-disable-next-line unicorn/require-post-message-target-origin
  waiting.postMessage(TAKE_OVER_MESSAGE);
  return () => {
    stop();
  };
};

/**
 * The registration once its first worker is active (`ready`). That worker can fail to install (its files
 * could not be stored), which `ready` never reports: then this fails, unless a newer worker replaced it,
 * which is followed instead.
 */
export const activeRegistration = async <R extends RegistrationLike>(
  registration: R,
  ready: Promise<unknown>,
): Promise<R> =>
  new Promise((resolve, reject) => {
    let followed: WorkerLike | null = null;
    const follow = (worker: WorkerLike | null) => {
      followed?.removeEventListener("statechange", onState);
      followed = worker;
      followed?.addEventListener("statechange", onState);
    };
    const onState = () => {
      if (followed?.state !== "redundant" || registration.active !== null) return;
      const next = registration.installing ?? registration.waiting;
      follow(next);
      if (next === null) reject(new Error("The first service worker failed to install"));
    };
    if (registration.active === null) follow(registration.installing ?? registration.waiting);
    ready.then(() => {
      follow(null);
      resolve(registration);
    }, reject);
  });

const reloadPage = () => {
  window.location.reload();
};

/** A server that accepts the request but never answers counts as unreachable after this long. */
const REACHABLE_TIMEOUT_MS = 8000;

/** Whether the server answers for the worker script, past every cache; the worker leaves HEAD alone. */
const serverReachable = (): Promise<boolean> =>
  fetch(new URL("sw.js", document.baseURI), {
    method: "HEAD",
    cache: "no-store",
    signal: AbortSignal.timeout(REACHABLE_TIMEOUT_MS),
  }).then(
    (response) => response.ok,
    () => false,
  );

/** How long "up to date" stays before it goes by itself. */
const CURRENT_SHOWN_MS = 5000;

/** A result with no action of its own, which the user can close: up to date, unreachable, a failure. */
export const isDismissible = (status: UpdateStatus): boolean =>
  ["current", "unreachable", "failed", "unregistered"].includes(status);

/**
 * Whether a check may start: not while one runs, and not while a release waits to be installed (its
 * prompt with the reload button would give way to the check's result).
 */
export const canCheck = (status: UpdateStatus): boolean =>
  !["checking", "downloading", "installing", "waiting", "outdated"].includes(status);

/** The header's check button, where focus goes when the prompt's close button it was on goes. */
export const UPDATE_CHECK_ID = "update-check";

const keepFocusOnCheck = () => {
  if (document.activeElement?.closest(".update-prompt")) {
    document.getElementById(UPDATE_CHECK_ID)?.focus();
  }
};

/**
 * "Up to date" needs no answer: it goes by itself, unless a newer status replaced it meanwhile (a release
 * installed in another window); errors stay until closed.
 */
const useExpiringCurrent = (
  status: UpdateStatus,
  setStatus: (update: (shown: UpdateStatus) => UpdateStatus) => void,
) => {
  useEffect(() => {
    if (status !== "current") return undefined;
    const timer = setTimeout(() => {
      keepFocusOnCheck();
      setStatus((shown) => (shown === "current" ? "idle" : shown));
    }, CURRENT_SHOWN_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [status, setStatus]);
};

/**
 * The update prompt's state and actions (React); `install` also serves "outdated" as a plain reload,
 * `check` looks for a new release on request once a worker is active (`registered`). `registering`
 * resolves with the service worker's registration once its worker is active, and is null where none is
 * made (development, an insecure page); `unregistered`: it failed, so the app does not work offline.
 */
export const useAppUpdate = (registering: Promise<UpdatableRegistration> | null) => {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [worker, setWorker] = useState<"pending" | "active" | "failed">("pending");
  const registration = useRef<UpdatableRegistration | null>(null);
  /** Stops the watcher, and the install in progress once there is one. */
  const stopWatching = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (registering === null) return undefined;
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const report = (next: UpdateStatus) => {
      clearTimeout(timer);
      if (next === "waiting") timer = setTimeout(() => setStatus(next), WAITING_SHOWN_AFTER_MS);
      else setStatus(next);
    };
    registering.then(
      (found) => {
        if (!mounted) return;
        registration.current = found;
        setWorker("active");
        stopWatching.current = watchForUpdates(found, report);
      },
      () => {
        if (!mounted) return;
        setStatus("unregistered");
        setWorker("failed");
      },
    );
    return () => {
      mounted = false;
      clearTimeout(timer);
      stopWatching.current?.();
    };
  }, [registering]);

  const install = useCallback(() => {
    if (status === "outdated") return reloadPage();
    // From here the install reports alone: the watcher would report the same worker's take-over as one
    // from another window.
    stopWatching.current?.();
    const found = registration.current;
    if (found === null) return setStatus("failed");
    // The effect's cleanup stops the install too: an unmounted page neither reloads, reports nor watches.
    // A release found after a failed take-over shows at once: the first launch's flash is long past.
    stopWatching.current = installUpdate(found, setStatus, reloadPage, () =>
      watchForUpdates(found, setStatus),
    );
  }, [status]);

  const check = useCallback(() => {
    const found = registration.current;
    if (found === null) return;
    setStatus("checking");
    checkForUpdate(found, serverReachable).then(setStatus, () => setStatus("failed"));
  }, []);

  const dismiss = useCallback(() => {
    keepFocusOnCheck();
    setStatus("idle");
  }, []);
  useExpiringCurrent(status, setStatus);

  const [registered, unregistered] = [worker === "active", worker === "failed"];
  return { status, install, check, dismiss, registered, unregistered };
};
