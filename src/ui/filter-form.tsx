import { useMemo, useState } from "react";
import type { Dispatch, JSX } from "react";
import type { CurrencyCode } from "../data/career-save.ts";
import { ATTRIBUTE_KEYS, GROUP_STAT_KEYS, isGroupAverage } from "../logic/attribute-groups.ts";
import type { AttributeKey } from "../logic/attribute-groups.ts";
import type { FlagKey, ListKey, Range, RangeKey } from "../logic/filter-players.ts";
import { ATTRIBUTE_NAMES, SEASON_STAT_KEYS, TRAIT_NAMES } from "../logic/players.ts";
import type { Player, TraitName } from "../logic/players.ts";
import { POSITION_GROUPS } from "../logic/positions.ts";
import { facetOptions } from "../logic/facets.ts";
import type { FacetOption } from "../logic/facets.ts";
import type {
  ClubStatus,
  FilterChange,
  MyClub,
  ScoutAction,
  ScoutFilters,
  ScoutState,
} from "../logic/scout-state.ts";
import {
  ChoiceField,
  FlagField,
  numberOrUndefined,
  RangeField,
  Section,
} from "./filter-fields.tsx";
import { codeName } from "./text-code-names.ts";
import type { CodedKey } from "./text-code-names.ts";
import type { Choice } from "./filter-fields.tsx";
import { PotentialSwitch } from "./filter-panel-controls.tsx";
import { SettingsActions } from "./settings-actions.tsx";
import { FIELD_HELP } from "./text-help.ts";
import { PositionRatingField } from "./position-rating-field.tsx";
import {
  CLUB_STATUS_LABELS,
  MY_CLUB_LABELS,
  FILTER_SECTION_LABELS,
  FLAG_LABELS,
  LIST_LABELS,
  POSITION_GROUP_LABELS,
  TEXT,
} from "./text.ts";
import { rangeLabel } from "./text-range-labels.ts";

interface FilterFormProps {
  readonly players: readonly Player[];
  readonly collator: Intl.Collator;
  /** A position's name to choose it by, in the chosen language (positionNameIn). */
  readonly positionName: (code: number) => string;
  readonly filters: ScoutFilters;
  readonly myTeamId: number | null;
  readonly showPotential: boolean;
  /** The settings "Cofnij" and "Resetuj" act on. */
  readonly settings: Pick<ScoutState, "filters" | "sort" | "showPotential" | "undo">;
  /** The career's currency, shown with the price and the wage; null without a career. */
  readonly currency: CurrencyCode | null;
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
  onChange: (key: AttributeKey, range: Range | undefined) => void;
}) => {
  const [added, setAdded] = useState<readonly AttributeKey[]>([]);
  const shown = ATTRIBUTE_KEYS.filter(
    (name) => added.includes(name) || props.ranges?.[name] !== undefined,
  );
  const unused = (keys: readonly AttributeKey[]) =>
    keys
      .filter((name) => !shown.includes(name))
      .map((name) => (
        <option key={name} value={name}>
          {rangeLabel(name)}
        </option>
      ));
  return (
    <>
      {shown.map((name) => (
        <div key={name} className="attribute-range">
          <RangeField
            label={rangeLabel(name)}
            range={props.ranges?.[name]}
            decimal={isGroupAverage(name)}
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
            aria-label={TEXT.removeAttribute(rangeLabel(name))}
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
            const name = ATTRIBUTE_KEYS.find((item) => item === event.currentTarget.value);
            if (name !== undefined) setAdded([...added, name]);
          }}
        >
          <option value="">{TEXT.chooseAttribute}</option>
          <optgroup label={FILTER_SECTION_LABELS.attributes}>{unused(ATTRIBUTE_NAMES)}</optgroup>
          <optgroup label={TEXT.attributeGroups}>{unused(GROUP_STAT_KEYS)}</optgroup>
        </select>
      </label>
    </>
  );
};

const facetChoices = (options: readonly FacetOption[]): readonly Choice<number>[] =>
  options.map((option) => ({ value: option.id, label: option.name }));

const codeChoices = (codes: readonly number[], key: CodedKey): readonly Choice<number>[] =>
  codes.map((code) => ({ value: code, label: codeName(key, code) }));

/** Ranges of large amounts, typed with grouped digits. */
const GROUPED_RANGES: ReadonlySet<RangeKey> = new Set(["price", "wage"]);

/** Builders for one control of each kind, bound to the current filters. */
const controls = (filters: ScoutFilters, change: Change, currency: CurrencyCode | null) => ({
  range: (key: RangeKey) => (
    <RangeField
      key={key}
      label={TEXT.withCurrency(key, rangeLabel(key), currency)}
      range={filters.ranges?.[key]}
      grouped={GROUPED_RANGES.has(key)}
      decimal={key === "form"}
      help={FIELD_HELP[key]}
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
      help={FIELD_HELP[key]}
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
        peakShown={showPotential && career}
        change={change}
      />
      {showPotential
        ? [
            range("potential"),
            range("growth"),
            ...(career ? [range("peak"), range("peakGain")] : []),
          ]
        : null}
    </Section>
  );
};

const physiqueSection = ({ facets, range, list }: Kit) => (
  <Section title={FILTER_SECTION_LABELS.physique}>
    {range("height")}
    {range("weight")}
    {list("bodyType", codeChoices(facets.codes.bodyType, "bodyType"))}
  </Section>
);

const characterSection = ({ facets, range, list, flag }: Kit) => (
  <Section title={FILTER_SECTION_LABELS.character}>
    {CHARACTER_TRAITS.map(flag)}
    {range("internationalReputation")}
    {range("learningSpeed")}
    {range("retirementAge")}
    {list("developmentType", codeChoices(facets.codes.developmentType, "developmentType"))}
    {list("developmentStyle", codeChoices(facets.codes.developmentStyle, "developmentStyle"))}
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
    {SEASON_STAT_KEYS.map((key) => range(key))}
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
  settings,
  currency,
  dispatch,
}: FilterFormProps): JSX.Element => {
  const facets = useMemo(
    () => facetOptions(players, filters, collator),
    [players, filters, collator],
  );
  const change: Change = (next) => {
    dispatch({ type: "filters-changed", filters: next });
  };
  const kit: Kit = {
    ...controls(filters, change, currency),
    filters,
    change,
    facets,
    positionName,
  };
  return (
    <form className="filter-form" onSubmit={(event) => event.preventDefault()}>
      <PotentialSwitch shown={showPotential} dispatch={dispatch} />
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
      <SettingsActions settings={settings} className="reset-filters" dispatch={dispatch} />
    </form>
  );
};
