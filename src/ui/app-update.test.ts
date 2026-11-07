import { describe, expect, it } from "vitest";
import {
  activeRegistration,
  canCheck,
  checkForUpdate,
  installUpdate,
  isDismissible,
  watchForUpdates,
} from "./app-update.ts";
import type { RegistrationLike, UpdateStatus } from "./app-update.ts";

/** A service worker whose state the test moves on; it records what the page sent it. */
const makeWorker = (initial: string) => {
  const listeners = new Set<() => void>();
  const worker = {
    state: initial,
    sent: [] as unknown[],
    postMessage: (message: unknown) => worker.sent.push(message),
    addEventListener: (_type: "statechange", listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: "statechange", listener: () => void) => listeners.delete(listener),
    listenerCount: () => listeners.size,
    moveTo: (state: string) => {
      worker.state = state;
      for (const listener of listeners) listener();
    },
  };
  return worker;
};
type FakeWorker = ReturnType<typeof makeWorker>;

const makeRegistration = (active: FakeWorker | null) => {
  const found = new Set<() => void>();
  const registration = {
    active,
    installing: null as FakeWorker | null,
    waiting: null as FakeWorker | null,
    addEventListener: (_type: "updatefound", listener: () => void) => found.add(listener),
    removeEventListener: (_type: "updatefound", listener: () => void) => found.delete(listener),
    /** The browser found a new worker. */
    find: (worker: FakeWorker) => {
      registration.installing = worker;
      for (const listener of found) listener();
    },
  } satisfies RegistrationLike & Record<string, unknown>;
  return registration;
};

const watched = (registration: RegistrationLike) => {
  const reports: UpdateStatus[] = [];
  const stop = watchForUpdates(registration, (status) => reports.push(status));
  return { reports, stop };
};

/** A page on an installed release whose browser has just found the next one. */
const findingNext = () => {
  const registration = makeRegistration(makeWorker("activated"));
  const watch = watched(registration);
  const next = makeWorker("installing");
  registration.find(next);
  return { ...watch, registration, next };
};

describe("watchForUpdates", () => {
  it("reports a new release once it is stored and waits", () => {
    const { reports, next } = findingNext();
    expect(reports).toEqual([]);
    next.moveTo("installed");
    expect(reports).toEqual(["waiting"]);
  });

  it("reports a release that already waits when the page opens", () => {
    const registration = makeRegistration(makeWorker("activated"));
    registration.waiting = makeWorker("installed");
    expect(watched(registration).reports).toEqual(["waiting"]);
  });

  it("does not take the first visit's storing for an update", () => {
    const registration = makeRegistration(null);
    const { reports } = watched(registration);
    const first = makeWorker("installing");
    registration.find(first);
    first.moveTo("installed");
    first.moveTo("activated");
    expect(reports).toEqual([]);
    expect(first.listenerCount()).toBe(0);
  });

  it("reports a release that could not be stored, not one replaced after it was", () => {
    const { reports, registration, next: broken } = findingNext();
    broken.moveTo("redundant");
    expect(reports).toEqual(["failed"]);

    const replaced = makeWorker("installing");
    registration.find(replaced);
    replaced.moveTo("installed");
    replaced.moveTo("redundant");
    expect(reports).toEqual(["failed", "waiting"]);
  });

  it("reports a release that another window installed", () => {
    const { reports, next } = findingNext();
    next.moveTo("installed");
    next.moveTo("activated");
    expect(reports).toEqual(["waiting", "outdated"]);
  });

  it("stops listening when asked", () => {
    const { reports, stop, registration, next } = findingNext();
    stop();
    next.moveTo("installed");
    registration.find(makeWorker("installing"));
    expect(reports).toEqual([]);
    expect(next.listenerCount()).toBe(0);
  });
});

describe("installUpdate", () => {
  it("asks the waiting release to take over and reloads once it has", () => {
    const registration = makeRegistration(makeWorker("activated"));
    const waiting = makeWorker("installed");
    registration.waiting = waiting;
    const reports: UpdateStatus[] = [];
    let reloads = 0;
    expect(
      installUpdate(
        registration,
        (s) => reports.push(s),
        () => (reloads += 1),
        () => () => undefined,
      ),
    ).toBeTypeOf("function");
    expect(waiting.sent).toEqual([{ type: "psp-fifa10-scout:take-over" }]);
    expect(reports).toEqual(["installing"]);
    waiting.moveTo("activating");
    expect(reloads).toBe(0);
    waiting.moveTo("activated");
    expect(reloads).toBe(1);
    expect(waiting.listenerCount()).toBe(0);
  });

  it("reports a release that did not take over, or none waiting, and watches again either way", () => {
    const registration = makeRegistration(makeWorker("activated"));
    const reports: UpdateStatus[] = [];
    const report = (status: UpdateStatus) => reports.push(status);
    let watches = 0;
    const watchAgain = () => {
      watches += 1;
      return () => undefined;
    };
    installUpdate(registration, report, () => undefined, watchAgain);
    expect([reports, watches]).toEqual([["failed"], 1]);
    const waiting = makeWorker("installed");
    registration.waiting = waiting;
    installUpdate(registration, report, () => undefined, watchAgain);
    waiting.moveTo("redundant");
    expect([reports, watches]).toEqual([["failed", "installing", "failed"], 2]);
  });

  it("watches again after a release did not take over, so a later check can still report one", () => {
    const registration = makeRegistration(makeWorker("activated"));
    const waiting = makeWorker("installed");
    registration.waiting = waiting;
    const reports: UpdateStatus[] = [];
    const report = (status: UpdateStatus) => reports.push(status);
    const watchAgain = () => watchForUpdates(registration, report);
    installUpdate(registration, report, () => undefined, watchAgain);
    // A release that failed is no longer the registration's waiting worker.
    registration.waiting = null;
    waiting.moveTo("redundant");
    const next = makeWorker("installing");
    registration.find(next);
    next.moveTo("installed");
    expect(reports).toEqual(["installing", "failed", "waiting"]);
  });

  it("does nothing more once stopped: no reload, report or new watcher", () => {
    const registration = makeRegistration(makeWorker("activated"));
    const reports: UpdateStatus[] = [];
    let [reloads, watches] = [0, 0];
    const install = (waiting: FakeWorker) => {
      registration.waiting = waiting;
      const stop = installUpdate(
        registration,
        (status) => reports.push(status),
        () => (reloads += 1),
        () => {
          watches += 1;
          return () => undefined;
        },
      );
      stop();
      expect(waiting.listenerCount()).toBe(0);
      return waiting;
    };
    install(makeWorker("installed")).moveTo("redundant");
    install(makeWorker("installed")).moveTo("activated");
    expect(reports).toEqual(["installing", "installing"]);
    expect([reloads, watches]).toEqual([0, 0]);
  });

  it("stops the watcher it started again after a release did not take over", () => {
    const registration = makeRegistration(makeWorker("activated"));
    const waiting = makeWorker("installed");
    registration.waiting = waiting;
    let watching = false;
    const stop = installUpdate(
      registration,
      () => undefined,
      () => undefined,
      () => {
        watching = true;
        return () => {
          watching = false;
        };
      },
    );
    waiting.moveTo("redundant");
    expect(watching).toBe(true);
    stop();
    expect(watching).toBe(false);
  });
});

/** A first visit: no active worker yet, the first one installing; ready settles when the test says. */
const firstVisit = () => {
  const registration = makeRegistration(null);
  const first = makeWorker("installing");
  registration.installing = first;
  let resolveReady: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  return { registration, first, ready, markReady: () => resolveReady?.() };
};

describe("activeRegistration", () => {
  it("gives the registration once the first worker is active", async () => {
    const { registration, first, ready, markReady } = firstVisit();
    const active = activeRegistration(registration, ready);
    first.moveTo("installed");
    markReady();
    await expect(active).resolves.toBe(registration);
    expect(first.listenerCount()).toBe(0);
  });

  it("fails when the first worker cannot be stored, which ready would never say", async () => {
    const { registration, first, ready } = firstVisit();
    const active = activeRegistration(registration, ready);
    // The browser reports the worker redundant before it clears the registration's installing worker.
    first.moveTo("redundant");
    await expect(active).rejects.toThrow(/first service worker/u);
    expect(first.listenerCount()).toBe(0);
  });

  it("fails at once when the first worker failed before it could be followed", async () => {
    const { registration, first, ready } = firstVisit();
    first.state = "redundant";
    await expect(activeRegistration(registration, ready)).rejects.toThrow(/first service worker/u);
  });

  it("follows a newer worker that replaced the first one before it was active", async () => {
    const { registration, first, ready, markReady } = firstVisit();
    const active = activeRegistration(registration, ready);
    const newer = makeWorker("installing");
    registration.installing = newer;
    first.moveTo("redundant");
    expect(newer.listenerCount()).toBe(1);
    markReady();
    await expect(active).resolves.toBe(registration);
  });
});

const reachable = () => Promise.resolve(true);
// The same object, so the check sees what update() changed on it, as on a real registration.
const withUpdate = (registration: ReturnType<typeof makeRegistration>, update: () => void) =>
  Object.assign(registration, {
    update: () => {
      update();
      return Promise.resolve();
    },
  });

describe("isDismissible", () => {
  it("lets the user close a result with no action of its own", () => {
    const results = ["current", "unreachable", "failed", "unregistered"] as const;
    expect(results.map(isDismissible)).toEqual([true, true, true, true]);
    const kept = ["idle", "checking", "downloading", "waiting", "installing", "outdated"] as const;
    expect(kept.map(isDismissible)).toEqual([false, false, false, false, false, false]);
  });
});

describe("canCheck", () => {
  it("lets a check start only when none runs and no release waits to be installed", () => {
    expect((["idle", "current", "unreachable", "failed"] as const).map(canCheck)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    const busy = ["checking", "downloading", "installing", "waiting", "outdated"] as const;
    expect(busy.map(canCheck)).toEqual([false, false, false, false, false]);
  });
});

describe("checkForUpdate", () => {
  it("asks the server first: without a network it says so instead of up to date", async () => {
    const registration = withUpdate(makeRegistration(makeWorker("activated")), () => undefined);
    expect(await checkForUpdate(registration, () => Promise.resolve(false))).toBe("unreachable");
  });

  it("reports a release being downloaded, one that waits, or none", async () => {
    const base = makeRegistration(makeWorker("activated"));
    const found = withUpdate(base, () => {
      base.installing = makeWorker("installing");
    });
    expect(await checkForUpdate(found, reachable)).toBe("downloading");
    base.installing = null;
    base.waiting = makeWorker("installed");
    expect(
      await checkForUpdate(
        withUpdate(base, () => undefined),
        reachable,
      ),
    ).toBe("waiting");
    base.waiting = null;
    expect(
      await checkForUpdate(
        withUpdate(base, () => undefined),
        reachable,
      ),
    ).toBe("current");
  });

  it("reports a failed check when the browser cannot fetch or run the new worker", async () => {
    const registration = Object.assign(makeRegistration(makeWorker("activated")), {
      update: () => Promise.reject(new TypeError("Failed to update")),
    });
    expect(await checkForUpdate(registration, reachable)).toBe("failed");
  });
});
