import { useId, useMemo } from "react";
import type { Dispatch, JSX } from "react";
import type { CurrencyCode } from "../data/career-save.ts";
import { CLUB_STATUSES, LIST_MEMBERSHIPS, needsShortlist } from "../logic/filter-players.ts";
import type { FlagKey, ListKey, ListMembership, RangeKey } from "../logic/filter-players.ts";
import { SEASON_STAT_KEYS, TRAIT_NAMES } from "../logic/players.ts";
import type { Player, TraitName } from "../logic/players.ts";
import { POSITION_GROUPS } from "../logic/positions.ts";
import type { SortKey } from "../logic/sort-players.ts";
import { facetOptions } from "../logic/facets.ts";
import type { FacetOption } from "../logic/facets.ts";
import type { FilterChange, MyClub, ScoutAction, ScoutFilters } from "../logic/scout-state.ts";
import { CheckField, ChoiceField, FlagField, RangeField, Section } from "./filter-fields.tsx";
import { AttributeRanges, ContractField } from "./filter-field-groups.tsx";
import type { Eye } from "./column-eye.tsx";
import { OptionalHelp } from "./field-help.tsx";
import { codeName } from "./text-code-names.ts";
import type { CodedKey } from "./text-code-names.ts";
import type { Choice } from "./filter-fields.tsx";
import { PotentialSwitch } from "./filter-panel-controls.tsx";
import { SettingsActions } from "./settings-actions.tsx";
import type { Settings } from "./settings-actions.tsx";
import { FIELD_HELP, HELP_TEXT } from "./text-help.ts";
import { PositionRatingField } from "./position-rating-field.tsx";
import {
  FILTER_SECTION_LABELS,
  FLAG_LABELS,
  LIST_LABELS,
  POSITION_GROUP_LABELS,
  rangeLabel,
  TEXT,
} from "./text.ts";
import { CLUB_STATUS_LABELS, LIST_MEMBERSHIP_LABELS, MY_CLUB_LABELS } from "./text-choices.ts";

interface FilterFormProps {
  readonly players: readonly Player[];
  readonly collator: Intl.Collator;
  /** A position's name to choose it by, in the chosen language (positionNameIn). */
  readonly positionName: (code: number) => string;
  readonly filters: ScoutFilters;
  readonly myTeamId: number | null;
  readonly showPotential: boolean;
  /** The settings "Cofnij" and "Resetuj" act on. */
  readonly settings: Settings;
  /** The career's currency, shown with the price and the wage; null without a career. */
  readonly currency: CurrencyCode | null;
  /** The columns the list shows: each filter's eye is open while its column is among them. */
  readonly columns: readonly SortKey[];
  /** The columns shown without the user's choice, which an eye's change that agrees with it undoes. */
  readonly automaticColumns: readonly SortKey[];
  readonly dispatch: Dispatch<ScoutAction>;
}

type Change = (filters: FilterChange) => void;

/** The eyes of the filters, open for the columns the list shows. */
const columnEye =
  (
    columns: readonly SortKey[],
    automatic: readonly SortKey[],
    dispatch: Dispatch<ScoutAction>,
  ): Eye =>
  (key) => {
    if (key === undefined) return undefined;
    const visible = columns.includes(key);
    return {
      visible,
      onToggle: () => {
        dispatch({
          type: "column-shown",
          key,
          shown: !visible,
          automatic: automatic.includes(key),
        });
      },
    };
  };

/** The list column of each list filter whose value it shows. */
const LIST_COLUMNS: Readonly<Partial<Record<ListKey, SortKey>>> = {
  positionCode: "positionCode",
  leagueId: "leagueName",
  clubId: "clubName",
  nationalityId: "nationalityName",
};

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

/** "Any" stands for an unset list choice. */
const LIST_OPTIONS: readonly ("any" | ListMembership)[] = ["any", ...LIST_MEMBERSHIPS];

/** "All" stands for an unset my-club filter. */
const MY_CLUB_OPTIONS: readonly ("all" | MyClub)[] = ["all", "hide", "only"];

/** One choice of a few, as radio buttons; the group takes its name from the legend's text alone. */
const RadioField = <T extends string>(props: {
  readonly legend: string;
  readonly help?: string;
  readonly name: string;
  readonly options: readonly T[];
  readonly labels: Readonly<Record<T, string>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
}) => {
  const legendId = useId();
  return (
    <fieldset className="field" aria-labelledby={legendId}>
      <legend className="field-legend">
        <span id={legendId}>{props.legend}</span>
        <OptionalHelp label={props.legend} help={props.help} />
      </legend>
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
};

/** Shown with a career: fifa.db has no free agents and no club of the user's. */
const CareerClubFields = ({ filters, change }: { filters: ScoutFilters; change: Change }) => (
  <>
    <RadioField
      legend={TEXT.clubStatus}
      help={HELP_TEXT.clubStatus}
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

/** The list choice; without a career there is no game shortlist, so only the own list's options. */
const OnListField = (props: { filters: ScoutFilters; change: Change; career: boolean }) => (
  <RadioField
    legend={TEXT.onList}
    help={HELP_TEXT.onList}
    name="on-list"
    options={props.career ? LIST_OPTIONS : LIST_OPTIONS.filter((option) => !needsShortlist(option))}
    labels={LIST_MEMBERSHIP_LABELS}
    value={props.filters.onList ?? "any"}
    onChange={(option) => {
      props.change({ onList: option === "any" ? undefined : option });
    }}
  />
);

const facetChoices = (options: readonly FacetOption[]): readonly Choice<number>[] =>
  options.map((option) => ({ value: option.id, label: option.name }));

const codeChoices = (codes: readonly number[], key: CodedKey): readonly Choice<number>[] =>
  codes.map((code) => ({ value: code, label: codeName(key, code) }));

/** Ranges of large amounts, typed with grouped digits. */
const GROUPED_RANGES: ReadonlySet<RangeKey> = new Set(["price", "wage"]);

/** Builders for one control of each kind, bound to the current filters. */
const controls = (
  filters: ScoutFilters,
  change: Change,
  currency: CurrencyCode | null,
  eye: Eye,
) => ({
  range: (key: RangeKey) => (
    <RangeField
      key={key}
      label={TEXT.withCurrency(key, rangeLabel(key), currency)}
      range={filters.ranges?.[key]}
      grouped={GROUPED_RANGES.has(key)}
      decimal={key === "form"}
      help={FIELD_HELP[key]}
      column={eye(key)}
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
      column={eye(LIST_COLUMNS[key])}
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
      help={FIELD_HELP[key]}
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
  readonly eye: Eye;
  readonly positionName: (code: number) => string;
};

/** The peak OVR, with the choice of counting it at the best position, and the growth left to it. */
const peakFields = ({ filters, change, range }: Kit) => [
  range("peak"),
  <CheckField
    key="peakAtBest"
    label={TEXT.peakAtBest}
    checked={filters.peakAtBest === true}
    help={HELP_TEXT.peakAtBest}
    onChange={(peakAtBest) => {
      change({ peakAtBest });
    }}
  />,
  range("peakGain"),
];

/** career: the peak OVR exists only with a career save. */
const basicSection = (kit: Kit, showPotential: boolean, career: boolean) => {
  const { filters, change, facets, range, list, positionName, eye } = kit;
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
        eye={eye}
        change={change}
      />
      {showPotential
        ? [range("potential"), range("growth"), ...(career ? peakFields(kit) : [])]
        : null}
      <OnListField filters={filters} change={change} career={career} />
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

const clubSection = ({ filters, change, facets, range, list, flag, eye }: Kit, career: boolean) => (
  <Section title={FILTER_SECTION_LABELS.club}>
    {list("leagueId", facetChoices(facets.leagues))}
    {list("clubId", facetChoices(facets.clubs))}
    {list("nationalityId", facetChoices(facets.nationalities))}
    {range("clubRating")}
    <ContractField
      years={facets.contractYears}
      range={filters.ranges?.contractEndYear}
      column={eye("contractEndYear")}
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
  columns,
  automaticColumns,
  dispatch,
}: FilterFormProps): JSX.Element => {
  const facets = useMemo(
    () => facetOptions(players, filters, collator),
    [players, filters, collator],
  );
  const change: Change = (next) => {
    dispatch({ type: "filters-changed", filters: next });
  };
  const eye = columnEye(columns, automaticColumns, dispatch);
  const kit: Kit = {
    ...controls(filters, change, currency, eye),
    filters,
    change,
    facets,
    eye,
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
          eye={kit.eye}
          onChange={(name, next) => {
            change({ ranges: { ...filters.ranges, [name]: next } });
          }}
        />
      </Section>
      <Section title={FILTER_SECTION_LABELS.traits} help={TEXT.traitsNote}>
        {PLAY_TRAITS.map(kit.flag)}
      </Section>
      {characterSection(kit)}
      {clubSection(kit, myTeamId !== null)}
      {myTeamId === null ? null : careerSection(kit)}
      <SettingsActions settings={settings} className="reset-filters" dispatch={dispatch} />
    </form>
  );
};
