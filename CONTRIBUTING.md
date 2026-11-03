# Contributing

Thanks for your interest. This is a small spare-time project; issues and pull requests are welcome,
but replies may take a while.

## Setup

Node.js 26 and pnpm 12, then `pnpm install`. Installing also points git at the hooks in
`.githooks/`, which run lint and format checks before each commit and check the commit message.

## Before a pull request

- Run `pnpm verify`. CI runs the same gate and must pass before a merge.
- Keep the change focused; add or update tests for logic in `src/logic` and `src/data`.
- Never commit game data (disc images, databases, saves or anything extracted from them). Tests use
  synthetic data.

## Commits and pull requests

- Commit messages and pull request titles follow
  [Conventional Commits](https://www.conventionalcommits.org/), for example
  `feat(filters): add age range`. Pull requests are squash-merged, so the title becomes the commit
  on `main`.
- No em dashes (U+2014) or emoji in code, messages or documents; the hooks and CI reject them.
- Fill in the pull request template: what changed, which checks you ran and which you skipped.

## License

By contributing you agree that your contribution is licensed under GPL-3.0-or-later.
