# PSP FIFA 10 Scout

A browser tool for the manager mode of FIFA 10 on the PlayStation Portable (also played in the
PPSSPP emulator): it reads the game's player database and your career save, and lets you filter and
compare players to find the ones worth signing.

## Status

Early development (November 2026). The tool works end to end but has no public hosted version
yet; run it locally (see [Development](#development)). The interface is in Polish.

What it does today:

- Reads the player database (`fifa.db`) straight from your disc image (ISO), or from a `fifa.db`
  file you extracted yourself. Only the database is read from the image, not the whole file.
- Optionally reads a manager-mode career save (`DATA.BIN` and `PARAM.SFO`): decrypts it, verifies
  its checksum and shows the current state of the career, such as clubs, contracts, form, morale,
  injuries, the transfer list and the youth players generated during the career.
- Shows club, league and country names in any language of the game: every language found in your
  ISO, or one `.loc` file you attach with its `string.idx`.
- Computes each player's overall rating (OVR) with the game's own formula, also at any other
  position.
- Filters by position, league, club, nationality, preferred foot, body type and development type;
  by ranges of age, OVR, potential, height, weight, attributes, contract end, form, morale and more;
  and by traits. Results can be sorted, and each player has a detail card.
- Hides potential by default, because the game does not show it; one switch reveals it.
- Installs as an app on a phone or a PC and works offline after the first visit. On an iPhone, pick
  the files in the Files app.

Not yet available: transfer price and wage estimates, a hosted version.

Supported game version: FIFA 10, European release `ULES01328`. Other releases may differ.

## Your files, not ours

The tool works only with files you provide from your own copy of the game and your own saves. This
repository contains no game data: no disc image, no database and no saves. Everything is processed
locally in your browser; nothing is uploaded.

Where the files are:

- the disc image: wherever you keep your PPSSPP games;
- the career save: `PSP/SAVEDATA/ULES01328…` in the PPSSPP folder (select `DATA.BIN` and
  `PARAM.SFO` together).

## Development

Prerequisites: Node.js 26 (see `.nvmrc`) and pnpm 12 (pinned in `package.json`).

```sh
pnpm install   # also installs the git hooks
pnpm dev       # development server
pnpm build && pnpm preview   # production build, including the offline service worker
pnpm verify    # the full gate CI runs: format, text rules, typecheck, lint, tests, duplicates, dead code, build, size
pnpm test:e2e  # browser tests (Chromium and WebKit, with axe), on a synthetic database
```

Source layout: `src/data` reads files (ISO, database, save decryption), `src/logic` holds the pure
player model, filters and ratings, and `src/ui` the React interface, with every user-facing text in
`src/ui/text.ts`.

Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).

## License

GPL-3.0-or-later, see [LICENSE](LICENSE). The save decryption in `src/data/psp-save-crypto.ts` is
ported from [PPSSPP](https://github.com/hrydgard/ppsspp) (GPL-2.0-or-later); the file states its
origin.

## Disclaimer

This is an unofficial fan project. It is not affiliated with, endorsed or sponsored by Electronic
Arts, FIFA or Sony. FIFA 10 and PlayStation Portable are trademarks of their respective owners and
are named here only to describe what the tool works with.
