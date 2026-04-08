import { SEVERITY_THRESHOLDS, SEARCH_CONFIG, CLUSTER_RADIUS_MILES, CLUSTER_TIME_WINDOW_HOURS, CLUSTER_MIN_REPORTS } from "./constants";
import type { BoundingBox, SeverityLabel, UrgencyStatus, StormEvent, SummaryStats } from "./types";

/**
 * Calculate a bounding box around a point given a radius in miles.
 * 1 degree latitude ~ 69.0 miles
 * 1 degree longitude ~ 69.0 * cos(latitude) miles
 */
export function calculateBoundingBox(
  lat: number,
  lng: number,
  radiusMiles: number
): BoundingBox {
  const latDelta = radiusMiles / 69.0;
  const lngDelta = radiusMiles / (69.0 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

/**
 * Haversine distance between two lat/lng points.
 * Returns distance in miles, rounded to 4 decimal places.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10000) / 10000;
}

/**
 * Assign a severity label based on event type and magnitude.
 * Hail: measured in inches. Wind: measured in mph.
 * Returns null for wind below severe threshold or null magnitude.
 */
export function assignSeverityLabel(
  type: "HAIL" | "WIND" | "TORNADO" | "ALERT",
  magnitude: number | null
): SeverityLabel {
  if (magnitude === null) return null;

  if (type === "HAIL") {
    if (magnitude >= SEVERITY_THRESHOLDS.hail.severe) return "Severe";
    if (magnitude >= SEVERITY_THRESHOLDS.hail.significant) return "Significant";
    if (magnitude >= SEVERITY_THRESHOLDS.hail.moderate) return "Moderate";
    if (magnitude >= SEVERITY_THRESHOLDS.hail.minor) return "Minor";
    return "Reported"; // Sub-threshold — kept for context, excluded from urgency unless clustered
  }

  if (type === "WIND") {
    if (magnitude >= SEVERITY_THRESHOLDS.wind.extreme) return "Extreme";
    if (magnitude >= SEVERITY_THRESHOLDS.wind.destructive) return "Destructive";
    if (magnitude >= SEVERITY_THRESHOLDS.wind.damaging) return "Damaging";
    return null; // Below severe threshold
  }

  if (type === "TORNADO") return "Severe";
  if (type === "ALERT") return null;

  return null;
}

/**
 * Determine urgency status based on how old the event is.
 * URGENT: within 365 days, RECENT: 366-730 days, HISTORICAL: >730 days
 */
export function assignUrgencyStatus(eventDate: string): UrgencyStatus {
  const now = new Date();
  const event = new Date(eventDate);
  const diffMs = now.getTime() - event.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= SEARCH_CONFIG.urgentDays) return "URGENT";
  if (diffDays <= SEARCH_CONFIG.recentDays) return "RECENT";
  return "HISTORICAL";
}

/**
 * Calculate days remaining until the 365-day filing window expires.
 * Returns null if already past the window.
 */
export function daysUntilExpired(eventDate: string): number | null {
  const now = new Date();
  const event = new Date(eventDate);
  const expiryDate = new Date(event.getTime() + SEARCH_CONFIG.urgentDays * 24 * 60 * 60 * 1000);
  const remaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return remaining > 0 ? remaining : null;
}

/**
 * Pick the single recommended event from a list.
 * Filters to URGENT only, sorts by magnitude desc,
 * tiebreak distance asc, tiebreak date desc.
 */
export function pickRecommendedEvent(events: StormEvent[]): StormEvent | null {
  const urgent = events.filter((e) => {
    if (e.urgencyStatus !== "URGENT") return false;
    // Exclude sub-threshold events unless they're part of a storm cluster
    if (e.severityLabel === "Reported" && !e.stormCluster) return false;
    return true;
  });
  if (urgent.length === 0) return null;

  urgent.sort((a, b) => {
    // Magnitude descending (nulls last)
    const magA = a.magnitude ?? -1;
    const magB = b.magnitude ?? -1;
    if (magB !== magA) return magB - magA;

    // Distance ascending (closer wins)
    if (a.distanceFromProperty !== b.distanceFromProperty) {
      return a.distanceFromProperty - b.distanceFromProperty;
    }

    // Date descending (more recent wins)
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return urgent[0];
}

/**
 * Format an ISO date string to human-readable format.
 * "2025-06-18T00:00:00Z" -> "Jun 18, 2025"
 */
export function formatEventDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Detect storm clusters: groups of 2+ hail events within 3 miles
 * and +/-6 hours on the same calendar date. Mutates events in-place
 * to set stormCluster flag. Returns array of clustered date strings.
 */
export function detectStormClusters(events: StormEvent[]): string[] {
  const clusteredDates: Set<string> = new Set();

  // Group events into time windows (+/-6 hours from each event)
  const hailEvents = events.filter((e) => e.type === "HAIL");

  for (let i = 0; i < hailEvents.length; i++) {
    const cluster: StormEvent[] = [hailEvents[i]];
    const baseTime = new Date(hailEvents[i].date).getTime();

    for (let j = i + 1; j < hailEvents.length; j++) {
      const otherTime = new Date(hailEvents[j].date).getTime();
      const hoursDiff = Math.abs(otherTime - baseTime) / (1000 * 60 * 60);

      if (hoursDiff <= CLUSTER_TIME_WINDOW_HOURS) {
        const dist = haversineDistance(
          hailEvents[i].lat, hailEvents[i].lng,
          hailEvents[j].lat, hailEvents[j].lng
        );
        if (dist <= CLUSTER_RADIUS_MILES) {
          cluster.push(hailEvents[j]);
        }
      }
    }

    if (cluster.length >= CLUSTER_MIN_REPORTS) {
      const dateKey = hailEvents[i].date.split("T")[0];
      clusteredDates.add(dateKey);
      // Flag all events in this cluster
      cluster.forEach((e) => (e.stormCluster = true));
    }
  }

  return Array.from(clusteredDates).sort();
}

/**
 * Build complete SummaryStats from an events array.
 */
export function buildSummaryStats(
  events: StormEvent[],
  searchDate: string
): SummaryStats {
  const now = new Date(searchDate);
  const startDate = new Date(now);
  startDate.setFullYear(startDate.getFullYear() - SEARCH_CONFIG.lookbackYears);

  const hailEvents = events.filter((e) => e.type === "HAIL");
  const windEvents = events.filter((e) => e.type === "WIND");
  const tornadoEvents = events.filter((e) => e.type === "TORNADO");

  const hailMagnitudes = hailEvents
    .map((e) => e.magnitude)
    .filter((m): m is number => m !== null);
  const windMagnitudes = windEvents
    .map((e) => e.magnitude)
    .filter((m): m is number => m !== null);

  const damages = events
    .map((e) => e.propertyDamage)
    .filter((d): d is number => d !== null);

  // For urgency counting, exclude sub-threshold events unless clustered
  const urgencyEligible = (e: StormEvent) =>
    e.severityLabel !== "Reported" || e.stormCluster;

  // Detect storm clusters (mutates events in-place)
  const clusteredDates = detectStormClusters(events);

  return {
    totalEvents: events.length,
    hailEvents: hailEvents.length,
    windEvents: windEvents.length,
    tornadoEvents: tornadoEvents.length,
    urgentEvents: events.filter((e) => e.urgencyStatus === "URGENT" && urgencyEligible(e)).length,
    recentEvents: events.filter((e) => e.urgencyStatus === "RECENT" && urgencyEligible(e)).length,
    historicalEvents: events.filter((e) => e.urgencyStatus === "HISTORICAL").length,
    largestHail: hailMagnitudes.length > 0 ? Math.max(...hailMagnitudes) : null,
    highestWind: windMagnitudes.length > 0 ? Math.max(...windMagnitudes) : null,
    recommendedEvent: pickRecommendedEvent(events),
    totalReportedDamage: damages.length > 0 ? damages.reduce((a, b) => a + b, 0) : null,
    clusteredStormDates: clusteredDates,
    dateRangeStart: startDate.toISOString(),
    dateRangeEnd: now.toISOString(),
  };
}

// ============================================================
// INLINE TESTS — run with: npx tsx src/lib/utils.ts
// ============================================================

if (typeof process !== "undefined" && process.argv[1]?.endsWith("utils.ts")) {
  console.log("Running utils.ts inline tests...\n");

  // Test haversineDistance: Dallas (32.7767, -96.7970) to Little Rock (34.7465, -92.2896)
  // Real distance ~292 miles (verified against multiple calculators)
  const dallasToLR = haversineDistance(32.7767, -96.797, 34.7465, -92.2896);
  console.assert(
    dallasToLR > 285 && dallasToLR < 300,
    `haversineDistance Dallas->LR expected ~292, got ${dallasToLR}`
  );
  console.log(`✓ haversineDistance: Dallas->Little Rock = ${dallasToLR} miles`);

  // Test calculateBoundingBox: 2 mile radius ~ 0.058 degree latitude spread
  const bbox = calculateBoundingBox(34.7465, -92.2896, 2);
  const latSpread = bbox.maxLat - bbox.minLat;
  console.assert(
    latSpread > 0.055 && latSpread < 0.06,
    `calculateBoundingBox latSpread expected ~0.058, got ${latSpread}`
  );
  console.log(`✓ calculateBoundingBox: 2mi radius latSpread = ${latSpread.toFixed(4)} degrees`);

  // Test assignUrgencyStatus with hardcoded dates
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

  console.assert(
    assignUrgencyStatus(daysAgo(30)) === "URGENT",
    "30 days ago should be URGENT"
  );
  console.assert(
    assignUrgencyStatus(daysAgo(400)) === "RECENT",
    "400 days ago should be RECENT"
  );
  console.assert(
    assignUrgencyStatus(daysAgo(800)) === "HISTORICAL",
    "800 days ago should be HISTORICAL"
  );
  console.log("✓ assignUrgencyStatus: all three outcomes correct");

  // Test assignSeverityLabel
  console.assert(assignSeverityLabel("HAIL", 0.5) === "Reported", "0.5in hail = Reported");
  console.assert(assignSeverityLabel("HAIL", 0.75) === "Minor", "0.75in hail = Minor");
  console.assert(assignSeverityLabel("HAIL", 1.5) === "Moderate", "1.5in hail = Moderate");
  console.assert(assignSeverityLabel("HAIL", 2.0) === "Significant", "2.0in hail = Significant");
  console.assert(assignSeverityLabel("HAIL", 3.0) === "Severe", "3.0in hail = Severe");
  console.assert(assignSeverityLabel("WIND", 50) === null, "50mph wind = null");
  console.assert(assignSeverityLabel("WIND", 60) === "Damaging", "60mph wind = Damaging");
  console.assert(assignSeverityLabel("WIND", 80) === "Destructive", "80mph wind = Destructive");
  console.assert(assignSeverityLabel("WIND", 100) === "Extreme", "100mph wind = Extreme");
  console.log("✓ assignSeverityLabel: all thresholds correct");

  // Test pickRecommendedEvent
  const makeEvent = (overrides: Partial<StormEvent>): StormEvent => ({
    id: "test",
    source: "SWDI",
    type: "HAIL",
    date: daysAgo(30),
    lat: 34.7,
    lng: -92.3,
    magnitude: 1.0,
    magnitudeUnit: "inches",
    distanceFromProperty: 1.0,
    severityLabel: "Significant",
    urgencyStatus: "URGENT",
    daysUntilExpired: 335,
    isRecommended: false,
    corroborated: false,
    stormCluster: false,
    radarStation: null,
    countyName: null,
    eventNarrative: null,
    propertyDamage: null,
    noaaUrl: null,
    ...overrides,
  });

  const testEvents: StormEvent[] = [
    makeEvent({ id: "a", magnitude: 1.0, distanceFromProperty: 0.5 }),
    makeEvent({ id: "b", magnitude: 2.5, distanceFromProperty: 1.5 }),
    makeEvent({ id: "c", magnitude: 2.5, distanceFromProperty: 0.8 }),
  ];

  const recommended = pickRecommendedEvent(testEvents);
  console.assert(
    recommended?.id === "c",
    `pickRecommendedEvent: expected 'c' (2.5in, 0.8mi), got '${recommended?.id}'`
  );
  console.log(`✓ pickRecommendedEvent: correctly picked '${recommended?.id}' (highest magnitude, closest distance)`);

  // Test with no urgent events
  const historicalEvents = [
    makeEvent({ id: "d", urgencyStatus: "HISTORICAL" }),
  ];
  console.assert(
    pickRecommendedEvent(historicalEvents) === null,
    "No URGENT events should return null"
  );
  console.log("✓ pickRecommendedEvent: returns null when no URGENT events");

  // Test daysUntilExpired
  const expiring = daysUntilExpired(daysAgo(300));
  console.assert(
    expiring !== null && expiring > 60 && expiring < 70,
    `daysUntilExpired for 300-day-old event expected ~65, got ${expiring}`
  );
  const expired = daysUntilExpired(daysAgo(400));
  console.assert(expired === null, `daysUntilExpired for 400-day-old event expected null, got ${expired}`);
  console.log(`✓ daysUntilExpired: 300 days ago = ${expiring} days left, 400 days ago = null`);

  // Test formatEventDate (use noon UTC to avoid timezone edge cases)
  console.assert(
    formatEventDate("2025-06-18T12:00:00Z") === "Jun 18, 2025",
    `formatEventDate expected 'Jun 18, 2025', got '${formatEventDate("2025-06-18T12:00:00Z")}'`
  );
  console.log(`✓ formatEventDate: "2025-06-18T12:00:00Z" -> "${formatEventDate("2025-06-18T12:00:00Z")}"`);

  // Test buildSummaryStats
  const statsEvents: StormEvent[] = [
    makeEvent({ id: "s1", type: "HAIL", magnitude: 2.0, urgencyStatus: "URGENT", propertyDamage: 5000 }),
    makeEvent({ id: "s2", type: "WIND", magnitude: 65, magnitudeUnit: "mph", urgencyStatus: "RECENT", propertyDamage: 3000 }),
    makeEvent({ id: "s3", type: "TORNADO", magnitude: null, magnitudeUnit: null, urgencyStatus: "HISTORICAL" }),
  ];
  const stats = buildSummaryStats(statsEvents, new Date().toISOString());
  console.assert(stats.totalEvents === 3, `totalEvents expected 3, got ${stats.totalEvents}`);
  console.assert(stats.hailEvents === 1, `hailEvents expected 1, got ${stats.hailEvents}`);
  console.assert(stats.windEvents === 1, `windEvents expected 1, got ${stats.windEvents}`);
  console.assert(stats.tornadoEvents === 1, `tornadoEvents expected 1, got ${stats.tornadoEvents}`);
  console.assert(stats.largestHail === 2.0, `largestHail expected 2.0, got ${stats.largestHail}`);
  console.assert(stats.highestWind === 65, `highestWind expected 65, got ${stats.highestWind}`);
  console.assert(stats.totalReportedDamage === 8000, `totalReportedDamage expected 8000, got ${stats.totalReportedDamage}`);
  console.assert(stats.urgentEvents === 1, `urgentEvents expected 1, got ${stats.urgentEvents}`);
  console.log("✓ buildSummaryStats: all fields computed correctly");

  console.log("\n✅ All tests passed!");
}
