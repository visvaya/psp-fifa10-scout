// Stand-ins for the browser's cache storage and network, as the generated service worker uses them.

export const POLICY = "default-src 'self'";

/** A release: file paths relative to the build directory, with their bodies. */
export type Release = Readonly<Record<string, string>>;

export type Store = Map<string, Response>;

/**
 * Cache storage as the worker uses it. `failPutAt` makes the n-th write fail, as a full disk would;
 * `dropAtPut` removes every cache at the n-th write, as another worker of the app does when it tidies up.
 */
export const makeCacheStorage = ({ failPutAt = Infinity, dropAtPut = Infinity } = {}) => {
  const stores = new Map<string, Store>();
  let puts = 0;
  return {
    stores,
    has: (name: string) => Promise.resolve(stores.has(name)),
    open: (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      return Promise.resolve({
        match: (url: string) => Promise.resolve(stores.get(name)?.get(url)?.clone()),
        put: (url: string, response: Response) => {
          puts += 1;
          if (puts >= failPutAt) {
            return Promise.reject(new DOMException("no room", "QuotaExceededError"));
          }
          if (puts === dropAtPut) stores.clear();
          stores.get(name)?.set(url, response);
          return Promise.resolve();
        },
      });
    },
    delete: (name: string) => Promise.resolve(stores.delete(name)),
    keys: () => Promise.resolve([...stores.keys()]),
    match: (url: string, options: { cacheName: string }) =>
      Promise.resolve(stores.get(options.cacheName)?.get(url)?.clone()),
  };
};

const responseOf = (body: string, status: number, type: string) => {
  const response = new Response(status === 404 ? null : body, {
    status,
    headers: {
      "Content-Type": "text/plain",
      "Content-Security-Policy": POLICY,
      "Content-Encoding": "gzip",
      "Content-Length": "123",
      Vary: "Accept-Encoding",
    },
  });
  Object.defineProperty(response, "type", { value: type });
  return response;
};

export interface Misbehaving {
  readonly body: string;
  readonly status?: number;
  readonly type?: string;
  readonly redirect?: boolean;
}

/** The network: `served` maps an absolute path to its body, or to how it misbehaves. */
export const makeNetwork = (base: string, release: Release) => {
  const network = {
    calls: [] as { path: string; init: RequestInit }[],
    served: {} as Record<string, string | Misbehaving>,
    offline: false,
    serve: (next: Release) => {
      network.served = Object.fromEntries(
        Object.entries(next).map(([path, body]) => [absolute(base, path), body]),
      );
    },
    fetch: (input: string | URL | { url: string }, init: RequestInit = {}) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      network.calls.push({ path: url.pathname, init });
      if (network.offline) return Promise.reject(new TypeError("Failed to fetch"));
      const entry = network.served[url.pathname];
      if (entry === undefined) return Promise.resolve(responseOf("", 404, "basic"));
      const served = typeof entry === "string" ? { body: entry } : entry;
      if (served.redirect === true && init.redirect === "error") {
        return Promise.reject(new TypeError("redirected"));
      }
      return Promise.resolve(responseOf(served.body, served.status ?? 200, served.type ?? "basic"));
    },
  };
  network.serve(release);
  return network;
};

/** The absolute path the worker stores a file under: the start page as the directory itself. */
export const absolute = (base: string, path: string) =>
  path === "index.html" ? base : `${base}${path}`;
