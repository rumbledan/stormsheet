// Loading screen rotating facts
export const STORM_FACTS: string[] = [
  "Wrong storm dates are the #1 reason insurance claims get delayed or denied.",
  "Hail as small as 1 inch can cause significant roof damage depending on shingle type and age.",
  "Most homeowners have no idea their roof has been damaged. Storm damage is often invisible from the ground.",
  "Insurance companies use the same NOAA databases to verify your claim date. Now you have that data too.",
  "2.25 inch hail (golf ball size) can penetrate standard 3-tab shingles in a single storm.",
  "A typical storm restoration claim takes 3-6 weeks from first inspection to approved payout.",
  "Most policies require filing within 1 year of the storm date. Knowing the exact date matters.",
  "NOAA documents over 5,000 hail events across Arkansas every decade.",
];

// Severity classification thresholds
export const SEVERITY_THRESHOLDS = {
  hail: {
    reported: 0,       // < 0.75" = Reported (sub-threshold, kept for context)
    minor: 0.75,       // 0.75-0.99" = Minor
    moderate: 1.0,     // 1.00-1.74" = Moderate
    significant: 1.75, // 1.75-2.49" = Significant
    severe: 2.5,       // >= 2.50" = Severe
  },
  wind: {
    damaging: 58,      // 58-74 mph = Damaging
    destructive: 75,   // 75-94 mph = Destructive
    extreme: 95,       // >= 95 mph = Extreme
  },
} as const;

// Search configuration
export const SEARCH_CONFIG = {
  radiusMiles: 2,
  lookbackYears: 5,
  urgentDays: 365,
  recentDays: 730,
} as const;

// Brand colors (for JS usage — Tailwind classes preferred in components)
export const BRAND = {
  background: "#0f1117",
  card: "#1a1d27",
  gold: "#3E8FCB",
  goldHover: "#5BA3D9",
  textPrimary: "#ffffff",
  textSecondary: "#8b8fa8",
  hailBlue: "#3b82f6",
  windAmber: "#f59e0b",
  tornadoRed: "#ef4444",
  border: "#2d3148",
} as const;

// ESRI satellite tile URL for Leaflet
export const ESRI_SATELLITE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

// ESRI satellite attribution
export const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";

// Company contact — single source of truth for PDF CTA
export const COMPANY_PHONE = "";
export const COMPANY_WEBSITE = "stormsheet.com";

// Federal agency logos for PDF credibility marks
export const NOAA_LOGO_PATH = "/logos/noaa-logo.png";
export const NWS_LOGO_PATH = "/logos/nws-logo.png";

// Wind display threshold — lower than NWS severe (58mph) to capture
// shingle-displacement-class events between 55-57mph
export const WIND_DISPLAY_THRESHOLD_MPH = 55;

// Storm cluster detection thresholds
export const CLUSTER_RADIUS_MILES = 3;
export const CLUSTER_TIME_WINDOW_HOURS = 6;
export const CLUSTER_MIN_REPORTS = 2;

// Hero statement template functions for PDF report
// These are the most important lines on the PDF — read aloud to the homeowner at the door
export function buildHeroStatement(
  address: string,
  stats: {
    totalEvents: number;
    urgentEvents: number;
    clusteredStormDates: string[];
    largestHail: number | null;
    highestWind: number | null;
    totalReportedDamage: number | null;
  }
): string {
  const lines: string[] = [];

  // Primary statement (exactly one)
  if (stats.urgentEvents > 0 && stats.clusteredStormDates.length > 0) {
    lines.push(
      `${address} has experienced ${stats.totalEvents} verified severe weather events in the past 5 years, including ${stats.clusteredStormDates.length} sustained storm systems with multiple confirmed impact points. ${stats.urgentEvents} of these events fall within standard insurance filing windows.`
    );
  } else if (stats.urgentEvents > 0) {
    lines.push(
      `${address} has experienced ${stats.totalEvents} verified severe weather events in the past 5 years. ${stats.urgentEvents} recent events fall within standard insurance filing windows and may represent active claim opportunities.`
    );
  } else {
    lines.push(
      `${address} has experienced ${stats.totalEvents} verified severe weather events in the past 5 years. While these events fall outside standard 12-month filing windows, this history documents significant weather exposure to this property.`
    );
  }

  // Supplemental: largest hail
  if (stats.largestHail !== null && stats.largestHail >= 1.75) {
    const label = stats.largestHail >= 2.5 ? "Severe" : "Significant";
    lines.push(
      `The largest recorded hail event measured ${stats.largestHail} inches (${label}-class), which exceeds the threshold commonly associated with functional roof damage.`
    );
  }

  // Supplemental: reported damage
  if (stats.totalReportedDamage !== null && stats.totalReportedDamage > 0) {
    const formatted = stats.totalReportedDamage >= 1000000
      ? `$${(stats.totalReportedDamage / 1000000).toFixed(1)}M`
      : stats.totalReportedDamage >= 1000
        ? `$${(stats.totalReportedDamage / 1000).toFixed(0)}K`
        : `$${stats.totalReportedDamage.toLocaleString()}`;
    lines.push(
      `NOAA records document ${formatted} in property damage reported in this area during this period.`
    );
  }

  return lines.join("\n\n");
}

// NOAA API endpoints (validated 2026-03-30)
// SWDI: max date range 744 hours (~31 days), must loop month-by-month
export const NOAA_SWDI_BASE = "https://www.ncdc.noaa.gov/swdiws";
// Storm Events: bulk CSV files per year (not the web scraper endpoint)
export const NOAA_STORM_EVENTS_BULK = "https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles";
// NWS: only returns active/recent alerts, NOT historical data
export const NWS_API_BASE = "https://api.weather.gov";
