// The game's own images (club crests, league logos, flags) before the names they belong to, decorative:
// each decoded once a session, on first show, into a PNG blob URL that is freed when the pack changes.
import { createContext, use, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { decodeShpm, MAX_IMAGE_BYTES, unrefpack } from "../data/game-graphics.ts";
import type { DecodedImage, GraphicsPack } from "../data/game-graphics.ts";
import type { Player } from "../logic/players.ts";
import type { SortKey } from "../logic/sort-players.ts";

type ImageUrl = (name: string) => Promise<string | null>;

const pngUrl = async ({ width, height, rgba }: DecodedImage): Promise<string> => {
  const canvas = document.createElement("canvas");
  [canvas.width, canvas.height] = [width, height];
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("No 2D canvas");
  context.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (blob === null) throw new Error("The image could not be exported");
  return URL.createObjectURL(blob);
};

/**
 * The URL of each entry's image, made on its first ask and kept; null for a missing entry or one that
 * cannot be decoded. revoke frees the URLs made, and those made after it.
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
  const urls = new Map<string, Promise<string | null>>();
  const made: string[] = [];
  let revoked = false;
  const make = async (packed: Uint8Array): Promise<string | null> => {
    try {
      const url = await toUrl(decodeShpm(unrefpack(packed, MAX_IMAGE_BYTES)));
      if (!revoked) {
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
    url: (name: string): Promise<string | null> => {
      const known = urls.get(name);
      if (known !== undefined) return known;
      const packed = index.get(name);
      const url = packed === undefined ? Promise.resolve(null) : make(packed);
      urls.set(name, url);
      return url;
    },
    revoke: () => {
      revoked = true;
      for (const url of made) URL.revokeObjectURL(url);
    },
  };
};

const ImageSource = createContext<ImageUrl | null>(null);

/** Gives the images of the pack to the GameImage elements under it; without a pack they show none. */
export const GameImages = ({
  pack,
  children,
}: {
  pack: GraphicsPack | null;
  children: ReactNode;
}) => {
  const urls = useMemo(() => (pack === null ? null : imageUrls(pack)), [pack]);
  useEffect(
    () => () => {
      urls?.revoke();
    },
    [urls],
  );
  return <ImageSource value={urls?.url ?? null}>{children}</ImageSource>;
};

/** There are images to show: the list makes room for them. */
export const useHasGameImages = (): boolean => use(ImageSource) !== null;

/** A pack entry's name with how it is drawn: a flag is twice as wide as it is high, the rest square. */
export interface ImageName {
  readonly name: string;
  readonly flag: boolean;
}

export const crestOf = (clubId: number | null): ImageName | null =>
  clubId === null ? null : { name: `tl${String(clubId)}`, flag: false };
export const leagueLogoOf = (leagueId: number | null): ImageName | null =>
  leagueId === null ? null : { name: `ll${String(leagueId)}`, flag: false };
export const flagOf = (countryId: number): ImageName => ({
  name: `ls${String(countryId)}`,
  flag: true,
});

/** How many image sizes wide the image before a column's values is: a flag twice its height. */
export const IMAGE_WIDTHS: Readonly<Partial<Record<SortKey, number>>> = {
  clubName: 1,
  leagueName: 1,
  nationalityName: 2,
};

/** The image before a list column's value: the club's crest, the league's logo or the flag. */
export const columnImage = (column: SortKey, player: Player): ImageName | null => {
  if (column === "clubName") return crestOf(player.clubId);
  if (column === "leagueName") return leagueLogoOf(player.leagueId);
  return column === "nationalityName" ? flagOf(player.nationalityId) : null;
};

/** The image of a pack entry, or nothing while it is made, without a pack or without such an entry. */
export const GameImage = ({ image }: { image: ImageName | null }) => {
  const url = use(ImageSource);
  const name = image?.name ?? null;
  const [shown, setShown] = useState<{ url: ImageUrl; name: string; src: string } | null>(null);
  useEffect(() => {
    if (url === null || name === null) return undefined;
    let live = true;
    void url(name).then((src) => {
      if (live && src !== null) setShown({ url, name, src });
    });
    return () => {
      live = false;
    };
  }, [url, name]);
  return image !== null && shown?.url === url && shown.name === image.name ? (
    <img className={image.flag ? "game-image flag" : "game-image"} src={shown.src} alt="" />
  ) : null;
};
