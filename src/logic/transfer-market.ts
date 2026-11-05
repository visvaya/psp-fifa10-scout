// The career's transfer window and loans. career_transfer_list keeps the window's sold rows too (sold 1,
// the player already moved), so only unsold rows are on offer; is_loan splits a transfer listing from
// a loan one. career_loaned_list holds each player on loan with his parent club, while his team link
// points at the club he plays for (32 of 32 in the owner's 2011-04-06 save).
import type { EaDbRow } from "../data/ea-db.ts";

export interface TransferMarket {
  /** Listed for a transfer and not sold yet. */
  readonly listed: ReadonlySet<number>;
  /** Listed for a loan and not loaned yet. */
  readonly loanListed: ReadonlySet<number>;
  /** The parent club of each player on loan. */
  readonly loanedFrom: ReadonlyMap<number, number>;
}

const num = (row: EaDbRow, key: string): number => Number(row[key]);

export const transferMarketOf = (
  transferList: readonly EaDbRow[],
  loans: readonly EaDbRow[],
): TransferMarket => {
  const open = transferList.filter((row) => num(row, "sold") === 0);
  const players = (loan: boolean) =>
    new Set(
      open.filter((row) => (num(row, "is_loan") === 1) === loan).map((row) => num(row, "playerid")),
    );
  return {
    listed: players(false),
    loanListed: players(true),
    loanedFrom: new Map(loans.map((row) => [num(row, "playerid"), num(row, "oldteamid")])),
  };
};

/** A player's fields from the market; the parent club's name from `teams`, null when unknown. */
export const marketFields = (
  market: TransferMarket,
  teams: ReadonlyMap<number, { readonly name: string }>,
  playerId: number,
) => {
  const parent = market.loanedFrom.get(playerId);
  return {
    transferListed: market.listed.has(playerId),
    loanListed: market.loanListed.has(playerId),
    loanedFromId: parent ?? null,
    loanedFromName: parent === undefined ? null : (teams.get(parent)?.name ?? null),
  };
};
