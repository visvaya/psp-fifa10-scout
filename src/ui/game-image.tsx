// The game's own images (club crests, league logos, flags, portraits, kits) beside the names they belong
// to, decorative: each decoded once a session, on first show, into a PNG blob URL that is freed when
// the pack changes.
import { createContext, use, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { decodeShpm, MAX_IMAGE_BYTES, unrefpack } from "../data/game-graphics.ts";
import type { DecodedImage, GraphicsPack } from "../data/game-graphics.ts";
import type { Player } from "../logic/players.ts";
import { lookDifferences, nearestComposedPortrait, realPortraitOf } from "../logic/portraits.ts";
import type { LookPart } from "../logic/portraits.ts";
import type { SortKey } from "../logic/sort-players.ts";

const pngUrl = async ({ width, height, rgba }: DecodedImage): Promise<string> => {
  const canvas = document.createElement("canvas");
  [canvas.width, canvas.height] = [width, height];
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("No 2D canvas");
  context.putImageData(new ImageData(rgba, width, height), 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (blob === null) throw new Error("The image could not be exported");
  return URL.createObjectURL(blob);
};

/**
 * The URL of each entry's image, made on its first ask and kept; null for a missing entry or one that
 * cannot be decoded. nearest names the composed portrait nearest to one the pack lacks, from the pack's
 * composed portraits listed once, each answer kept. revoke frees the URLs made, drops those still being made, and starts afresh, so
 * a provider mounted again (StrictMode, a remount) makes them again on the next ask.
 */
export const imageUrls = (
  pack: GraphicsPack,
  toUrl: (image: DecodedImage) => Promise<string> = pngUrl,
) => {
  const index = new Map(
    pack.entries.map(([name, offset, length]) => [
      name,
      pack.bytes.subarray(offset, offset + length),
    ]),
  );
  const composed = pack.entries.map(([name]) => name).filter((name) => name.startsWith("g_"));
  const nearest = new Map<string, string | null>();
  const urls = new Map<string, Promise<string | null>>();
  let made: string[] = [];
  let generation = 0;
  const make = async (packed: Uint8Array): Promise<string | null> => {
    const madeIn = generation;
    try {
      const url = await toUrl(decodeShpm(unrefpack(packed, MAX_IMAGE_BYTES)));
      if (madeIn === generation) {
        made.push(url);
        return url;
      }
      URL.revokeObjectURL(url);
    } catch {
      // A damaged image shows none; the name beside it says it all.
    }
    return null;
  };
  return {
    has: (name: string): boolean => index.has(name),
    nearest: (name: string): string | null => {
      const known = nearest.get(name);
      if (known !== undefined) return known;
      const found = nearestComposedPortrait(name, composed);
      nearest.set(name, found);
      return found;
    },
    url: (name: string): Promise<string | null> => {
      const known = urls.get(name);
      if (known !== undefined) return known;
      const packed = index.get(name);
      const url = packed === undefined ? Promise.resolve(null) : make(packed);
      urls.set(name, url);
      return url;
    },
    revoke: () => {
      generation += 1;
      for (const url of made) URL.revokeObjectURL(url);
      made = [];
      urls.clear();
    },
  };
};

type ImageSource = ReturnType<typeof imageUrls>;

const ImageContext = createContext<ImageSource | null>(null);
const ApproximateContext = createContext(false);

/**
 * Gives the images of the pack to the GameImage elements under it; without a pack they show none.
 * approximate: a player the game has no portrait of gets a lookalike's (roadmap 110).
 */
export const GameImages = ({
  pack,
  approximate = false,
  children,
}: {
  pack: GraphicsPack | null;
  approximate?: boolean;
  children: ReactNode;
}) => {
  const urls = useMemo(() => (pack === null ? null : imageUrls(pack)), [pack]);
  useEffect(
    () => () => {
      urls?.revoke();
    },
    [urls],
  );
  return (
    <ImageContext value={urls}>
      <ApproximateContext value={approximate}>{children}</ApproximateContext>
    </ImageContext>
  );
};

/** There are images to show: the list makes room for them. */
export const useHasGameImages = (): boolean => use(ImageContext) !== null;

/**
 * The player's portrait and, when it is a lookalike's, what differs from his own; null when it is his
 * own or the game's silhouette.
 */
export const usePortrait = (
  player: Player,
): { image: ImageName; differences: readonly LookPart[] | null } => {
  const source = use(ImageContext);
  const approximate = use(ApproximateContext);
  const own = [realPortraitOf(player.id), player.composedPortrait].some(
    (name) => source?.has(name) === true,
  );
  const nearest =
    approximate && source !== null && !own ? source.nearest(player.composedPortrait) : null;
  return {
    image: portraitOf(player, nearest),
    differences: nearest === null ? null : lookDifferences(player.composedPortrait, nearest),
  };
};

/**
 * The slot before a name in the list: its portrait, or nothing in a slot of the same size, so every
 * row looks alike; no slot without images.
 */
export const PortraitSlot = ({ player }: { player: Player }) => {
  const { image } = usePortrait(player);
  return useHasGameImages() ? (
    <span className="portrait-slot">
      <GameImage image={image} />
    </span>
  ) : null;
};

/**
 * The pack entries an image may come from, the first one the pack has, and how it is drawn: a flag
 * at 3:2 as the game shows it, a portrait or a kit in its own size (styles.css), the rest square.
 */
export interface ImageName {
  readonly names: readonly string[];
  readonly shape: "square" | "flag" | "portrait" | "kit";
}

export const crestOf = (clubId: number | null): ImageName | null =>
  clubId === null ? null : { names: [`tl${String(clubId)}`], shape: "square" };
export const leagueLogoOf = (leagueId: number | null): ImageName | null =>
  leagueId === null ? null : { names: [`ll${String(leagueId)}`], shape: "square" };
export const flagOf = (countryId: number): ImageName => ({
  names: [`ls${String(countryId)}`],
  shape: "flag",
});
/**
 * The player's real portrait where the game has one, else the composed one, else the nearest composed
 * one when given, else the game's own silhouette (owner, 2026-11-13).
 */
export const portraitOf = (player: Player, nearest: string | null): ImageName => ({
  names: [
    realPortraitOf(player.id),
    player.composedPortrait,
    ...(nearest === null ? [] : [nearest]),
    "place_head",
  ],
  shape: "portrait",
});
/** The club's home and away kits, none without a club. */
export const kitsOf = (clubId: number | null): readonly ImageName[] =>
  clubId === null
    ? []
    : ["j0_", "j1_"].map((kit) => ({
        names: [`${kit}${String(clubId).padStart(5, "0")}`],
        shape: "kit",
      }));

/** The list columns with an image before their values: the club's crest, the league's logo, the flag. */
const COLUMN_IMAGES: Readonly<Partial<Record<SortKey, (player: Player) => ImageName | null>>> = {
  clubName: (player) => crestOf(player.clubId),
  leagueName: (player) => leagueLogoOf(player.leagueId),
  nationalityName: (player) => flagOf(player.nationalityId),
};

/** The image before a list column's value, or null. */
export const columnImage = (column: SortKey, player: Player): ImageName | null =>
  COLUMN_IMAGES[column]?.(player) ?? null;

/** How many image sizes wide the image before a column's values is (a flag as wide as a crest), 0 without one. */
export const columnImageWidth = (column: SortKey): number =>
  COLUMN_IMAGES[column] === undefined ? 0 : 1;

/** The first of the entries whose image can be made, or null; tried in order. */
export const firstUrl = (
  source: ImageSource,
  names: readonly string[],
  live: () => boolean,
): Promise<string | null> =>
  // One after another: a later entry is made only when the ones before it could not be, and none
  // once the request is dropped, as its URL would outlive the source's revoke.
  names.reduce<Promise<string | null>>(
    async (found, name) => (await found) ?? (live() ? source.url(name) : null),
    Promise.resolve(null),
  );

/**
 * The image of the first pack entry that can be made (a damaged one falls back to the next); while it
 * is made, an empty box of its size, so its arrival never moves the text. Nothing without a pack or
 * without such an entry.
 */
export const GameImage = ({ image }: { image: ImageName | null }) => {
  const source = use(ImageContext);
  // The entries the pack has, as one string so the effect runs only when they change.
  const had = image?.names.filter((entry) => source?.has(entry) === true) ?? [];
  const name = had.length === 0 ? null : had.join(" ");
  const [shown, setShown] = useState<{ source: ImageSource; name: string; src: string } | null>(
    null,
  );
  useEffect(() => {
    if (source === null || name === null) return undefined;
    // An answer that comes after the entry or the pack changed is dropped.
    const request = { live: true };
    void firstUrl(source, name.split(" "), () => request.live).then((src) => {
      if (request.live && src !== null) setShown({ source, name, src });
    });
    return () => {
      request.live = false;
    };
  }, [source, name]);
  if (image === null || name === null) return null;
  const className = image.shape === "square" ? "game-image" : `game-image ${image.shape}`;
  return shown?.source === source && shown.name === name ? (
    <img className={className} src={shown.src} alt="" />
  ) : (
    <span className={className} aria-hidden="true" />
  );
};
