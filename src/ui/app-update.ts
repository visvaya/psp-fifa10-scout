import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A new release of the app, as the update prompt shows it. The service worker
 * (scripts/service-worker-template.js) stores a new release in the background and lets it wait until every
 * window of the app is closed; the prompt lets the user install a waiting one at once.
 * - waiting: a new release is stored and waits;
 * - installing: the user asked for it, the page reloads once it has taken over;
 * - outdated: another window installed it, this page still runs the old code;
 * - failed: a new release could not be stored or did not take over.
 */
export type UpdateStatus = "idle" | "waiting" | "installing" | "outdated" | "failed";

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
 * Asks the waiting release to take over and reloads the page once it has; false when no release waits.
 * Followed by the worker's own state rather than the page's controller: a page loaded past the worker (a
 * forced reload) has no controller to change, and is reloaded all the same.
 */
export const installUpdate = (
  registration: RegistrationLike,
  report: (status: UpdateStatus) => void,
  reload: () => void,
): boolean => {
  const waiting = registration.waiting;
  if (waiting === null) return false;
  const onState = () => {
    if (waiting.state !== "activated" && waiting.state !== "redundant") return;
    waiting.removeEventListener("statechange", onState);
    if (waiting.state === "activated") reload();
    else report("failed");
  };
  waiting.addEventListener("statechange", onState);
  report("installing");
  // A service worker's postMessage takes no target origin; the rule knows only window.postMessage.
  // oxlint-disable-next-line unicorn/require-post-message-target-origin
  waiting.postMessage(TAKE_OVER_MESSAGE);
  return true;
};

const reloadPage = () => {
  window.location.reload();
};

/** The update prompt's state and actions (React); `install` also serves "outdated" as a plain reload. */
export const useAppUpdate = () => {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const registration = useRef<RegistrationLike | null>(null);
  const stopWatching = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const report = (next: UpdateStatus) => {
      clearTimeout(timer);
      if (next === "waiting") timer = setTimeout(() => setStatus(next), WAITING_SHOWN_AFTER_MS);
      else setStatus(next);
    };
    navigator.serviceWorker.getRegistration().then(
      (found) => {
        if (!mounted || found === undefined) return;
        registration.current = found;
        stopWatching.current = watchForUpdates(found, report);
      },
      () => undefined,
    );
    return () => {
      mounted = false;
      clearTimeout(timer);
      stopWatching.current?.();
    };
  }, []);

  const install = useCallback(() => {
    if (status === "outdated") {
      reloadPage();
      return;
    }
    // From here the install reports alone: the watcher would report the same worker's take-over as one
    // from another window.
    stopWatching.current?.();
    const started =
      registration.current !== null && installUpdate(registration.current, setStatus, reloadPage);
    if (!started) setStatus("failed");
  }, [status]);

  return { status, install };
};
