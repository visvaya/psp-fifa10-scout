# PSP FIFA 10 Scout

A browser tool for the manager mode of FIFA 10 on the PlayStation Portable (also played in the
PPSSPP emulator): it reads the game's player database and your career save, and lets you filter and
compare players to find the ones worth signing.

## Status

Early development (November 2026). Use it at **<https://psp-fifa10-scout.visvaya.workers.dev/>**;
every change merged into `main` is published there after the checks pass. The interface is in Polish.

The current interface is a working draft: features come first, and its look and layout will change
in a planned redesign.

What it does today:

- Reads the player database (`fifa.db`) straight from your disc image (ISO), or from a `fifa.db`
  file you extracted yourself. From the image it reads only the database, the language files and
  the game's identifier.
- Optionally reads a manager-mode career save (`DATA.BIN` and `PARAM.SFO`): decrypts it, verifies
  its checksum and shows the current state of the career: clubs and leagues after promotions and
  relegations, contracts, loans, the transfer list, average match rating, morale, injuries, the
  youth players generated during the career and the game's own shortlist. The save is remembered
  on the device, with a summary of what it holds.
- Shows club, league, country and position names in any language of the game: every language found
  in your ISO, or one `.loc` file you attach with its `string.idx`.
- Computes each player's overall rating (OVR) with the game's own formula at every position, and
  the rating at a position in each way the game rates it, with the gain over the OVR.
- In a career: projects each player's peak OVR (also at the player's best position) and the growth
  left to it; shows league and cup appearances, goals, assists and clean sheets for the season.
- Prices players and wages with the game's formulas, and shows on the player card what an offer
  needs to succeed (fee, wage, contract length) or why the game would refuse any offer, for example
  when the club will not sell.
- Filters by position, league, club, nationality, preferred foot, body type, development type and
  traits; by ranges of age, OVR, potential, peak OVR, attributes, contract end, price, wage and
  more; any list filter can also keep everyone except the chosen values. Filters and sorting can be
  saved as named sets, the last change can be undone, and each filter can show or hide its value as
  a list column. The list sorts by its column labels, and each player has a detail card.
- Keeps your own watchlist with notes, without the game's limit of 20 players.
- Hides potential by default; one switch reveals it.
- Installs as an app on a phone or a PC and works offline after the first visit. On an iPhone, pick
  the files in the Files app.

Supported game version: FIFA 10, European release `ULES01328`. Other releases are not supported.

## Your files, not ours

The tool works only with files you provide from your own copy of the game and your own saves. This
repository contains no game data: no disc image, no database and no saves. Everything is processed
locally in your browser; nothing is uploaded. Your settings, saved filter sets and watchlist notes
stay in this browser on this device.

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
pnpm make:screenshots  # after pnpm build: retakes the sample screenshots of the start page (public/screenshots)
pnpm mutation  # mutation tests (Stryker); CI runs them every Sunday
```

Deployment: the `deploy` job in `.github/workflows/ci.yml` publishes the tested build to Cloudflare
Workers (configuration in `deploy/`, response headers in `public/_headers`), then
`scripts/check-deployment.ts` checks that the site serves exactly that build.

Source layout: `src/data` reads files (ISO, database, save decryption), `src/logic` holds the pure
player model, filters and ratings, and `src/ui` the React interface, with every user-facing text in
`src/ui/text.ts` and its `text-*.ts` parts. The one exception is the description of the tool on the
start page: it is static HTML in `index.html` (so it reads without running a script), and the app
moves that node onto the start screen.

Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).

## License

GPL-3.0-or-later, see [LICENSE](LICENSE). The save decryption in `src/data/psp-save-crypto.ts` is
ported from [PPSSPP](https://github.com/hrydgard/ppsspp) (GPL-2.0-or-later); the file states its
origin.

## Disclaimer

This is an unofficial fan project. It is not affiliated with, endorsed or sponsored by Electronic
Arts, FIFA or Sony. FIFA 10 and PlayStation Portable are trademarks of their respective owners and
are named here only to describe what the tool works with.
