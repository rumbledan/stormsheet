"use client";

import type { SummaryStats } from "@/lib/types";
import { buildHeroStatement } from "@/lib/constants";

interface ResultsSummaryProps {
  address: string;
  stats: SummaryStats;
}

export default function ResultsSummary({ address, stats }: ResultsSummaryProps) {
  const heroText = buildHeroStatement(address, stats);

  return (
    <div className="space-y-4">
      {/* Hero statement */}
      <div className="bg-brand-card border border-brand-gold/30 rounded-lg p-4">
        {heroText.split("\n\n").map((paragraph, i) => (
          <p
            key={i}
            className="text-brand-gold text-sm font-medium leading-relaxed"
            style={{ marginTop: i > 0 ? "0.75rem" : 0 }}
          >
            {paragraph}
          </p>
        ))}
      </div>

      {/* Stats badges */}
      <div className="flex flex-wrap gap-2">
        <StatBadge
          label="Total Events"
          value={stats.totalEvents}
          color="text-brand-text-primary"
        />
        {stats.hailEvents > 0 && (
          <StatBadge label="Hail" value={stats.hailEvents} color="text-brand-hail-blue" />
        )}
        {stats.windEvents > 0 && (
          <StatBadge label="Wind" value={stats.windEvents} color="text-brand-wind-amber" />
        )}
        {stats.tornadoEvents > 0 && (
          <StatBadge label="Tornado" value={stats.tornadoEvents} color="text-brand-tornado-red" />
        )}
        {stats.urgentEvents > 0 && (
          <StatBadge label="Urgent" value={stats.urgentEvents} color="text-brand-gold" />
        )}
        {stats.recentEvents > 0 && (
          <StatBadge label="Recent" value={stats.recentEvents} color="text-brand-hail-blue" />
        )}
      </div>

      {/* Recommended event callout */}
      {stats.recommendedEvent && (
        <div className="bg-brand-gold/10 border border-brand-gold/40 rounded-lg p-3">
          <p className="text-brand-gold text-xs font-semibold uppercase tracking-wider mb-1">
            Recommended Claim Date
          </p>
          <p className="text-brand-text-primary text-sm font-medium">
            {new Date(stats.recommendedEvent.date).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {" \u2014 "}
            {stats.recommendedEvent.magnitude}
            {stats.recommendedEvent.magnitudeUnit === "inches" ? '"' : " mph"}{" "}
            {stats.recommendedEvent.type.toLowerCase()}
            {stats.recommendedEvent.daysUntilExpired && (
              <span className="text-brand-gold ml-2">
                ({stats.recommendedEvent.daysUntilExpired} days until filing deadline)
              </span>
            )}
          </p>
        </div>
      )}

      {/* Cluster info */}
      {stats.clusteredStormDates.length > 0 && (
        <p className="text-brand-text-secondary text-xs italic">
          {stats.clusteredStormDates.length} sustained storm system{stats.clusteredStormDates.length > 1 ? "s" : ""} detected with multiple verified impact points
        </p>
      )}
    </div>
  );
}

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-lg px-3 py-1.5 flex items-center gap-1.5">
      <span className={`text-lg font-bold ${color}`}>{value}</span>
      <span className="text-brand-text-secondary text-xs">{label}</span>
    </div>
  );
}
