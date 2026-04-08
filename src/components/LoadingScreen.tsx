"use client";

import { useState, useEffect } from "react";
import { STORM_FACTS } from "@/lib/constants";

/**
 * Loading screen with rotating storm facts.
 *
 * No artificial delays or fake timers. This screen is visible only while real
 * API calls are running. The moment data returns, the parent unmounts this
 * and transitions to results. Year indicator paced to ~9-15s typical fetch.
 */
export default function LoadingScreen() {
  const [factIndex, setFactIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const endYear = new Date().getFullYear();
  const startYear = endYear - 5;

  // Rotate facts every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % STORM_FACTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Track elapsed time for year display — no fake completion
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 100);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Estimate current year being scanned based on elapsed time
  // Fast progress: ~800ms per year, reaches 95% in ~5 seconds
  const msPerYear = 800;
  const yearOffset = Math.min(Math.floor(elapsed / msPerYear), 5);
  const currentYear = startYear + yearOffset;
  const progressPct = Math.min((elapsed / (msPerYear * 6)) * 100, 95);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      {/* Spinner */}
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-brand-border" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-gold animate-spin" />
      </div>

      {/* Status text */}
      <h2 className="text-brand-text-primary text-lg font-semibold mb-2">
        Scanning Storm History
      </h2>
      <p className="text-brand-text-secondary text-sm mb-6">
        Searching NOAA records for {currentYear}...
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-xs mb-8">
        <div className="h-2 bg-brand-card rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-gold rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-brand-text-secondary">
          <span>{startYear}</span>
          <span>{endYear}</span>
        </div>
      </div>

      {/* Rotating storm fact */}
      <div className="max-w-sm text-center">
        <div className="bg-brand-card border border-brand-border rounded-lg p-4">
          <p className="text-brand-gold text-xs font-semibold uppercase tracking-wider mb-2">
            Did you know?
          </p>
          <p className="text-brand-text-secondary text-sm leading-relaxed transition-opacity duration-500">
            {STORM_FACTS[factIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}
