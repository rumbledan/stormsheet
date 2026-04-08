"use client";

import type { StormEvent } from "@/lib/types";
import { formatEventDate } from "@/lib/utils";

interface EventCardProps {
  event: StormEvent;
}

export default function EventCard({ event }: EventCardProps) {
  const typeColor =
    event.type === "HAIL"
      ? "text-brand-hail-blue"
      : event.type === "WIND"
        ? "text-brand-wind-amber"
        : event.type === "TORNADO"
          ? "text-brand-tornado-red"
          : "text-brand-text-secondary";

  const typeBgColor =
    event.type === "HAIL"
      ? "bg-brand-hail-blue/10 border-brand-hail-blue/30"
      : event.type === "WIND"
        ? "bg-brand-wind-amber/10 border-brand-wind-amber/30"
        : event.type === "TORNADO"
          ? "bg-brand-tornado-red/10 border-brand-tornado-red/30"
          : "bg-brand-card border-brand-border";

  const urgencyBadge =
    event.urgencyStatus === "URGENT"
      ? "bg-brand-gold/20 text-brand-gold border-brand-gold/40"
      : event.urgencyStatus === "RECENT"
        ? "bg-brand-hail-blue/20 text-brand-hail-blue border-brand-hail-blue/40"
        : "bg-brand-card text-brand-text-secondary border-brand-border";

  return (
    <div className={`border rounded-lg p-3 ${typeBgColor}`}>
      {/* Top row: date + urgency badge */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-brand-text-primary text-sm font-semibold">
          {formatEventDate(event.date)}
        </span>
        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${urgencyBadge}`}>
          {event.urgencyStatus}
          {event.daysUntilExpired && event.urgencyStatus === "URGENT" && (
            <>{" \u2022 "}{event.daysUntilExpired}d left</>
          )}
        </span>
      </div>

      {/* Type + magnitude row */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-bold uppercase ${typeColor}`}>{event.type}</span>
        {event.magnitude && (
          <span className="text-brand-text-primary text-sm font-medium">
            {event.magnitude}
            {event.magnitudeUnit === "inches" ? '"' : " mph"}
          </span>
        )}
        {event.severityLabel && (
          <span className="text-brand-text-secondary text-xs">
            ({event.severityLabel === "Minor" ? "Impacted" : event.severityLabel})
          </span>
        )}
      </div>

      {/* Details row */}
      <div className="flex items-center gap-3 text-xs text-brand-text-secondary">
        <span>{event.distanceFromProperty.toFixed(1)} mi</span>
        <span>{event.source}</span>
        {event.radarStation && <span>Radar: {event.radarStation}</span>}
        {event.countyName && <span>{event.countyName} Co.</span>}
        {event.corroborated && (
          <span className="text-brand-gold" title="Confirmed by multiple data sources">
            Corroborated
          </span>
        )}
      </div>

      {/* Storm cluster badge */}
      {event.stormCluster && (
        <p className="text-brand-gold text-xs italic mt-1.5">
          Part of a multi-report storm system — sustained impact likely
        </p>
      )}

      {/* Recommended badge */}
      {event.isRecommended && (
        <div className="mt-2 bg-brand-gold/20 border border-brand-gold/40 rounded px-2 py-1">
          <span className="text-brand-gold text-xs font-semibold">
            {"\u2605"} RECOMMENDED CLAIM DATE
          </span>
        </div>
      )}
    </div>
  );
}
