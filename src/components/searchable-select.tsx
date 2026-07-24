"use client";

import { useId, useMemo, useState } from "react";

type SearchOption = { value: string; label: string; details?: string };

export function SearchableSelect({
  name,
  label,
  options,
  placeholder = "Choose an option",
  searchPlaceholder = "Search…",
  required = true,
  help,
}: {
  name: string;
  label: string;
  options: SearchOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  help?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [value, setValue] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => `${option.label} ${option.details ?? ""}`.toLowerCase().includes(term));
  }, [options, query]);
  const visible = value && !filtered.some((option) => option.value === value)
    ? [...options.filter((option) => option.value === value), ...filtered]
    : filtered;

  return (
    <fieldset className="searchable-select">
      <legend>{label}</legend>
      {help && <small>{help}</small>}
      <input
        aria-label={`Search ${label}`}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        type="search"
        value={query}
      />
      <select aria-label={label} id={id} name={name} onChange={(event) => setValue(event.target.value)} required={required} value={value}>
        <option value="">{options.length ? placeholder : "No eligible options"}</option>
        {visible.map((option) => <option key={option.value} value={option.value}>{option.label}{option.details ? ` · ${option.details}` : ""}</option>)}
      </select>
      {query && filtered.length === 0 && <span>No matches. Try another name.</span>}
    </fieldset>
  );
}
