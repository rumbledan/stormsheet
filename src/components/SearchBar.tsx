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
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
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
          placeholder="Enter property address (123 Main St, Little Rock)"
          disabled={disabled}
          className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white/[0.12] transition-all text-base"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg shadow-lg shadow-blue-500/20"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        Generate Report
      </button>
    </form>
  );
}
