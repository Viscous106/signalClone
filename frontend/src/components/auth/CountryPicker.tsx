"use client";

import { useState } from "react";

import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import { type Country, flagFor, searchCountries } from "@/lib/countries";

type Props = {
  onPick: (country: Country) => void;
  onClose: () => void;
};

/** Full-screen list, the way Signal's "Your country" screen works. */
export function CountryPicker({ onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  const results = searchCountries(query);
  // The first five are Signal's common block; a hairline follows them.
  const commonCount = query.trim() ? 0 : 5;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      <header className="flex h-header shrink-0 items-center gap-4 px-4">
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-label hover:bg-surface-2"
        >
          <CloseIcon />
        </button>
        <h2 className="text-title2 text-label">Your country</h2>
      </header>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2.5">
          <SearchIcon className="h-4 w-4 shrink-0 text-label-2" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or number"
            aria-label="Search by name or number"
            className="w-full bg-transparent text-body1 text-label outline-none placeholder:text-label-2"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {results.length === 0 ? (
          <p className="px-6 py-10 text-center text-body2 text-label-2">No countries found.</p>
        ) : (
          results.map((country, index) => (
            <div key={country.code}>
              {index === commonCount && commonCount > 0 && (
                <div className="mx-4 my-2 border-t border-edge" />
              )}
              <button
                onClick={() => onPick(country)}
                className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-surface-2"
              >
                <span aria-hidden="true" className="text-title2 leading-none">
                  {flagFor(country.code)}
                </span>
                <span data-testid="country-name" className="min-w-0 flex-1 truncate text-body1 text-label">
                  {country.name}
                </span>
                <span className="shrink-0 text-body1 text-label-2">{country.dial}</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
