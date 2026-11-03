// Writes a synthetic fifa.db for the browser tests, so they never need the game's data.
//
// Usage: node scripts/write-synthetic-db.ts
// Output: .e2e-data/fifa.db (git-ignored).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildScoutDb } from "../src/logic/test-support/scout-db.ts";

export const SYNTHETIC_DB_PATH = path.join(".e2e-data", "fifa.db");

if (import.meta.main) {
  mkdirSync(path.dirname(SYNTHETIC_DB_PATH), { recursive: true });
  writeFileSync(SYNTHETIC_DB_PATH, buildScoutDb());
  console.log(`Wrote ${SYNTHETIC_DB_PATH}`);
}
