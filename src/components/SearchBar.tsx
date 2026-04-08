"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface SearchBarProps {
  onSearch: (address: string) => void;
  disabled?: boolean;
}

export default function SearchBar({ onSearch, disabled }: SearchBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (value.trim() && !disabled) {
        onSearch(value.trim());
      }
    },
    [value, disabled, onSearch]
  );

  useEffect(() => {
    if (!inputRef.current || !window.google?.maps?.places) return;

    // Decision: Restrict to US addresses with Arkansas bias per spec.
    // componentRestrictions limits results to US only.
    // bounds biases toward Arkansas but doesn't hard-restrict.
    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      bounds: new google.maps.LatLngBounds(
        { lat: 33.0, lng: -94.6 }, // SW corner of Arkansas
        { lat: 36.5, lng: -89.6 }  // NE corner of Arkansas
      ),
    });

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (place?.formatted_address) {
        setValue(place.formatted_address);
        onSearch(place.formatted_address);
      }
    });
  }, [onSearch]);

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter property address"
            disabled={disabled}
            className="w-full pl-10 pr-4 py-3 bg-brand-card border border-brand-border rounded-lg text-brand-text-primary placeholder-brand-text-secondary focus:outline-none focus:border-brand-gold transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="px-6 py-3 bg-brand-gold hover:bg-brand-gold-hover text-brand-bg font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search
        </button>
      </div>
    </form>
  );
}
