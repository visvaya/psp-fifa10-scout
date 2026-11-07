import { SCOUT_CONFIG } from "./config.ts";

type AttributeBand = "high" | "good" | "average" | "low";

/** The FIFA colour band of an attribute or potential value. */
export const attributeBand = (value: number): AttributeBand => {
  const { high, good, average } = SCOUT_CONFIG.attributeBandMin;
  if (value >= high) return "high";
  if (value >= good) return "good";
  return value >= average ? "average" : "low";
};
