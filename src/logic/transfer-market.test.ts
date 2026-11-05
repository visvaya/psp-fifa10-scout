import { describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import type { EaDbRow } from "../data/ea-db.ts";
import { buildPlayers } from "./players.ts";
import { buildPlainSave, buildScoutDb } from "./test-support/scout-db.ts";
import { marketFields, transferMarketOf } from "./transfer-market.ts";

const listing = (playerid: number, isLoan: number, sold: number): EaDbRow => ({
  playerid,
  is_loan: isLoan,
  sold,
});

describe("transferMarketOf", () => {
  // The list keeps the window's sold rows: only unsold ones are still on offer.
  const market = transferMarketOf(
    [listing(1, 0, 0), listing(2, 0, 1), listing(3, 1, 0), listing(4, 1, 1)],
    [{ playerid: 4, oldteamid: 241 }],
  );

  it("lists unsold players for a transfer or for a loan apart", () => {
    expect([...market.listed]).toEqual([1]);
    expect([...market.loanListed]).toEqual([3]);
  });

  it("keeps the club each player on loan belongs to", () => {
    expect([...market.loanedFrom]).toEqual([[4, 241]]);
  });
});

describe("marketFields", () => {
  const market = transferMarketOf([listing(1, 0, 0)], [{ playerid: 4, oldteamid: 241 }]);
  const teams = new Map([[241, { name: "FC Barcelona" }]]);

  it("names the club a player on loan comes from", () => {
    expect(marketFields(market, teams, 4)).toEqual({
      transferListed: false,
      loanListed: false,
      loanedFromId: 241,
      loanedFromName: "FC Barcelona",
    });
  });

  it("leaves the loan empty for a player at his own club", () => {
    expect(marketFields(market, teams, 1)).toEqual({
      transferListed: true,
      loanListed: false,
      loanedFromId: null,
      loanedFromName: null,
    });
  });

  it("keeps the id when the parent club has no team row", () => {
    const lent = transferMarketOf([], [{ playerid: 5, oldteamid: 9 }]);
    expect(marketFields(lent, teams, 5)).toMatchObject({ loanedFromId: 9, loanedFromName: null });
  });
});

describe("the market through buildPlayers", () => {
  const db = parseEaDb(buildScoutDb());
  const save = parseCareerSave(db, buildPlainSave().dataBin);

  // The synthetic window lists Gracz Numer 18 (1017) for a loan; here he also plays on loan.
  it("marks a loan listing and names the club a player on loan comes from", () => {
    const lent = new Map([...save, ["career_loaned_list", [{ playerid: 1017, oldteamid: 241 }]]]);
    expect(buildPlayers(db, lent).find((player) => player.id === 1017)).toMatchObject({
      transferListed: false,
      loanListed: true,
      loanedFromId: 241,
      loanedFromName: "FC Barcelona",
    });
  });
});
