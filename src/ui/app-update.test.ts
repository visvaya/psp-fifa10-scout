import { describe, expect, it } from "vitest";
import { canCheck, checkForUpdate, installUpdate, watchForUpdates } from "./app-update.ts";
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

describe("watchForUpdates", () => {
  it("reports a new release once it is stored and waits", () => {
    const registration = makeRegistration(makeWorker("activated"));
    const { reports } = watched(registration);
    const next = makeWorker("installing");
    registration.find(next);
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
    const registration = makeRegistration(makeWorker("activated"));
    const { reports } = watched(registration);
    const broken = makeWorker("installing");
    registration.find(broken);
    broken.moveTo("redundant");
    expect(reports).toEqual(["failed"]);

    const replaced = makeWorker("installing");
    registration.find(replaced);
    replaced.moveTo("installed");
    replaced.moveTo("redundant");
    expect(reports).toEqual(["failed", "waiting"]);
  });

  it("reports a release that another window installed", () => {
    const registration = makeRegistration(makeWorker("activated"));
    const { reports } = watched(registration);
    const next = makeWorker("installing");
    registration.find(next);
    next.moveTo("installed");
    next.moveTo("activated");
    expect(reports).toEqual(["waiting", "outdated"]);
  });

  it("stops listening when asked", () => {
    const registration = makeRegistration(makeWorker("activated"));
    const { reports, stop } = watched(registration);
    const next = makeWorker("installing");
    registration.find(next);
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
      ),
    ).toBe(true);
    expect(waiting.sent).toEqual([{ type: "psp-fifa10-scout:take-over" }]);
    expect(reports).toEqual(["installing"]);
    waiting.moveTo("activating");
    expect(reloads).toBe(0);
    waiting.moveTo("activated");
    expect(reloads).toBe(1);
    expect(waiting.listenerCount()).toBe(0);
  });

  it("reports a release that did not take over, and does nothing when none waits", () => {
    const registration = makeRegistration(makeWorker("activated"));
    const reports: UpdateStatus[] = [];
    const report = (status: UpdateStatus) => reports.push(status);
    expect(installUpdate(registration, report, () => undefined)).toBe(false);
    const waiting = makeWorker("installed");
    registration.waiting = waiting;
    installUpdate(registration, report, () => undefined);
    waiting.moveTo("redundant");
    expect(reports).toEqual(["installing", "failed"]);
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
