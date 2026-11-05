// The texts of the card's offer section (player-card.tsx), a part of the UI texts beside text.ts.
import { pl } from "./typeset.ts";

export const OFFER_TEXT = {
  title: "Oferta",
  note: pl`Z kodu gry: najniższa kwota, którą klub przyjmie, i najniższe zarobki, za które zawodnik podpisze kontrakt na długość, której chce. Zakłada zwykłą ofertę (nie podwójną) i premię 0 za gola czy czyste konto; podwójna oferta dodaje zawodnikowi punkty, premia też. Znaczenie pola „Liczba ofert” z formularza gry nie jest odczytane.`,
  fee: "Klub przyjmie od",
  noFee: "bez kwoty (kontrakt wygasł)",
  wage: "Zawodnik podpisze od",
  wageValue: (wage: string, years: string): string => `${wage} na mecz, kontrakt ${years}`,
  never: "nie podpisze: kontrakt sięgnąłby poza wiek zakończenia kariery",
  feeOverCap: pl`Kwota przekracza limit formularza oferty (około 125% wartości).`,
  wageOverCap: pl`Zarobki przekraczają limit formularza oferty (około 120% zarobków rynkowych).`,
  /** Why the game refuses any offer, whatever the fee (sale-rule.ts), with the game's own wording. */
  refusals: {
    position: pl`Klub odmówi sprzedaży bez względu na kwotę: ma za mało zawodników na tej pozycji. W grze: „ma zbyt mało zawodników w swojej kadrze”.`,
    squad: pl`Klub odmówi sprzedaży bez względu na kwotę: ma 19 lub mniej zawodników w kadrze. W grze: „ma zbyt mało zawodników w swojej kadrze”.`,
    rivals: pl`Klub odmówi sprzedaży bez względu na kwotę: to odwieczny rywal twojego klubu. W grze: „z góry odrzuca oferty odwiecznych rywali”.`,
  },
} as const;
