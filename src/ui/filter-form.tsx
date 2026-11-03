import { useMemo } from "react";
import type { Dispatch, JSX } from "react";
import type { Player } from "../logic/players.ts";
import { POSITION_GROUPS } from "../logic/positions.ts";
import { activeFilterKeys, facetOptions } from "../logic/scout-state.ts";
import type {
  ClubStatus,
  FacetOption,
  FilterChange,
  ScoutAction,
  ScoutFilters,
} from "../logic/scout-state.ts";
import { CLUB_STATUS_LABELS, FILTER_LABELS, POSITION_GROUP_LABELS, TEXT } from "./text.ts";

interface FilterFormProps {
  readonly players: readonly Player[];
  readonly filters: ScoutFilters;
  readonly myTeamId: number | null;
  readonly dispatch: Dispatch<ScoutAction>;
}

type Change = (filters: FilterChange) => void;
type RangeKey = "age" | "potential" | "overall";
type IdsKey = "leagueIds" | "teamIds" | "nationalityIds";

const numberOrUndefined = (text: string): number | undefined =>
  text.trim() === "" || Number.isNaN(Number(text)) ? undefined : Number(text);

const RangeField = ({
  name,
  filters,
  change,
}: {
  name: RangeKey;
  filters: ScoutFilters;
  change: Change;
}) => {
  const range = filters[name] ?? {};
  const input = (bound: "min" | "max") => (
    <label className="range-input">
      <span>{TEXT[bound]}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={range[bound] ?? ""}
        onChange={(event) => {
          change({ [name]: { ...range, [bound]: numberOrUndefined(event.currentTarget.value) } });
        }}
      />
    </label>
  );
  return (
    <fieldset className="field">
      <legend>{FILTER_LABELS[name]}</legend>
      <div className="range">
        {input("min")}
        {input("max")}
      </div>
    </fieldset>
  );
};

const SelectField = (props: {
  name: IdsKey;
  options: readonly FacetOption[];
  filters: ScoutFilters;
  change: Change;
}) => {
  const { name, options, filters, change } = props;
  return (
    <label className="field">
      <span>{FILTER_LABELS[name]}</span>
      <select
        value={filters[name]?.[0] ?? ""}
        onChange={(event) => {
          const id = numberOrUndefined(event.currentTarget.value);
          change({ [name]: id === undefined ? [] : [id] });
        }}
      >
        <option value="">{name === "teamIds" ? TEXT.anyClub : TEXT.anyOption}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
};

const PositionsField = ({ filters, change }: { filters: ScoutFilters; change: Change }) => {
  const chosen = filters.positionGroups ?? [];
  return (
    <fieldset className="field">
      <legend>{FILTER_LABELS.positionGroups}</legend>
      {POSITION_GROUPS.map((group) => (
        <label key={group} className="check">
          <input
            type="checkbox"
            checked={chosen.includes(group)}
            onChange={(event) => {
              const on = event.currentTarget.checked;
              change({
                positionGroups: on ? [...chosen, group] : chosen.filter((item) => item !== group),
              });
            }}
          />
          {POSITION_GROUP_LABELS[group]}
        </label>
      ))}
    </fieldset>
  );
};

const CLUB_STATUSES: readonly ClubStatus[] = ["with-club", "all", "free-agents"];

/** One control for the three club states, so "free agents" and "hide clubless" cannot contradict. */
const ClubStatusField = ({ filters, change }: { filters: ScoutFilters; change: Change }) => (
  <fieldset className="field">
    <legend>{FILTER_LABELS.clubStatus}</legend>
    {CLUB_STATUSES.map((status) => (
      <label key={status} className="check">
        <input
          type="radio"
          name="club-status"
          checked={(filters.clubStatus ?? "with-club") === status}
          onChange={() => {
            change({ clubStatus: status });
          }}
        />
        {CLUB_STATUS_LABELS[status]}
      </label>
    ))}
  </fieldset>
);

const CheckField = (props: { name: "excludeMyClub"; filters: ScoutFilters; change: Change }) => (
  <label className="check">
    <input
      type="checkbox"
      checked={props.filters[props.name] === true}
      onChange={(event) => {
        props.change({ [props.name]: event.currentTarget.checked });
      }}
    />
    {FILTER_LABELS[props.name]}
  </label>
);

const ContractField = ({
  years,
  filters,
  change,
}: {
  years: readonly number[];
  filters: ScoutFilters;
  change: Change;
}) => (
  <label className="field">
    <span>{TEXT.contractEndsBy}</span>
    <select
      value={filters.contractEndsBy ?? ""}
      onChange={(event) => {
        change({ contractEndsBy: numberOrUndefined(event.currentTarget.value) });
      }}
    >
      <option value="">{TEXT.anyOption}</option>
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  </label>
);

export const FilterForm = ({
  players,
  filters,
  myTeamId,
  dispatch,
}: FilterFormProps): JSX.Element => {
  const facets = useMemo(() => facetOptions(players, filters), [players, filters]);
  const change: Change = (next) => {
    dispatch({ type: "filters-changed", filters: next });
  };
  const shared = { filters, change };
  return (
    <form className="filter-form" onSubmit={(event) => event.preventDefault()}>
      <label className="field">
        <span>{FILTER_LABELS.text}</span>
        <input
          type="search"
          value={filters.text ?? ""}
          onChange={(event) => {
            change({ text: event.currentTarget.value });
          }}
        />
      </label>
      <PositionsField {...shared} />
      <RangeField name="age" {...shared} />
      <RangeField name="overall" {...shared} />
      <RangeField name="potential" {...shared} />
      <SelectField name="leagueIds" options={facets.leagues} {...shared} />
      <SelectField name="teamIds" options={facets.clubs} {...shared} />
      <SelectField name="nationalityIds" options={facets.nationalities} {...shared} />
      <ContractField years={facets.contractYears} {...shared} />
      <ClubStatusField {...shared} />
      {myTeamId === null ? null : <CheckField name="excludeMyClub" {...shared} />}
      <button
        type="button"
        className="button"
        disabled={activeFilterKeys(filters).length === 0}
        onClick={() => {
          dispatch({ type: "filters-reset" });
        }}
      >
        {TEXT.resetFilters}
      </button>
    </form>
  );
};

export const FilterChips = (props: {
  filters: ScoutFilters;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element | null => {
  const keys = activeFilterKeys(props.filters);
  if (keys.length === 0) return null;
  return (
    <ul className="chips" aria-label={TEXT.activeFilters}>
      {keys.map((key) => (
        <li key={key}>
          <button
            type="button"
            className="chip"
            aria-label={TEXT.removeFilter(FILTER_LABELS[key])}
            onClick={() => {
              props.dispatch({ type: "filter-removed", key });
            }}
          >
            {FILTER_LABELS[key]}
            <span aria-hidden="true">{TEXT.removeMark}</span>
          </button>
        </li>
      ))}
    </ul>
  );
};
