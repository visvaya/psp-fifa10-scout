// The filter form's transfer section (filter-form.tsx builds its controls).
import { ContractField } from "./filter-field-groups.tsx";
import { Section } from "./filter-fields.tsx";
import type { Kit } from "./filter-form.tsx";
import { FILTER_SECTION_LABELS } from "./text.ts";

/**
 * What a transfer turns on (owner, 2026-11-10): the price, the wage and the market lists come with a
 * career, the wage after a transfer with its profile (owner, 2026-11-14); the contract is in fifa.db too.
 */
export const transferSection = (
  { filters, change, facets, range, flag, eye }: Kit,
  career: boolean,
  afterTransfer: boolean,
) => (
  <Section title={FILTER_SECTION_LABELS.transfer}>
    {career ? [range("price"), range("wage")] : null}
    {career && afterTransfer ? range("transferWage") : null}
    <ContractField
      years={facets.contractYears}
      range={filters.ranges?.contractEndYear}
      column={eye("contractEndYear")}
      onChange={(next) => {
        change({ ranges: { ...filters.ranges, contractEndYear: next } });
      }}
    />
    {range("contractYearsLeft")}
    {career
      ? (["transferListed", "loanListed", "loaned", "clubWillSell"] as const).map(flag)
      : null}
  </Section>
);
