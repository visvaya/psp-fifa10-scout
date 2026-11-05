// The texts of the card's offer section (player-card.tsx), a part of the UI texts beside text.ts.
export const OFFER_TEXT = {
  title: "Oferta",
  note: "Z kodu gry: najniższa kwota, którą klub przyjmie, i najniższe zarobki, za które zawodnik podpisze kontrakt na długość, której chce. Bez podwójnej oferty i premii; nie uwzględnia rywalizacji klubów.",
  fee: "Klub przyjmie od",
  noFee: "bez kwoty (kontrakt wygasł)",
  wage: "Zawodnik podpisze od",
  wageValue: (wage: string, years: string): string => `${wage} na mecz, kontrakt ${years}`,
  never: "nie podpisze: kontrakt sięgnąłby poza wiek zakończenia kariery",
  feeOverCap: "Kwota przekracza limit formularza oferty (około 125 % wartości).",
  wageOverCap: "Zarobki przekraczają limit formularza oferty (około 120 % zarobków rynkowych).",
  /** The club refuses before any fee (sale-rule.ts). */
  clubRefuses:
    "Klub odmówi sprzedaży bez względu na kwotę: ma za mało zawodników na tej pozycji albo 19 lub mniej w kadrze.",
} as const;
