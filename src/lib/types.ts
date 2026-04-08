// Storm event from any data source
export interface StormEvent {
  id: string;
  source: "SWDI" | "STORM_EVENTS" | "NWS";
  type: "HAIL" | "WIND" | "TORNADO" | "ALERT";
  date: string; // ISO 8601
  lat: number;
  lng: number;
  magnitude: number | null;
  magnitudeUnit: "inches" | "mph" | null;
  distanceFromProperty: number; // miles
  severityLabel: SeverityLabel;
  urgencyStatus: UrgencyStatus;
  daysUntilExpired: number | null;
  isRecommended: boolean;
  corroborated: boolean;
  stormCluster: boolean; // true if 2+ hail events within 3mi and ±6hrs on same date
  radarStation: string | null;
  countyName: string | null;
  eventNarrative: string | null;
  propertyDamage: number | null;
  noaaUrl: string | null;
}

export type SeverityLabel =
  | "Reported"
  | "Minor"
  | "Moderate"
  | "Significant"
  | "Severe"
  | "Damaging"
  | "Destructive"
  | "Extreme"
  | null;

export type UrgencyStatus = "URGENT" | "RECENT" | "HISTORICAL";

// Aggregated search result returned by /api/storms
export interface SearchResult {
  address: string;
  lat: number;
  lng: number;
  countyName: string;
  countyFips: string;
  state: string;
  events: StormEvent[];
  summaryStats: SummaryStats;
  searchedAt: string; // ISO 8601
}

// Summary statistics computed from events array
export interface SummaryStats {
  totalEvents: number;
  hailEvents: number;
  windEvents: number;
  tornadoEvents: number;
  urgentEvents: number;
  recentEvents: number;
  historicalEvents: number;
  largestHail: number | null;
  highestWind: number | null;
  recommendedEvent: StormEvent | null;
  totalReportedDamage: number | null;
  clusteredStormDates: string[]; // ISO dates where storm cluster was detected
  dateRangeStart: string; // ISO 8601
  dateRangeEnd: string; // ISO 8601
}

// Geocoding result from /api/geocode
export interface GeoResult {
  address: string;
  lat: number;
  lng: number;
  countyName: string;
  countyFips: string;     // Numeric FIPS code (e.g., "05125" for Saline County AR)
  nwsZoneCode: string;    // NWS zone code (e.g., "ARC125") — used for alerts API
  state: string;
}

// Bounding box for SWDI spatial queries
export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// App state for the single-page flow
export type AppState =
  | { phase: "search" }
  | { phase: "loading" }
  | { phase: "results"; data: SearchResult }
  | { phase: "error"; message: string };
