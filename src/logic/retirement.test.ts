import { describe, expect, it } from "vitest";
import { retiresAfterSeason } from "./retirement.ts";

const born = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

// The rule found on two season turns (game-knowledge: retirement): his game age on 31 December of the
// year the season ends reaches his retirement age.
describe("retiresAfterSeason", () => {
  it("retires a player whose age on 31 December of the season's last year reaches his limit", () => {
    // Season 2010/11 starts in 2010 and ends in 2011: his age on 2011-12-31 counts.
    expect(retiresAfterSeason(born("1976-06-01"), 35, 2010)).toBe(true);
    expect(retiresAfterSeason(born("1976-06-01"), 36, 2010)).toBe(false);
  });

  it("counts a birthday late in the year, before 31 December, already", () => {
    expect(retiresAfterSeason(born("1976-12-30"), 35, 2010)).toBe(true);
    // Born in 1977: 34 on 2011-12-31.
    expect(retiresAfterSeason(born("1977-01-02"), 35, 2010)).toBe(false);
  });
});
