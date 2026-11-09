// Shortens a Dependabot pull request title that is longer than the commit header limit. Dependabot writes
// "bump <package> from <old> to <new> in the <group> group" and has no setting for the title's form, so a
// long package name fails the title check. The squashed commit takes the title, so it must fit.
// Usage: node scripts/dependabot-title.ts "<title>"   (prints the title to use)

/** commitlint's header-max-length (commitlint.config.mjs; a test keeps the two equal). */
export const MAX_TITLE_CHARS = 72;

/** Dropped in turn until the title fits: the group's name, then the version it updates from. */
const DROPPABLE: readonly (readonly [RegExp, string])[] = [
  [/ in the \S+ group$/u, ""],
  [/ from \S+ to /u, " to "],
];

/** The title within the limit, or unchanged when it fits or nothing droppable brings it there. */
export const shortTitle = (title: string): string => {
  let short = title;
  for (const [pattern, replacement] of DROPPABLE) {
    if (short.length <= MAX_TITLE_CHARS) return short;
    short = short.replace(pattern, replacement);
  }
  return short.length <= MAX_TITLE_CHARS ? short : title;
};

if (import.meta.main) {
  process.stdout.write(`${shortTitle(process.argv[2] ?? "")}\n`);
}
