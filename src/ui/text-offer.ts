// The texts of the card's offer section (offer-facts.tsx), a part of the UI texts beside text.ts.
import { pl } from "./typeset.ts";

export const OFFER_TEXT = {
  title: "Oferta",
  note: pl`Z kodu gry: najniższa kwota, którą klub przyjmie, i najniższe zarobki, za które zawodnik podpisze kontrakt na wybranych warunkach. Uwzględnia twój prestiż menedżera i poziom negocjatora z zapisu: wyższy może obniżyć kwotę dla klubu i zawsze ułatwia rozmowy z zawodnikiem. Na początku jest zwykła oferta, bez premii, na długość kontraktu, której chce zawodnik. Podwójna oferta, premia i inna długość zmieniają punkty zawodnika, a z nimi najniższe zarobki.`,
  double: "Podwójna oferta",
  doubleCost: pl`Podwójna oferta daje zawodnikowi 2 punkty i kosztuje 2 z „Pozostało ofert” zamiast 1.`,
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
  never: "nie podpisze: kontrakt sięgnąłby poza wiek zakończenia kariery",
  feeOverCap: pl`Kwota przekracza limit formularza przy pierwszej ofercie (1,5 wartości). Ponowna oferta po odmowie liczy limit od poprzedniej oferty: do 1,5 jej kwoty.`,
  wageOverCap: pl`Zarobki przekraczają limit formularza przy pierwszej ofercie (1,5 zarobków rynkowych). Ponowna oferta po odmowie liczy limit od poprzedniej oferty: do 1,5 jej zarobków.`,
  /** Why the game refuses any offer, whatever the fee (sale-rule.ts), with the game's own wording. */
  refusals: {
    position: pl`Klub odmówi sprzedaży bez względu na kwotę: ma za mało zawodników w grupie pozycji, do której gra go zalicza (na przykład wszyscy środkowi obrońcy), nie licząc wypożyczonych do klubu. W grze: „ma zbyt mało zawodników w swojej kadrze”.`,
    squad: pl`Klub odmówi sprzedaży bez względu na kwotę: ma 19 lub mniej zawodników w kadrze. W grze: „ma zbyt mało zawodników w swojej kadrze”.`,
    rivals: pl`Klub odmówi sprzedaży bez względu na kwotę: to odwieczny rywal twojego klubu. W grze: „z góry odrzuca oferty odwiecznych rywali”.`,
  },
} as const;
