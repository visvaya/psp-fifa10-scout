import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkerMessage, WorkerRequest } from "../logic/load-scout.ts";
import { EMPTY_LOAD_RESULT } from "../logic/test-support/player-fixtures.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import { createSession } from "./use-scout-files.ts";

/** A session over a stand-in worker that records its requests and replies when told. */
const openSession = async () => {
  const posted: Exclude<WorkerRequest, { type: "signed" }>[] = [];
  /** The requestIds the list after signing was asked for. */
  const signedAsked: number[] = [];
  const worker = Object.assign(new EventTarget(), {
    postMessage: (request: WorkerRequest) => {
      if ("type" in request) signedAsked.push(request.requestId);
      else posted.push(request);
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
  return { session, worker, posted, signedAsked, actions, reply };
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

  it("fails a later load at once when the worker failed to start before it", async () => {
    const { session, worker, posted, actions } = await openSession();
    worker.dispatchEvent(new Event("error"));
    session.pickGame(new File(["g"], "game.iso"));
    expect(posted).toEqual([]);
    expect(actions.at(-1)).toEqual({
      type: "load-failed",
      requestId: 1,
      error: { stage: "game", kind: "unexpected" },
    });
  });

  it("goes back to the earlier good save when a newly picked save fails", async () => {
    const { session, posted, reply } = await openSession();
    session.pickGame(new File(["g"], "game.iso"));
    reply({ type: "done", requestId: 1, result: EMPTY_LOAD_RESULT });
    session.pickSave(saveFiles(1));
    reply({ type: "done", requestId: 2, result: EMPTY_LOAD_RESULT });
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

describe("the list after signing", () => {
  it("asks the worker for the latest load's list, whose reply ends no load", async () => {
    const { session, posted, signedAsked, actions, reply } = await openSession();
    session.pickGame(new File(["g"], "game.iso"));
    reply({ type: "done", requestId: 1, result: EMPTY_LOAD_RESULT });
    session.requestSigned();
    expect(signedAsked).toEqual([1]);
    expect(actions.at(-1)).toEqual({ type: "signed-requested" });
    reply({ type: "signed", requestId: 1, players: [] });
    expect(actions.at(-1)).toEqual({ type: "signed-built", players: [] });
    // The game stays the loaded one: a picked save loads it again.
    session.pickSave(saveFiles(1));
    expect(posted).toHaveLength(2);
  });

  it("builds none when the worker is gone", async () => {
    const { session, worker, actions } = await openSession();
    worker.dispatchEvent(new Event("error"));
    session.requestSigned();
    expect(actions.slice(-2)).toEqual([
      { type: "signed-requested" },
      { type: "signed-built", players: null },
    ]);
  });
});
