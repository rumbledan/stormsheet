"use client";

import type { SummaryStats } from "@/lib/types";
import { formatEventDate } from "@/lib/utils";

interface BestClaimDateProps {
  stats: SummaryStats;
}

/**
 * Prominent callout box showing the best claim date.
 * Must be impossible to miss on mobile — this is the single most actionable
 * piece of information on the results screen.
 */
export default function BestClaimDate({ stats }: BestClaimDateProps) {
  const rec = stats.recommendedEvent;

  // Color for days remaining
  const getDaysColor = (days: number | null) => {
    if (!days) return "text-brand-text-secondary";
    if (days < 180) return "text-brand-tornado-red";
    if (days <= 365) return "text-brand-wind-amber";
    return "text-green-500";
  };

  return (
    <div className="bg-brand-bg border-2 border-brand-gold rounded-lg p-4 relative overflow-hidden">
      {/* Subtle gold glow effect */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-brand-gold" />

      <h3 className="text-brand-gold text-xs font-bold uppercase tracking-widest mb-3">
        Your Best Claim Date
      </h3>

      {rec ? (
        <div>
          {/* Date in large text */}
          <p className="text-brand-text-primary text-2xl font-bold">
            {formatEventDate(rec.date)}
          </p>

          {/* Event details */}
          <p className="text-brand-text-secondary text-sm mt-1">
            {rec.magnitude}
            {rec.magnitudeUnit === "inches" ? '"' : " mph"}{" "}
            {rec.type.toLowerCase()} — {rec.distanceFromProperty.toFixed(1)} mi from property
          </p>

          {/* Days remaining */}
          {rec.daysUntilExpired && (
            <p className={`text-lg font-semibold mt-2 ${getDaysColor(rec.daysUntilExpired)}`}>
              {rec.daysUntilExpired} days remaining to file
            </p>
          )}

          {/* Storm cluster confirmation */}
          {rec.stormCluster && (
            <p className="text-brand-gold text-xs italic mt-2">
              Sustained multi-report storm system confirmed
            </p>
          )}
        </div>
      ) : (
        <div>
          <p className="text-brand-text-primary text-base font-semibold">
            No active claim window detected.
          </p>
          <p className="text-brand-text-secondary text-sm mt-1">
            Contact us to review your options.
          </p>
        </div>
      )}
    </div>
  );
}
