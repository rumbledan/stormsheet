import { NOAA_STORM_EVENTS_BULK, NWS_API_BASE, SEARCH_CONFIG } from "./constants";
import { calculateBoundingBox, haversineDistance, assignSeverityLabel, assignUrgencyStatus, daysUntilExpired } from "./utils";
import type { StormEvent } from "./types";
import Papa from "papaparse";

// Use ncei.noaa.gov directly — ncdc.noaa.gov 301-redirects to it
const SWDI_BASE = "https://www.ncei.noaa.gov/swdiws";

/**
 * Fetch NOAA SWDI radar hail signatures.
 * SWDI API has a 744-hour (~31 day) max range, so we loop month-by-month.
 * Endpoint: /csv/nx3hail/{startDate}:{endDate}?bbox=minLng,minLat,maxLng,maxLat
 * Response CSV fields: ZTIME, WSR_ID, CELL_ID, PROB, SEVPROB, MAXSIZE, LAT, LON
 */
export async function fetchSwdiData(lat: number, lng: number): Promise<StormEvent[]> {
  const bbox = calculateBoundingBox(lat, lng, SEARCH_CONFIG.radiusMiles);
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - SEARCH_CONFIG.lookbackYears);

  const allEvents: StormEvent[] = [];
  let cursor = new Date(startDate);
  let requestCount = 0;
  let emptyCount = 0;

  // Loop month-by-month (max 31 days per request)
  while (cursor < endDate) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + 30);
    if (chunkEnd > endDate) chunkEnd.setTime(endDate.getTime());

    const sdate = formatSwdiDate(cursor);
    const edate = formatSwdiDate(chunkEnd);
    // Bbox order: minLng, minLat, maxLng, maxLat (longitude first!)
    const url = `${SWDI_BASE}/csv/nx3hail/${sdate}:${edate}?bbox=${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;

    if (requestCount === 0) {
      console.log("[SWDI] First request URL:", url);
    }

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const text = await res.text();
        const events = parseSwdiCsv(text, lat, lng);
        if (events.length === 0) {
          emptyCount++;
        } else {
          allEvents.push(...events);
        }
      }
    } catch {
      // Individual month failure is non-fatal
      console.warn(`[SWDI] Request failed for ${sdate}:${edate}`);
    }

    requestCount++;
    cursor = new Date(chunkEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  console.log(`[SWDI] Completed ${requestCount} requests. ${allEvents.length} events found. ${emptyCount} empty months.`);
  return allEvents;
}

function formatSwdiDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function parseSwdiCsv(csvText: string, propertyLat: number, propertyLng: number): StormEvent[] {
  // SWDI CSV has a "summary" section at the end — strip it
  const lines = csvText.split("\n");
  const summaryIdx = lines.findIndex((l) => l.trim().toLowerCase() === "summary");
  const dataText = summaryIdx > 0 ? lines.slice(0, summaryIdx).join("\n") : csvText;

  const parsed = Papa.parse(dataText, { header: true, skipEmptyLines: true });
  const events: StormEvent[] = [];

  for (const row of parsed.data as Record<string, string>[]) {
    const eventLat = parseFloat(row.LAT);
    const eventLng = parseFloat(row.LON);
    if (!eventLat || !eventLng) continue;

    const distance = haversineDistance(propertyLat, propertyLng, eventLat, eventLng);
    if (distance > SEARCH_CONFIG.radiusMiles) continue;

    const maxSize = parseFloat(row.MAXSIZE) || 0;
    const dateStr = row.ZTIME || "";
    // SWDI ZTIME format: 2025-04-05T03:49:50Z — standard ISO, parses directly
    const eventDate = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

    events.push({
      id: `swdi-${dateStr}-${row.WSR_ID}-${row.CELL_ID}`,
      source: "SWDI",
      type: "HAIL",
      date: eventDate,
      lat: eventLat,
      lng: eventLng,
      magnitude: maxSize > 0 ? maxSize : null,
      magnitudeUnit: maxSize > 0 ? "inches" : null,
      distanceFromProperty: distance,
      severityLabel: assignSeverityLabel("HAIL", maxSize > 0 ? maxSize : null),
      urgencyStatus: assignUrgencyStatus(eventDate),
      daysUntilExpired: daysUntilExpired(eventDate),
      isRecommended: false,
      corroborated: false,
      stormCluster: false, // set later by detectStormClusters
      radarStation: row.WSR_ID || null,
      countyName: null,
      eventNarrative: maxSize > 0
        ? `Radar-detected hail signature. Max size: ${maxSize}" (${row.PROB || 100}% probability). Radar: ${row.WSR_ID || "unknown"}`
        : "Radar-detected hail signature.",
      propertyDamage: null,
      noaaUrl: "https://www.ncdc.noaa.gov/swdi/#Hail",
    });
  }

  return events;
}

/**
 * Parse Storm Events date format: "14-MAR-25 23:16:00" → ISO string
 * The NOAA format uses 2-digit year and 3-letter month abbreviation.
 */
function parseStormEventsDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();

  // Format: DD-MMM-YY HH:MM:SS (e.g., "14-MAR-25 23:16:00")
  const months: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };

  const match = dateStr.match(/(\d{1,2})-([A-Z]{3})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    // Fallback: try native Date parsing
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  const [, day, monthAbbr, year2, hours, minutes, seconds] = match;
  const month = months[monthAbbr] || "01";
  // 2-digit year: 00-49 → 2000s, 50-99 → 1900s
  const yearNum = parseInt(year2);
  const fullYear = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;

  return `${fullYear}-${month}-${day.padStart(2, "0")}T${hours}:${minutes}:${seconds}Z`;
}

/**
 * Fetch NOAA Storm Events from bulk CSV files.
 * Downloads yearly gzipped CSVs from NCEI, decompresses, parses with papaparse.
 * Filters by state, proximity, and event type.
 */
export async function fetchStormEventsData(
  lat: number,
  lng: number,
  state: string
): Promise<StormEvent[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - SEARCH_CONFIG.lookbackYears);
  const allEvents: StormEvent[] = [];

  // First, fetch the directory listing to get exact filenames (they include a _c{date} suffix)
  const listUrl = NOAA_STORM_EVENTS_BULK + "/";
  console.log("[StormEvents] Directory listing URL:", listUrl);

  let fileList: string[] = [];
  try {
    const listRes = await fetch(listUrl, { signal: AbortSignal.timeout(15000) });
    if (listRes.ok) {
      const html = await listRes.text();
      const matches = html.match(/StormEvents_details-ftp_v1\.0_d\d{4}_c\d{8}\.csv\.gz/g);
      fileList = matches || [];
      console.log("[StormEvents] Found", fileList.length, "detail files in directory");
    }
  } catch (err) {
    console.error("[StormEvents] Failed to fetch directory listing:", err);
    return allEvents;
  }

  // Map state name for filtering: "AR" → "ARKANSAS"
  // Storm Events uses full uppercase state names in the STATE column
  const stateMapping: Record<string, string> = {
    AR: "ARKANSAS", AL: "ALABAMA", AZ: "ARIZONA", CA: "CALIFORNIA", CO: "COLORADO",
    CT: "CONNECTICUT", DE: "DELAWARE", FL: "FLORIDA", GA: "GEORGIA", IA: "IOWA",
    ID: "IDAHO", IL: "ILLINOIS", IN: "INDIANA", KS: "KANSAS", KY: "KENTUCKY",
    LA: "LOUISIANA", MA: "MASSACHUSETTS", MD: "MARYLAND", ME: "MAINE", MI: "MICHIGAN",
    MN: "MINNESOTA", MO: "MISSOURI", MS: "MISSISSIPPI", MT: "MONTANA", NC: "NORTH CAROLINA",
    ND: "NORTH DAKOTA", NE: "NEBRASKA", NH: "NEW HAMPSHIRE", NJ: "NEW JERSEY",
    NM: "NEW MEXICO", NV: "NEVADA", NY: "NEW YORK", OH: "OHIO", OK: "OKLAHOMA",
    OR: "OREGON", PA: "PENNSYLVANIA", RI: "RHODE ISLAND", SC: "SOUTH CAROLINA",
    SD: "SOUTH DAKOTA", TN: "TENNESSEE", TX: "TEXAS", UT: "UTAH", VA: "VIRGINIA",
    VT: "VERMONT", WA: "WASHINGTON", WI: "WISCONSIN", WV: "WEST VIRGINIA", WY: "WYOMING",
  };
  const fullStateName = stateMapping[state.toUpperCase()] || state.toUpperCase();

  for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year++) {
    try {
      // Find the file for this year from the directory listing
      const filename = fileList.find((f) => f.includes(`_d${year}_`));
      if (!filename) {
        console.log(`[StormEvents] No file found for year ${year}`);
        continue;
      }
      console.log(`[StormEvents] Matched file for ${year}: ${filename}`);
      const url = `${NOAA_STORM_EVENTS_BULK}/${filename}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) {
        console.warn(`[StormEvents] Download failed for ${year}: HTTP ${res.status}`);
        continue;
      }

      // Decompress gzip using web streams API
      const buffer = await res.arrayBuffer();
      const ds = new DecompressionStream("gzip");
      const csvText = await new Response(
        new Blob([buffer]).stream().pipeThrough(ds)
      ).text();

      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      let stateRowCount = 0;
      let proximityHitCount = 0;

      for (const row of parsed.data as Record<string, string>[]) {
        // Filter by state FIRST to keep memory usage low
        const rowState = (row.STATE || "").trim().toUpperCase();
        if (rowState !== fullStateName) continue;
        stateRowCount++;

        // Filter by event type
        const eventType = (row.EVENT_TYPE || "").toLowerCase();
        if (!eventType.includes("hail") && !eventType.includes("wind") && !eventType.includes("tornado")) continue;

        const eventLat = parseFloat(row.BEGIN_LAT);
        const eventLng = parseFloat(row.BEGIN_LON);
        if (!eventLat || !eventLng) continue;

        const distance = haversineDistance(lat, lng, eventLat, eventLng);
        if (distance > SEARCH_CONFIG.radiusMiles) continue;
        proximityHitCount++;

        let type: "HAIL" | "WIND" | "TORNADO" = "HAIL";
        let magnitudeUnit: "inches" | "mph" | null = null;
        if (eventType.includes("hail")) { type = "HAIL"; magnitudeUnit = "inches"; }
        else if (eventType.includes("wind")) { type = "WIND"; magnitudeUnit = "mph"; }
        else if (eventType.includes("tornado")) { type = "TORNADO"; }

        const magnitude = parseFloat(row.MAGNITUDE) || null;
        // Decision: Use custom date parser for "DD-MMM-YY HH:MM:SS" format
        // that NOAA Storm Events uses (e.g., "14-MAR-25 23:16:00")
        const eventDate = parseStormEventsDate(row.BEGIN_DATE_TIME || "");

        // Parse damage (e.g., "50.00K" → 50000)
        let damageValue: number | null = null;
        const rawDamage = row.DAMAGE_PROPERTY || "";
        if (rawDamage) {
          const dmgMatch = rawDamage.match(/(\d+\.?\d*)([KMB]?)/i);
          if (dmgMatch) {
            const num = parseFloat(dmgMatch[1]);
            const suffix = (dmgMatch[2] || "").toUpperCase();
            const mult = suffix === "K" ? 1000 : suffix === "M" ? 1e6 : suffix === "B" ? 1e9 : 1;
            damageValue = num * mult > 0 ? num * mult : null;
          }
        }

        allEvents.push({
          id: `se-${year}-${row.EVENT_ID || allEvents.length}`,
          source: "STORM_EVENTS",
          type,
          date: eventDate,
          lat: eventLat,
          lng: eventLng,
          magnitude,
          magnitudeUnit,
          distanceFromProperty: distance,
          severityLabel: assignSeverityLabel(type, magnitude),
          urgencyStatus: assignUrgencyStatus(eventDate),
          daysUntilExpired: daysUntilExpired(eventDate),
          isRecommended: false,
          corroborated: false,
          stormCluster: false,
          radarStation: null,
          countyName: row.CZ_NAME || null,
          eventNarrative: row.EPISODE_NARRATIVE || row.EVENT_NARRATIVE || null,
          propertyDamage: damageValue,
          noaaUrl: row.EVENT_ID
            ? `https://www.ncdc.noaa.gov/stormevents/eventdetails.jsp?id=${row.EVENT_ID}`
            : null,
        });
      }

      console.log(`[StormEvents] Year ${year}: ${stateRowCount} ${fullStateName} rows, ${proximityHitCount} within radius`);
    } catch (err) {
      // Individual year failure is non-fatal — note it and continue
      console.error(`[StormEvents] Fetch/parse failed for year ${year}:`, err);
    }
  }

  console.log(`[StormEvents] Total events found: ${allEvents.length}`);
  return allEvents;
}

/**
 * Fetch NWS alerts for a county zone.
 * NOTE: Only returns active/recent alerts, not historical data.
 * This is expected to return few or zero results most of the time.
 */
export async function fetchNwsAlertsData(
  countyFips: string,
  lat: number,
  lng: number
): Promise<StormEvent[]> {
  if (!countyFips) {
    console.log("[NWS] No county FIPS provided, skipping alerts fetch");
    return [];
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - SEARCH_CONFIG.lookbackYears);

  try {
    // Log the points endpoint info for debugging
    console.log(`[NWS] Fetching alerts for zone: ${countyFips}`);
    const url = `${NWS_API_BASE}/alerts?zone=${countyFips}&status=actual&message_type=alert`;
    console.log("[NWS] Alerts URL:", url);

    const res = await fetch(url, {
      headers: {
        "User-Agent": "(stormsheet, hello@stormsheet.com)",
        Accept: "application/geo+json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn("[NWS] Alerts request failed:", res.status);
      return [];
    }

    const data = await res.json();
    const features = data?.features || [];
    console.log(`[NWS] Total alerts returned: ${features.length}`);

    const stormAlerts = features
      .filter((f: Record<string, unknown>) => {
        const props = f.properties as Record<string, string>;
        const eventType = (props?.event || "").toLowerCase();
        return (
          eventType.includes("severe thunderstorm") ||
          eventType.includes("tornado") ||
          eventType.includes("hail")
        );
      })
      .map((f: Record<string, unknown>, i: number) => {
        const props = f.properties as Record<string, string>;
        const onset = props.onset || props.effective || "";
        const eventDate = onset ? new Date(onset).toISOString() : new Date().toISOString();
        const eventName = (props.event || "").toLowerCase();

        let type: "HAIL" | "WIND" | "TORNADO" | "ALERT" = "ALERT";
        if (eventName.includes("tornado")) type = "TORNADO";
        else if (eventName.includes("hail")) type = "HAIL";
        else if (eventName.includes("severe thunderstorm")) type = "WIND";

        const event: StormEvent = {
          id: `nws-${i}-${onset}`,
          source: "NWS",
          type,
          date: eventDate,
          lat,
          lng,
          magnitude: null,
          magnitudeUnit: null,
          distanceFromProperty: 0,
          severityLabel: null,
          urgencyStatus: assignUrgencyStatus(eventDate),
          daysUntilExpired: daysUntilExpired(eventDate),
          isRecommended: false,
          corroborated: false,
          stormCluster: false,
          radarStation: null,
          countyName: props.areaDesc || null,
          eventNarrative: props.headline || props.description?.substring(0, 200) || null,
          propertyDamage: null,
          noaaUrl: props.id || null,
        };
        return event;
      })
      .filter((e: StormEvent) => {
        const eventDate = new Date(e.date);
        return eventDate >= startDate && eventDate <= endDate;
      });

    console.log(`[NWS] Storm-relevant alerts after filtering: ${stormAlerts.length}`);
    return stormAlerts;
  } catch (err) {
    console.error("[NWS] Alerts fetch failed:", err);
    return [];
  }
}
