import { useMemo, useState } from "react";
import type { Dispatch, JSX } from "react";
import type { FlagKey, ListKey, Range, RangeKey } from "../logic/filter-players.ts";
import { ATTRIBUTE_NAMES, TRAIT_NAMES } from "../logic/players.ts";
import type { AttributeName, Player, TraitName } from "../logic/players.ts";
import { POSITION_GROUPS } from "../logic/positions.ts";
import { facetOptions } from "../logic/facets.ts";
import type { FacetOption } from "../logic/facets.ts";
import { activeFilters } from "../logic/scout-state.ts";
import type {
  ClubStatus,
  FilterChange,
  MyClub,
  ScoutAction,
  ScoutFilters,
} from "../logic/scout-state.ts";
import {
  ChoiceField,
  FlagField,
  numberOrUndefined,
  RangeField,
  Section,
} from "./filter-fields.tsx";
import type { Choice } from "./filter-fields.tsx";
import { PositionRatingField } from "./position-rating-field.tsx";
import {
  ATTRIBUTE_LABELS,
  CLUB_STATUS_LABELS,
  MY_CLUB_LABELS,
  FILTER_SECTION_LABELS,
  FLAG_LABELS,
  LIST_LABELS,
  POSITION_GROUP_LABELS,
  rangeLabel,
  TEXT,
} from "./text.ts";

interface FilterFormProps {
  readonly players: readonly Player[];
  readonly collator: Intl.Collator;
  /** A position's name to choose it by, in the chosen language (positionNameIn). */
  readonly positionName: (code: number) => string;
  readonly filters: ScoutFilters;
  readonly myTeamId: number | null;
  readonly showPotential: boolean;
  readonly dispatch: Dispatch<ScoutAction>;
}

type Change = (filters: FilterChange) => void;

/** Traits about character and renown; the other traits describe play. */
const CHARACTER_TRAITS: readonly TraitName[] = [
  "adaptability",
  "flexibility",
  "inflexible",
  "ambition",
  "highclubidentification",
  "lowclubidentification",
  "hightrainingworkrate",
  "lowtrainingworkrate",
  "lowconcentration",
  "mediadarling",
  "scandalprone",
];
const PLAY_TRAITS = TRAIT_NAMES.filter((trait) => !CHARACTER_TRAITS.includes(trait));

const CLUB_STATUSES: readonly ClubStatus[] = ["available", "free-agents"];

/** "All" stands for an unset my-club filter. */
const MY_CLUB_OPTIONS: readonly ("all" | MyClub)[] = ["all", "hide", "only"];

/** One choice of a few, as radio buttons. */
const RadioField = <T extends string>(props: {
  readonly legend: string;
  readonly name: string;
  readonly options: readonly T[];
  readonly labels: Readonly<Record<T, string>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
}) => (
  <fieldset className="field">
    <legend>{props.legend}</legend>
    {props.options.map((option) => (
      <label key={option} className="check">
        <input
          type="radio"
          name={props.name}
          checked={props.value === option}
          onChange={() => {
            props.onChange(option);
          }}
        />
        {props.labels[option]}
      </label>
    ))}
  </fieldset>
);

/** Shown with a career: fifa.db has no free agents and no club of the user's. */
const CareerClubFields = ({ filters, change }: { filters: ScoutFilters; change: Change }) => (
  <>
    <RadioField
      legend={TEXT.clubStatus}
      name="club-status"
      options={CLUB_STATUSES}
      labels={CLUB_STATUS_LABELS}
      value={filters.clubStatus ?? "available"}
      onChange={(clubStatus) => {
        change({ clubStatus });
      }}
    />
    <RadioField
      legend={TEXT.myClub}
      name="my-club"
      options={MY_CLUB_OPTIONS}
      labels={MY_CLUB_LABELS}
      value={filters.myClub ?? "all"}
      onChange={(option) => {
        change({ myClub: option === "all" ? undefined : option });
      }}
    />
  </>
);

const ContractField = (props: {
  years: readonly number[];
  range: Range | undefined;
  onChange: (range: Range) => void;
}) => (
  <label className="field">
    <span>{TEXT.contractEndsBy}</span>
    <select
      value={props.range?.max ?? ""}
      onChange={(event) => {
        props.onChange({ max: numberOrUndefined(event.currentTarget.value) });
      }}
    >
      <option value="">{TEXT.anyOption}</option>
      {props.years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  </label>
);

/** Ranges for the attributes the user adds from a list, instead of one input pair per attribute. */
const AttributeRanges = (props: {
  ranges: ScoutFilters["ranges"];
  onChange: (name: AttributeName, range: Range | undefined) => void;
}) => {
  const [added, setAdded] = useState<readonly AttributeName[]>([]);
  const shown = ATTRIBUTE_NAMES.filter(
    (name) => added.includes(name) || props.ranges?.[name] !== undefined,
  );
  return (
    <>
      {shown.map((name) => (
        <div key={name} className="attribute-range">
          <RangeField
            label={ATTRIBUTE_LABELS[name]}
            range={props.ranges?.[name]}
            onChange={(range) => {
              // A field being edited stays until removed: clearing its value to type a new one
              // drops the empty range from the filters, which alone would take the field away.
              if (!added.includes(name)) setAdded([...added, name]);
              props.onChange(name, range);
            }}
          />
          <button
            type="button"
            className="button"
            aria-label={TEXT.removeAttribute(ATTRIBUTE_LABELS[name])}
            onClick={() => {
              setAdded(added.filter((item) => item !== name));
              props.onChange(name, undefined);
            }}
          >
            {TEXT.removeMark}
          </button>
        </div>
      ))}
      <label className="field">
        <span>{TEXT.addAttribute}</span>
        <select
          value=""
          onChange={(event) => {
            const name = ATTRIBUTE_NAMES.find((item) => item === event.currentTarget.value);
            if (name !== undefined) setAdded([...added, name]);
          }}
        >
          <option value="">{TEXT.chooseAttribute}</option>
          {ATTRIBUTE_NAMES.filter((name) => !shown.includes(name)).map((name) => (
            <option key={name} value={name}>
              {ATTRIBUTE_LABELS[name]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
};

const facetChoices = (options: readonly FacetOption[]): readonly Choice<number>[] =>
  options.map((option) => ({ value: option.id, label: option.name }));

const codeChoices = (codes: readonly number[], prefix: string): readonly Choice<number>[] =>
  codes.map((code) => ({ value: code, label: TEXT.code(prefix, code) }));

/** Ranges of large amounts, typed with grouped digits. */
const GROUPED_RANGES: ReadonlySet<RangeKey> = new Set(["price", "wage"]);

/** Builders for one control of each kind, bound to the current filters. */
const controls = (filters: ScoutFilters, change: Change) => ({
  range: (key: RangeKey) => (
    <RangeField
      key={key}
      label={rangeLabel(key)}
      range={filters.ranges?.[key]}
      grouped={GROUPED_RANGES.has(key)}
      decimal={key === "form"}
      onChange={(range) => {
        change({ ranges: { ...filters.ranges, [key]: range } });
      }}
    />
  ),
  list: <K extends ListKey>(key: K, choices: readonly Choice<NonNullable<Player[K]>>[]) => (
    <ChoiceField
      label={LIST_LABELS[key]}
      choices={choices}
      chosen={filters.lists?.[key]}
      onChange={(chosen) => {
        change({ lists: { ...filters.lists, [key]: chosen } });
      }}
      excluded={filters.excludedLists?.[key] === true}
      onExcludedChange={(excluded) => {
        change({ excludedLists: { ...filters.excludedLists, [key]: excluded } });
      }}
    />
  ),
  flag: (key: FlagKey) => (
    <FlagField
      key={key}
      label={FLAG_LABELS[key]}
      wanted={filters.flags?.[key]}
      onChange={(wanted) => {
        change({ flags: { ...filters.flags, [key]: wanted } });
      }}
    />
  ),
});

type Kit = ReturnType<typeof controls> & {
  readonly filters: ScoutFilters;
  readonly change: Change;
  readonly facets: ReturnType<typeof facetOptions>;
  readonly positionName: (code: number) => string;
};

/** career: the peak OVR exists only with a career save. */
const basicSection = (kit: Kit, showPotential: boolean, career: boolean) => {
  const { filters, change, facets, range, list, positionName } = kit;
  return (
    <Section title={FILTER_SECTION_LABELS.basic} initiallyOpen>
      <label className="field">
        <span>{TEXT.text}</span>
        <input
          type="search"
          value={filters.text ?? ""}
          onChange={(event) => {
            change({ text: event.currentTarget.value });
          }}
        />
      </label>
      {list(
        "positionGroup",
        POSITION_GROUPS.map((group) => ({ value: group, label: POSITION_GROUP_LABELS[group] })),
      )}
      {list(
        "positionCode",
        facets.codes.positionCode.map((code) => ({ value: code, label: positionName(code) })),
      )}
      {list("preferredFoot", [
        { value: "left", label: TEXT.card.left },
        { value: "right", label: TEXT.card.right },
      ])}
      {range("weakFoot")}
      {range("age")}
      {range("overall")}
      <PositionRatingField
        rating={filters.positionRating}
        positionName={positionName}
        change={change}
      />
      {showPotential
        ? [range("potential"), range("growth"), ...(career ? [range("peak")] : [])]
        : null}
    </Section>
  );
};

const physiqueSection = ({ facets, range, list }: Kit) => (
  <Section title={FILTER_SECTION_LABELS.physique}>
    {range("height")}
    {range("weight")}
    {list("bodyType", codeChoices(facets.codes.bodyType, TEXT.codePrefix.bodyType))}
  </Section>
);

const characterSection = ({ facets, range, list, flag }: Kit) => (
  <Section title={FILTER_SECTION_LABELS.character}>
    {CHARACTER_TRAITS.map(flag)}
    {range("internationalReputation")}
    {range("learningSpeed")}
    {range("retirementAge")}
    {list(
      "developmentType",
      codeChoices(facets.codes.developmentType, TEXT.codePrefix.developmentType),
    )}
    {list(
      "developmentStyle",
      codeChoices(facets.codes.developmentStyle, TEXT.codePrefix.developmentStyle),
    )}
  </Section>
);

const clubSection = ({ filters, change, facets, range, list, flag }: Kit, career: boolean) => (
  <Section title={FILTER_SECTION_LABELS.club}>
    {list("leagueId", facetChoices(facets.leagues))}
    {list("clubId", facetChoices(facets.clubs))}
    {list("nationalityId", facetChoices(facets.nationalities))}
    {range("clubRating")}
    <ContractField
      years={facets.contractYears}
      range={filters.ranges?.contractEndYear}
      onChange={(next) => {
        change({ ranges: { ...filters.ranges, contractEndYear: next } });
      }}
    />
    {flag("nationalTeam")}
    {career ? <CareerClubFields filters={filters} change={change} /> : null}
  </Section>
);

const careerSection = ({ range, flag }: Kit) => (
  <Section title={FILTER_SECTION_LABELS.career}>
    {range("form")}
    {range("morale")}
    {range("appearances")}
    {range("goals")}
    {range("cupAppearances")}
    {range("cupGoals")}
    {range("injuryDays")}
    {range("price")}
    {range("wage")}
    {flag("transferListed")}
    {flag("loanListed")}
    {flag("loaned")}
    {flag("shortlisted")}
    {flag("clubWillSell")}
  </Section>
);

export const FilterForm = ({
  players,
  collator,
  positionName,
  filters,
  myTeamId,
  showPotential,
  dispatch,
}: FilterFormProps): JSX.Element => {
  const facets = useMemo(
    () => facetOptions(players, filters, collator),
    [players, filters, collator],
  );
  const change: Change = (next) => {
    dispatch({ type: "filters-changed", filters: next });
  };
  const kit: Kit = { ...controls(filters, change), filters, change, facets, positionName };
  return (
    <form className="filter-form" onSubmit={(event) => event.preventDefault()}>
      <label className="check">
        <input
          type="checkbox"
          checked={showPotential}
          onChange={(event) => {
            dispatch({ type: "potential-shown", shown: event.currentTarget.checked });
          }}
        />
        {TEXT.showPotential}
      </label>
      {basicSection(kit, showPotential, myTeamId !== null)}
      {physiqueSection(kit)}
      <Section title={FILTER_SECTION_LABELS.attributes}>
        <AttributeRanges
          ranges={filters.ranges}
          onChange={(name, next) => {
            change({ ranges: { ...filters.ranges, [name]: next } });
          }}
        />
      </Section>
      <Section title={FILTER_SECTION_LABELS.traits}>
        <p className="help">{TEXT.traitsNote}</p>
        {PLAY_TRAITS.map(kit.flag)}
      </Section>
      {characterSection(kit)}
      {clubSection(kit, myTeamId !== null)}
      {myTeamId === null ? null : careerSection(kit)}
      <button
        type="button"
        className="button"
        disabled={activeFilters(filters).length === 0}
        onClick={() => {
          dispatch({ type: "filters-reset" });
        }}
      >
        {TEXT.resetFilters}
      </button>
    </form>
  );
};
