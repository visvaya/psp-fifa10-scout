// Writes a synthetic fifa.db and a Polish language file for the browser tests, so they never need
// the game's data.
//
// Usage: node scripts/write-synthetic-db.ts
// Output: .e2e-data/fifa.db, .e2e-data/pol_pl.loc and .e2e-data/string.idx (git-ignored).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildScoutDb, buildScoutLocale } from "../src/logic/test-support/scout-db.ts";

export const SYNTHETIC_DB_PATH = path.join(".e2e-data", "fifa.db");
export const SYNTHETIC_LOCALE_PATHS = [
  path.join(".e2e-data", "pol_pl.loc"),
  path.join(".e2e-data", "string.idx"),
] as const;

if (import.meta.main) {
  mkdirSync(path.dirname(SYNTHETIC_DB_PATH), { recursive: true });
  writeFileSync(SYNTHETIC_DB_PATH, buildScoutDb());
  const { loc, idx } = buildScoutLocale();
  writeFileSync(SYNTHETIC_LOCALE_PATHS[0], loc);
  writeFileSync(SYNTHETIC_LOCALE_PATHS[1], idx);
  console.log(`Wrote ${SYNTHETIC_DB_PATH} and ${SYNTHETIC_LOCALE_PATHS.join(", ")}`);
}
