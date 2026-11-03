# PSP FIFA 10 Scout

A browser tool for the manager mode of FIFA 10 on the PlayStation Portable (also played in the
PPSSPP emulator): it reads the game's player database and your career save, and lets you filter and
compare players to find the ones worth signing.

## Status

Early development (November 2026). The repository holds the project skeleton and its quality gate;
there is no usable feature yet. Planned, in this order:

1. Reading PSP save files of FIFA 10 (decryption and checksum verification).
2. Reading the player database (`fifa.db`) from your own copy of the game.
3. Reading the current state of a manager-mode career from a save.
4. Filtering and comparing players in an installable web app that also works on a phone.

Supported game version: FIFA 10, European release `ULES01328`. Other releases may differ.

## Your files, not ours

The tool works only with files you provide from your own copy of the game and your own saves. This
repository contains no game data: no disc image, no database and no saves. Everything is processed
locally in your browser; nothing is uploaded.

## Development

Prerequisites: Node.js 26 (see `.nvmrc`) and pnpm 12 (pinned in `package.json`).

```sh
pnpm install   # also installs the git hooks
pnpm dev       # development server
pnpm verify    # the full gate CI runs: format, text rules, typecheck, lint, tests, duplicates, dead code, build
```

Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).

## License

GPL-3.0-or-later, see [LICENSE](LICENSE).

## Disclaimer

This is an unofficial fan project. It is not affiliated with, endorsed or sponsored by Electronic
Arts, FIFA or Sony. FIFA 10 and PlayStation Portable are trademarks of their respective owners and
are named here only to describe what the tool works with.
