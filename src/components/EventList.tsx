"use client";

import type { StormEvent } from "@/lib/types";
import EventCard from "./EventCard";

interface EventListProps {
  events: StormEvent[];
}

/**
 * Grouped event list: URGENT first, then RECENT, then HISTORICAL.
 * Events are already sorted by the orchestrator, so we just group by status.
 */
export default function EventList({ events }: EventListProps) {
  const urgent = events.filter((e) => e.urgencyStatus === "URGENT");
  const recent = events.filter((e) => e.urgencyStatus === "RECENT");
  const historical = events.filter((e) => e.urgencyStatus === "HISTORICAL");

  return (
    <div className="space-y-4">
      {urgent.length > 0 && (
        <EventGroup
          title="Urgent — Within Filing Window"
          titleColor="text-brand-gold"
          events={urgent}
        />
      )}
      {recent.length > 0 && (
        <EventGroup
          title="Recent — 1-2 Years Ago"
          titleColor="text-brand-hail-blue"
          events={recent}
        />
      )}
      {historical.length > 0 && (
        <EventGroup
          title="Historical — 2-5 Years Ago"
          titleColor="text-brand-text-secondary"
          events={historical}
        />
      )}
      {events.length === 0 && (
        <div className="text-center py-8 text-brand-text-secondary">
          <p className="text-lg">No storm events found</p>
          <p className="text-sm mt-1">
            No NOAA-documented severe weather events within 2 miles of this property in the past 5 years.
          </p>
        </div>
      )}
    </div>
  );
}

function EventGroup({
  title,
  titleColor,
  events,
}: {
  title: string;
  titleColor: string;
  events: StormEvent[];
}) {
  return (
    <div>
      <h3 className={`text-sm font-semibold uppercase tracking-wider mb-2 ${titleColor}`}>
        {title} ({events.length})
      </h3>
      <div className="space-y-2">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
