import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DecodedImage } from "../data/game-graphics.ts";
import { buildShpm, refpackLiterals } from "../data/test-support/synthetic-graphics.ts";
import {
  columnImage,
  columnImageWidth,
  crestOf,
  firstUrl,
  flagOf,
  GameImage,
  GameImages,
  imageUrls,
} from "./game-image.tsx";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";

const crest = refpackLiterals(
  buildShpm(
    1,
    1,
    [1],
    [
      [0, 0, 0, 0],
      [9, 8, 7, 255],
    ],
  ),
);
const pack = {
  bytes: Uint8Array.from([...crest, 0x10, 0xfa]),
  entries: [
    ["tl1873", 0, crest.length],
    ["ls37", crest.length, 2],
  ],
} as const;

/** A URL maker that names each image by its first pixel, counting the images it made. */
const namer = () => {
  const made: DecodedImage[] = [];
  const toUrl = async (image: DecodedImage) => {
    made.push(image);
    return Promise.resolve(`blob:${[...image.rgba.subarray(0, 4)].join(",")}`);
  };
  return { made, toUrl };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("imageUrls", () => {
  it("makes an entry's image once, and none for a missing or damaged entry", async () => {
    const { made, toUrl } = namer();
    const urls = imageUrls(pack, toUrl);
    expect(await urls.url("tl1873")).toBe("blob:9,8,7,255");
    expect(await urls.url("tl1873")).toBe("blob:9,8,7,255");
    expect(made).toHaveLength(1);
    expect(await urls.url("tl1")).toBeNull();
    expect(await urls.url("ls37")).toBeNull();
  });

  it("frees the URLs it made, and one made after that at once", async () => {
    const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const urls = imageUrls(pack, namer().toUrl);
    await urls.url("tl1873");
    const late = imageUrls(pack, namer().toUrl);
    const pending = late.url("tl1873");
    late.revoke();
    urls.revoke();
    expect(await pending).toBeNull();
    expect(revoked.mock.calls).toEqual([["blob:9,8,7,255"], ["blob:9,8,7,255"]]);
  });
});

const alwaysLive = () => true;

describe("firstUrl", () => {
  it("falls back to the next entry when one cannot be made", async () => {
    const urls = imageUrls(pack, namer().toUrl);
    expect(await firstUrl(urls, ["ls37", "tl1873"], alwaysLive)).toBe("blob:9,8,7,255");
    expect(await firstUrl(urls, ["ls37"], alwaysLive)).toBeNull();
  });

  it("asks for no further entry once the request is dropped", async () => {
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const made: DecodedImage[] = [];
    let finish: ((url: string) => void) | undefined;
    const madeUrl = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const urls = imageUrls(pack, async (image) => {
      made.push(image);
      return madeUrl;
    });
    const request = { live: true };
    const pending = firstUrl(urls, ["tl1873", "tl1873"], () => request.live);
    await vi.waitFor(() => {
      expect(made).toHaveLength(1);
    });
    // The pack changes while the first image is made: its URL is dropped, and no second is asked for.
    request.live = false;
    urls.revoke();
    finish?.("blob:first");
    expect(await pending).toBeNull();
    expect(made).toHaveLength(1);
  });
});

describe("after a revoke", () => {
  it("makes the images again, as a remount of the provider needs", async () => {
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const { made, toUrl } = namer();
    const urls = imageUrls(pack, toUrl);
    expect(await urls.url("tl1873")).toBe("blob:9,8,7,255");
    urls.revoke();
    expect(await urls.url("tl1873")).toBe("blob:9,8,7,255");
    expect(made).toHaveLength(2);
    expect([urls.has("tl1873"), urls.has("tl1")]).toEqual([true, false]);
  });
});

describe("GameImage", () => {
  it("holds an entry's place while its image is made, and none for a missing entry", () => {
    const html = [crestOf(1873), crestOf(1), flagOf(37)].map((image) =>
      renderToStaticMarkup(
        <GameImages pack={pack}>
          <GameImage image={image} />
        </GameImages>,
      ),
    );
    expect(html).toEqual([
      '<span class="game-image" aria-hidden="true"></span>',
      "",
      '<span class="game-image flag" aria-hidden="true"></span>',
    ]);
  });

  it("shows nothing without a pack", () => {
    expect(renderToStaticMarkup(<GameImage image={crestOf(1873)} />)).toBe("");
  });
});

describe("columnImage", () => {
  it("puts the crest before the club, the logo before the league and the flag before the country", () => {
    const player = testPlayer({ clubId: 1873, leagueId: 31, nationalityId: 37 });
    expect(columnImage("clubName", player)).toEqual({ names: ["tl1873"], shape: "square" });
    expect(columnImage("leagueName", player)).toEqual({ names: ["ll31"], shape: "square" });
    expect(columnImage("nationalityName", player)).toEqual({ names: ["ls37"], shape: "flag" });
    expect(columnImage("age", player)).toBeNull();
    const freeAgent = testPlayer({ clubId: null, leagueId: null });
    expect(columnImage("clubName", freeAgent)).toBeNull();
    expect(columnImage("leagueName", freeAgent)).toBeNull();
  });

  it("makes room for a flag at 3:2 two thirds as high as a crest, so as wide as one", () => {
    expect(columnImageWidth("nationalityName")).toBe(1);
    expect(columnImageWidth("clubName")).toBe(1);
    expect(columnImageWidth("age")).toBe(0);
  });
});
