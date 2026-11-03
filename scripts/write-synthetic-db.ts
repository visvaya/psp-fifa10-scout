// Writes a synthetic fifa.db and a Polish language file for the browser tests, so they never need
// the game's data.
//
// Usage: node scripts/write-synthetic-db.ts
// Output: .e2e-data/fifa.db, .e2e-data/pol_pl.loc, .e2e-data/string.idx and a plain career save in
// .e2e-data/save/ (git-ignored).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildPlainSave,
  buildScoutDb,
  buildScoutLocale,
} from "../src/logic/test-support/scout-db.ts";

export const SYNTHETIC_DB_PATH = path.join(".e2e-data", "fifa.db");
export const SYNTHETIC_LOCALE_PATHS = [
  path.join(".e2e-data", "pol_pl.loc"),
  path.join(".e2e-data", "string.idx"),
] as const;
export const SYNTHETIC_SAVE_PATHS = [
  path.join(".e2e-data", "save", "DATA.BIN"),
  path.join(".e2e-data", "save", "PARAM.SFO"),
] as const;

if (import.meta.main) {
  mkdirSync(path.dirname(SYNTHETIC_DB_PATH), { recursive: true });
  writeFileSync(SYNTHETIC_DB_PATH, buildScoutDb());
  const { loc, idx } = buildScoutLocale();
  writeFileSync(SYNTHETIC_LOCALE_PATHS[0], loc);
  writeFileSync(SYNTHETIC_LOCALE_PATHS[1], idx);
  mkdirSync(path.dirname(SYNTHETIC_SAVE_PATHS[0]), { recursive: true });
  const { dataBin, paramSfo } = buildPlainSave();
  writeFileSync(SYNTHETIC_SAVE_PATHS[0], dataBin);
  writeFileSync(SYNTHETIC_SAVE_PATHS[1], paramSfo);
  console.log(
    `Wrote ${[SYNTHETIC_DB_PATH, ...SYNTHETIC_LOCALE_PATHS, ...SYNTHETIC_SAVE_PATHS].join(", ")}`,
  );
}
