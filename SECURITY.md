# Security policy

## Supported versions

Only the current `main` branch is supported.

## Reporting a vulnerability

Report it privately through GitHub: open the repository's **Security** tab and choose **Report a
vulnerability**. Do not open a public issue for it. Include what you found, how to reproduce it and
which commit you tested.

This is a spare-time project, so replies come as time allows. Fixes are merged into the default
branch, and the report is credited unless you ask otherwise.

## Scope

The tool runs entirely in the browser and reads files the user selects (game database, save files).
It has no server of its own, no accounts and no analytics.

In scope:

- parsing of user-selected files, for example a crafted save or database that crashes the tab,
  exhausts memory or injects script into the page;
- the build, the CI workflows and the dependencies that reach the shipped bundle.

Out of scope: changes a user makes to their own files to cheat in their own single-player game.
