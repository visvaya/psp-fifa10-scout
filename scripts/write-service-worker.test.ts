// Runs the generated service worker against stand-ins for the browser's cache storage and network, so every
// branch of its life cycle is checked without a browser: what is stored, what is refused, what is left
// behind. Each case runs with the app at the site root and under a sub-path.
import { compileFunction } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  CACHE_PREFIX,
  cacheIdOf,
  precacheOf,
  readTemplate,
  renderServiceWorker,
  sha256Hex,
} from "./write-service-worker.ts";
import {
  POLICY,
  absolute,
  makeCacheStorage,
  makeNetwork,
} from "./test-support/service-worker-stand-ins.ts";
import type { Misbehaving, Release, Store } from "./test-support/service-worker-stand-ins.ts";

const TEMPLATE = readTemplate();
const TAKE_OVER_MESSAGE = { type: "psp-fifa10-scout:take-over" };
const ORIGIN = "https://app.example";
const SCRIPT_A = "assets/index-AAAAAAAA.js";
const SCRIPT_B = "assets/index-BBBBBBBB.js";

const RELEASE_A: Release = {
  "index.html": "<html>a</html>",
  [SCRIPT_A]: "console.log('a')",
  "icon.svg": "<svg/>",
  "manifest.webmanifest": "{}",
};
const RELEASE_B: Release = {
  "index.html": "<html>b</html>",
  [SCRIPT_B]: "console.log('b')",
  "icon.svg": "<svg/>",
  "manifest.webmanifest": "{}",
};

const precacheFor = (release: Release) =>
  precacheOf(Object.entries(release).map(([path, body]) => ({ path, sha256: sha256Hex(body) })));
const cacheNameOf = (release: Release) => `${CACHE_PREFIX}${cacheIdOf(precacheFor(release))}`;
const sorted = (names: Iterable<string>) => [...names].toSorted();

interface Registration {
  installing: unknown;
  waiting: unknown;
}

const worldAt = (base: string) => ({
  base,
  caches: makeCacheStorage(),
  network: makeNetwork(base, RELEASE_A),
  registration: { installing: null, waiting: null } as Registration,
});
type World = ReturnType<typeof worldAt>;

interface FetchOptions {
  readonly method?: string;
  readonly mode?: string;
  readonly origin?: string;
}

type Handler = (event: Record<string, unknown>) => void;

/** Loads the worker of `release` and returns the means to send it events. */
const startWorker = (release: Release, w: World) => {
  const handlers = new Map<string, Handler>();
  const tookOver: string[] = [];
  const scope = {
    location: new URL(`${ORIGIN}${w.base}sw.js`),
    registration: w.registration,
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    skipWaiting: () => tookOver.push("skipWaiting"),
    clients: { claim: () => tookOver.push("clients.claim") },
  };
  const source = renderServiceWorker(TEMPLATE, precacheFor(release));
  Reflect.apply(compileFunction(source, ["self", "caches", "fetch"]), undefined, [
    scope,
    w.caches,
    w.network.fetch,
  ]);

  const dispatch = async (type: string, event: Record<string, unknown> = {}) => {
    const pending: Promise<unknown>[] = [];
    handlers.get(type)?.({
      ...event,
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    });
    await Promise.all(pending);
  };
  return {
    tookOver,
    install: () => dispatch("install"),
    activate: () => dispatch("activate"),
    message: (data: unknown) => dispatch("message", { data }),
    /** The worker's answer, or null when it leaves the request to the browser. `path` is absolute. */
    fetch: async (
      path: string,
      { method = "GET", mode = "cors", origin = ORIGIN }: FetchOptions = {},
    ) => {
      let answer: Promise<Response> | null = null;
      await dispatch("fetch", {
        request: { method, mode, url: `${origin}${path}` },
        respondWith: (promise: Promise<Response>) => {
          answer = promise;
        },
      });
      return answer as Promise<Response> | null;
    },
  };
};

const installed = async (release: Release, w: World) => {
  const worker = startWorker(release, w);
  await worker.install();
  return worker;
};

const storeOf = (w: World, release: Release): Store => {
  const store = w.caches.stores.get(cacheNameOf(release));
  if (store === undefined) throw new Error("the release is not stored");
  return store;
};

const textOf = async (answer: Promise<Response | null>) => (await answer)?.text();

describe("the release written into the worker", () => {
  it("keeps every served file but host rules, source maps and the worker, relative to the worker", () => {
    const paths = [
      "sw.js",
      "index.html",
      "_headers",
      "_redirects",
      ".assetsignore",
      "assets/b.js",
      "assets/b.js.map",
      "assets/a.css",
    ];
    expect(precacheOf(paths.map((path) => ({ path, sha256: path })))).toEqual([
      { url: "./assets/a.css", sha256: "assets/a.css" },
      { url: "./assets/b.js", sha256: "assets/b.js" },
      { url: "./", sha256: "index.html" },
    ]);
  });

  it("leaves the sample screenshots to the network: they are pictures for the page, not part of the app", () => {
    const paths = [
      "index.html",
      "screenshots/list-wide.webp",
      "screenshots/card-wide.webp",
      "icon.svg",
    ];
    expect(
      precacheOf(paths.map((path) => ({ path, sha256: path }))).map((entry) => entry.url),
    ).toEqual(["./icon.svg", "./"]);
  });

  it("names its cache after its files, so a changed file is another release", () => {
    const changed = { ...RELEASE_A, [SCRIPT_A]: "console.log('a2')" };
    expect(cacheNameOf(RELEASE_A)).not.toBe(cacheNameOf(changed));
    expect(cacheNameOf(RELEASE_A)).toBe(cacheNameOf({ ...RELEASE_A }));
  });

  it("refuses a template without exactly one placeholder", () => {
    expect(() => renderServiceWorker("const RELEASE = {};", [])).toThrow(/exactly once/u);
  });
});

describe.each(["/", "/scout/"])("the worker served from %s", (base) => {
  const world = () => worldAt(base);
  const at = (path: string) => absolute(base, path);
  const START = base;

  describe("install", () => {
    it("stores every file after checking it, from the server, without redirects", async () => {
      const w = world();
      await installed(RELEASE_A, w);
      const store = storeOf(w, RELEASE_A);
      expect(sorted(store.keys())).toEqual(sorted(Object.keys(RELEASE_A).map(at)));
      expect(await store.get(START)?.text()).toBe(RELEASE_A["index.html"]);
      expect(w.network.calls).toHaveLength(Object.keys(RELEASE_A).length);
      for (const call of w.network.calls) {
        expect(call.init).toMatchObject({ cache: "no-cache", redirect: "error" });
      }
    });

    it("a stored copy keeps the policy and the type, not the headers of the transfer", async () => {
      const w = world();
      await installed(RELEASE_A, w);
      const page = storeOf(w, RELEASE_A).get(START);
      expect(page?.headers.get("content-security-policy")).toBe(POLICY);
      expect(page?.headers.get("content-type")).toBe("text/plain");
      const transfer = ["content-encoding", "content-length", "vary"].map((n) =>
        page?.headers.get(n),
      );
      expect(transfer).toEqual([null, null, null]);
    });

    const BROKEN_ANSWERS: readonly {
      name: string;
      answer: string | Misbehaving | undefined;
      message: RegExp;
    }[] = [
      { name: "a missing file", answer: undefined, message: /HTTP 404/u },
      { name: "a server error", answer: { body: "oops", status: 500 }, message: /HTTP 500/u },
      // A deployment in progress: the old worker, the new files.
      { name: "a file of another release", answer: "console.log('b')", message: /not the file/u },
      {
        name: "an answer from another origin",
        answer: { body: "console.log('a')", type: "opaque" },
        message: /same-origin/u,
      },
      {
        name: "a redirect",
        answer: { body: "console.log('a')", redirect: true },
        message: /redirected/u,
      },
    ];

    it.each(BROKEN_ANSWERS)("fails on $name and leaves no part of the release", async (broken) => {
      const w = world();
      if (broken.answer === undefined) delete w.network.served[at(SCRIPT_A)];
      else w.network.served[at(SCRIPT_A)] = broken.answer;
      await expect(installed(RELEASE_A, w)).rejects.toThrow(broken.message);
      expect([...w.caches.stores.keys()]).toEqual([]);
    });

    it("fails without a network, without room, or when its cache is removed meanwhile", async () => {
      const offline = world();
      offline.network.offline = true;
      await expect(installed(RELEASE_A, offline)).rejects.toThrow(/Failed to fetch/u);

      const full = { ...world(), caches: makeCacheStorage({ failPutAt: 3 }) };
      await expect(installed(RELEASE_A, full)).rejects.toThrow(/no room/u);

      const tidied = { ...world(), caches: makeCacheStorage({ dropAtPut: 3 }) };
      await expect(installed(RELEASE_A, tidied)).rejects.toThrow(/removed while it was written/u);

      for (const w of [offline, full, tidied]) expect([...w.caches.stores.keys()]).toEqual([]);
    });

    it("a failed install of the next release leaves the running one whole and offline", async () => {
      const w = world();
      const running = await installed(RELEASE_A, w);
      w.network.serve(RELEASE_B);
      delete w.network.served[at(SCRIPT_B)];
      await expect(installed(RELEASE_B, w)).rejects.toThrow(/HTTP 404/u);

      expect([...w.caches.stores.keys()]).toEqual([cacheNameOf(RELEASE_A)]);
      w.network.offline = true;
      expect(await textOf(running.fetch(START, { mode: "navigate" }))).toBe(
        RELEASE_A["index.html"],
      );
    });

    it("a release stored in full is not fetched again, one with a file gone is", async () => {
      const w = world();
      await installed(RELEASE_A, w);
      w.network.calls.length = 0;
      await installed(RELEASE_A, w);
      expect(w.network.calls).toEqual([]);

      storeOf(w, RELEASE_A).delete(at("manifest.webmanifest"));
      await installed(RELEASE_A, w);
      expect(storeOf(w, RELEASE_A).has(at("manifest.webmanifest"))).toBe(true);
    });

    it("the worker never takes over pages on its own", async () => {
      const worker = await installed(RELEASE_A, world());
      await worker.activate();
      expect(worker.tookOver).toEqual([]);
    });

    it("a waiting worker takes over only on its message, and claims no page", async () => {
      const worker = await installed(RELEASE_A, world());
      await worker.message({ type: "something-else" });
      await worker.message(null);
      expect(worker.tookOver).toEqual([]);
      await worker.message(TAKE_OVER_MESSAGE);
      expect(worker.tookOver).toEqual(["skipWaiting"]);
    });
  });

  describe("answers", () => {
    it("the start page answers the directory, its file name and any query from the store", async () => {
      const w = world();
      const worker = await installed(RELEASE_A, w);
      w.network.offline = true;
      const starts = [START, `${START}index.html`, `${START}?source=pwa`].map((path) =>
        textOf(worker.fetch(path, { mode: "navigate" })),
      );
      expect(await Promise.all(starts)).toEqual(Array(3).fill(RELEASE_A["index.html"]));
      expect(await textOf(worker.fetch(`${at(SCRIPT_A)}?v=2`))).toBe(RELEASE_A[SCRIPT_A]);
      expect(await textOf(worker.fetch(at("manifest.webmanifest")))).toBe("{}");
    });

    it("requests that are not files of the release are left to the browser", async () => {
      const w = world();
      const worker = await installed(RELEASE_A, w);
      // The page of the release has started; nothing but this release is stored.
      await worker.fetch(START, { mode: "navigate" });
      const untouched: readonly [string, FetchOptions][] = [
        [at(SCRIPT_B), {}],
        [at("sw.js"), {}],
        [at("some/route"), { mode: "navigate" }],
        [START, { method: "POST" }],
        [at(SCRIPT_A), { method: "HEAD" }],
        [at(SCRIPT_A), { origin: "https://elsewhere.example" }],
      ];
      const answers = untouched.map(([path, options]) => worker.fetch(path, options));
      expect(await Promise.all(answers)).toEqual(untouched.map(() => null));
    });

    it("when the browser has dropped the store, the network answers and no empty store is made", async () => {
      const w = world();
      const worker = await installed(RELEASE_A, w);
      w.caches.stores.clear();
      expect(await textOf(worker.fetch(START, { mode: "navigate" }))).toBe(RELEASE_A["index.html"]);
      expect([...w.caches.stores.keys()]).toEqual([]);
    });

    it("a request the network fails is answered with a network error, never a broken promise", async () => {
      const w = world();
      const worker = await installed(RELEASE_A, w);
      w.caches.stores.clear();
      w.network.offline = true;
      expect((await worker.fetch(START, { mode: "navigate" }))?.type).toBe("error");
      expect((await worker.fetch(at(SCRIPT_A)))?.type).toBe("error");
    });
  });

  describe("one release after another", () => {
    /** Release A runs, release B is on the server and stored; the worker of B has taken over. */
    const afterTakeover = async () => {
      const w = world();
      await installed(RELEASE_A, w);
      w.caches.stores.set("someone-elses-cache", new Map());
      w.network.serve(RELEASE_B);
      const workerB = await installed(RELEASE_B, w);
      await workerB.activate();
      w.network.calls.length = 0;
      return { w, workerB };
    };
    const BOTH = sorted([cacheNameOf(RELEASE_A), cacheNameOf(RELEASE_B), "someone-elses-cache"]);

    it("taking over removes nothing: the release before stays stored", async () => {
      const { w } = await afterTakeover();
      expect(sorted(w.caches.stores.keys())).toEqual(BOTH);
    });

    // Right after an update the browser can answer one more launch with the page of the outgoing release
    // and switch workers under it; that page then asks for a script the server no longer has.
    it("a page of the release before gets its files from that release, not from the network", async () => {
      const { w, workerB } = await afterTakeover();
      expect(await textOf(workerB.fetch(at(SCRIPT_A)))).toBe(RELEASE_A[SCRIPT_A]);
      expect(w.network.calls).toEqual([]);
      expect(await workerB.fetch(at(SCRIPT_A), { mode: "navigate" })).toBeNull();
    });

    it("the start page of this release removes the other releases and nothing else", async () => {
      const { w, workerB } = await afterTakeover();
      expect(await textOf(workerB.fetch(START, { mode: "navigate" }))).toBe(
        RELEASE_B["index.html"],
      );
      expect(sorted(w.caches.stores.keys())).toEqual(
        sorted([cacheNameOf(RELEASE_B), "someone-elses-cache"]),
      );
      // Left to the browser from now on.
      expect(await workerB.fetch(at(SCRIPT_A))).toBeNull();
    });

    it("a start page that had to come from the network removes nothing", async () => {
      const { w, workerB } = await afterTakeover();
      w.caches.stores.delete(cacheNameOf(RELEASE_B));
      await workerB.fetch(START, { mode: "navigate" });
      expect(sorted(w.caches.stores.keys())).toEqual(
        sorted([cacheNameOf(RELEASE_A), "someone-elses-cache"]),
      );
    });

    it.each(["installing", "waiting"] as const)(
      "a release that is %s keeps its cache when the running one starts a page",
      async (pending) => {
        const w = world();
        const workerA = await installed(RELEASE_A, w);
        w.network.serve(RELEASE_B);
        await installed(RELEASE_B, w);
        w.registration[pending] = {};

        await workerA.fetch(START, { mode: "navigate" });
        expect(sorted(w.caches.stores.keys())).toEqual(
          sorted([cacheNameOf(RELEASE_A), cacheNameOf(RELEASE_B)]),
        );
      },
    );
  });
});
