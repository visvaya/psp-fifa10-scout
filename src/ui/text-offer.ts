// The texts of the card's offer section (offer-facts.tsx), a part of the UI texts beside text.ts.
import { pl } from "./typeset.ts";

export const OFFER_TEXT = {
  title: "Oferta",
  double: "Podwójna oferta",
  bonus: "Premia za bramkę lub czyste konto",
  bonusOption: (percent: number): string => `${String(percent)}% zarobków`,
  length: "Długość kontraktu",
  lengthOption: (years: string, wanted: boolean): string =>
    wanted ? `${years}, tyle chce zawodnik` : years,
  fee: "Klub przyjmie od",
  noFee: "bez kwoty (kontrakt wygasł)",
  wage: "Zawodnik podpisze od",
  wageValue: (wage: string, years: string): string => `${wage} na mecz, kontrakt ${years}`,
  bonusAmount: "Premia",
  /** A free agent's estimated value once he signs for the user's club (player-finance.ts). */
  signedValue: "Wartość po podpisaniu (szacunkowa)",
  signedValueHelp: pl`Wolny zawodnik ma w grze wartość 0. To jego cena według wzoru gry, gdy podpisze z twoim klubem kontrakt o wybranej długości: z prestiżem twojego klubu i ligi zamiast prestiżu liczonego z OVR. Bez wzrostu potencjału, który gra dodaje przy podpisaniu.`,
  never: "nie podpisze: kontrakt sięgnąłby poza wiek zakończenia kariery",
  /** Why the game refuses any offer, whatever the fee (sale-rule.ts), with the game's own wording. */
  refusals: {
    position: pl`Klub odmówi sprzedaży bez względu na kwotę: ma za mało zawodników w grupie pozycji, do której gra go zalicza (na przykład wszyscy środkowi obrońcy), nie licząc wypożyczonych do klubu. W grze: „ma zbyt mało zawodników w swojej kadrze”.`,
    squad: pl`Klub odmówi sprzedaży bez względu na kwotę: ma 19 lub mniej zawodników w kadrze. W grze: „ma zbyt mało zawodników w swojej kadrze”.`,
    rivals: pl`Klub odmówi sprzedaży bez względu na kwotę: to odwieczny rywal twojego klubu. W grze: „z góry odrzuca oferty odwiecznych rywali”.`,
  },
} as const;
