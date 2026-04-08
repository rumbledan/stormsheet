import { NextRequest, NextResponse } from "next/server";
import { buildSummaryStats, pickRecommendedEvent } from "@/lib/utils";
import { fetchSwdiData, fetchStormEventsData, fetchNwsAlertsData } from "@/lib/noaa";
import type { StormEvent, SearchResult } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { lat, lng, countyFips, nwsZoneCode, state, address } = await request.json();

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
    }

    console.log("[storms] Starting parallel fan-out for", address || `${lat},${lng}`);
    const t0 = Date.now();

    // Fan out to all three data sources in parallel (direct function calls, no HTTP self-calls)
    // NWS alerts uses the NWS zone code (e.g., ARC125), not numeric FIPS
    const [swdiResult, stormEventsResult, nwsResult] = await Promise.allSettled([
      fetchSwdiData(lat, lng),
      fetchStormEventsData(lat, lng, state || ""),
      fetchNwsAlertsData(nwsZoneCode || countyFips || "", lat, lng),
    ]);

    // Collect events from each source (gracefully handle failures)
    let allEvents: StormEvent[] = [];

    if (swdiResult.status === "fulfilled") {
      console.log(`[storms] SWDI: ${swdiResult.value.length} events`);
      allEvents = allEvents.concat(swdiResult.value);
    } else {
      console.error("[storms] SWDI failed:", swdiResult.reason);
    }

    if (stormEventsResult.status === "fulfilled") {
      console.log(`[storms] Storm Events: ${stormEventsResult.value.length} events`);
      allEvents = allEvents.concat(stormEventsResult.value);
    } else {
      console.error("[storms] Storm Events failed:", stormEventsResult.reason);
    }

    if (nwsResult.status === "fulfilled") {
      console.log(`[storms] NWS Alerts: ${nwsResult.value.length} events`);
      allEvents = allEvents.concat(nwsResult.value);
    } else {
      console.error("[storms] NWS Alerts failed:", nwsResult.reason);
    }

    console.log(`[storms] Total raw events: ${allEvents.length} (fetched in ${Date.now() - t0}ms)`);

    // Cross-reference: mark events as corroborated if multiple sources
    // report events on the same date (within same day)
    const dateMap = new Map<string, StormEvent[]>();
    for (const event of allEvents) {
      const dateKey = event.date.split("T")[0]; // YYYY-MM-DD
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
      dateMap.get(dateKey)!.push(event);
    }
    let corroboratedCount = 0;
    for (const [, eventsOnDate] of dateMap) {
      if (eventsOnDate.length > 1) {
        const sources = new Set(eventsOnDate.map((e) => e.source));
        if (sources.size > 1) {
          eventsOnDate.forEach((e) => (e.corroborated = true));
          corroboratedCount += eventsOnDate.length;
        }
      }
    }
    console.log(`[storms] Corroborated events: ${corroboratedCount}`);

    // Build summary stats (this also runs detectStormClusters internally)
    const summaryStats = buildSummaryStats(allEvents, new Date().toISOString());

    // Mark recommended event
    const recommended = pickRecommendedEvent(allEvents);
    if (recommended) {
      const idx = allEvents.findIndex((e) => e.id === recommended.id);
      if (idx >= 0) allEvents[idx].isRecommended = true;
      console.log(`[storms] Recommended event: ${recommended.id} (${recommended.magnitude}${recommended.magnitudeUnit === "inches" ? '"' : ' mph'} on ${recommended.date.split("T")[0]})`);
    }

    // Sort: URGENT first, then RECENT, then HISTORICAL. Within group: date desc.
    const urgencyOrder = { URGENT: 0, RECENT: 1, HISTORICAL: 2 };
    allEvents.sort((a, b) => {
      const urgDiff = urgencyOrder[a.urgencyStatus] - urgencyOrder[b.urgencyStatus];
      if (urgDiff !== 0) return urgDiff;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const searchResult: SearchResult = {
      address: address || "",
      lat,
      lng,
      countyName: allEvents.find((e) => e.countyName)?.countyName || "",
      countyFips: countyFips || "",
      state: state || "",
      events: allEvents,
      summaryStats,
      searchedAt: new Date().toISOString(),
    };

    console.log(`[storms] Final result: ${allEvents.length} events, ${summaryStats.urgentEvents} urgent, ${summaryStats.clusteredStormDates.length} cluster dates. Total time: ${Date.now() - t0}ms`);

    return NextResponse.json(searchResult);
  } catch (error) {
    console.error("[storms] Orchestrator error:", error);
    return NextResponse.json({ error: "Failed to fetch storm data" }, { status: 500 });
  }
}
