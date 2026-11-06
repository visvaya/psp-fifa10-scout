import { afterEach, describe, expect, it, vi } from "vitest";
import type { LoadResult, WorkerMessage, WorkerRequest } from "../logic/load-scout.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import { createSession } from "./use-scout-files.ts";

const RESULT: LoadResult = {
  players: [],
  myTeamId: null,
  career: null,
  gameDb: Uint8Array.of(9),
  languages: {},
  attachedLanguage: null,
};

/** A session over a stand-in worker that records its requests and replies when told. */
const openSession = async () => {
  const posted: WorkerRequest[] = [];
  const worker = Object.assign(new EventTarget(), {
    postMessage: (request: WorkerRequest) => {
      posted.push(request);
    },
    terminate: () => undefined,
  });
  // A constructor function: the session calls `new Worker(...)`, which returns this stand-in.
  vi.stubGlobal(
    "Worker",
    vi.fn(function fakeWorker() {
      return worker;
    }),
  );
  const actions: ScoutAction[] = [];
  const session = createSession(
    (action) => {
      actions.push(action);
    },
    () => undefined,
  );
  await session.open(() => false);
  const reply = (message: WorkerMessage) => {
    worker.dispatchEvent(new MessageEvent("message", { data: message }));
  };
  return { session, worker, posted, actions, reply };
};

const saveFiles = (byte: number) => [
  new File([Uint8Array.of(byte)], "DATA.BIN"),
  new File([], "PARAM.SFO"),
];
const localeFiles = () => [new File([], "de.loc"), new File([], "string.idx")];
const saveFailed = (requestId: number): WorkerMessage => ({
  type: "failed",
  requestId,
  error: { stage: "save", kind: "damaged" },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createSession", () => {
  // error: the worker fails to start or to run; messageerror: its reply cannot be read.
  it.each(["error", "messageerror"])("reports a worker's %s as a failed load", async (type) => {
    const { session, worker, actions } = await openSession();
    session.pickGame(new File(["g"], "game.iso"));
    worker.dispatchEvent(new Event(type));
    expect(actions.at(-1)).toEqual({
      type: "load-failed",
      requestId: 1,
      error: { stage: "game", kind: "unexpected" },
    });
  });

  it("goes back to the earlier good save when a newly picked save fails", async () => {
    const { session, posted, reply } = await openSession();
    session.pickGame(new File(["g"], "game.iso"));
    reply({ type: "done", requestId: 1, result: RESULT });
    session.pickSave(saveFiles(1));
    reply({ type: "done", requestId: 2, result: RESULT });
    const good = posted.at(-1)?.save;
    session.pickSave(saveFiles(2));
    reply(saveFailed(3));
    session.pickLocale(localeFiles());
    expect(good).toBeDefined();
    expect(posted.at(-1)?.save).toBe(good);
  });

  it("loads the game again with a corrected save after the save failed on the first load", async () => {
    const { session, posted, reply } = await openSession();
    const game = new File(["g"], "game.iso");
    session.pickSave(saveFiles(1));
    session.pickGame(game);
    reply(saveFailed(1));
    session.pickSave(saveFiles(2));
    expect(posted).toHaveLength(2);
    expect(posted[1]?.game).toBe(game);
  });
});
