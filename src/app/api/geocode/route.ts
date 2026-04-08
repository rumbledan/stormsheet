import { NextRequest, NextResponse } from "next/server";
import type { GeoResult } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();
    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
    }

    // Step 1: Geocode address via Google
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    console.log("[geocode] Google URL:", geocodeUrl.replace(apiKey, "***"));
    const geocodeRes = await fetch(geocodeUrl);
    const geocodeData = await geocodeRes.json();

    if (geocodeData.status !== "OK" || !geocodeData.results?.[0]) {
      console.error("[geocode] Google response status:", geocodeData.status);
      return NextResponse.json(
        { error: "Could not find that address. Please try a more specific address." },
        { status: 404 }
      );
    }

    const result = geocodeData.results[0];
    const { lat, lng } = result.geometry.location;
    const formattedAddress = result.formatted_address;
    console.log("[geocode] Resolved:", formattedAddress, "→", lat, lng);

    // Step 2: Get county info from NWS points API
    // Truncate coordinates to 4 decimal places to avoid NWS 301 redirect for excess precision
    const truncLat = Math.round(lat * 10000) / 10000;
    const truncLng = Math.round(lng * 10000) / 10000;
    const nwsPointsUrl = `https://api.weather.gov/points/${truncLat},${truncLng}`;
    console.log("[geocode] NWS points URL:", nwsPointsUrl);
    const nwsHeaders = { "User-Agent": "(stormsheet, hello@stormsheet.com)" };
    const nwsRes = await fetch(nwsPointsUrl, {
      headers: nwsHeaders,
      redirect: "follow",
    });

    let countyName = "";
    let countyFips = "";
    let nwsZoneCode = ""; // NWS zone code like ARC125 (used for alerts)
    let state = "";

    if (nwsRes.ok) {
      const nwsData = await nwsRes.json();
      const countyUrl = nwsData.properties?.county || "";
      nwsZoneCode = countyUrl.split("/").pop() || "";
      state = nwsData.properties?.relativeLocation?.properties?.state || "";
      console.log("[geocode] NWS county URL:", countyUrl);
      console.log("[geocode] NWS zone code:", nwsZoneCode);

      // Fetch the county zone endpoint to get the actual county name
      // relativeLocation.city is the nearest city/subdivision, NOT the county
      if (countyUrl) {
        try {
          const countyRes = await fetch(countyUrl, { headers: nwsHeaders });
          if (countyRes.ok) {
            const countyData = await countyRes.json();
            countyName = countyData.properties?.name || "";
            console.log("[geocode] NWS county name:", countyName);
          }
        } catch (err) {
          console.warn("[geocode] Failed to fetch county zone details:", err);
        }
      }

      // Convert NWS zone code (ARC125) to numeric FIPS (05125)
      // Format: {state 2-letter}{C for county}{3-digit code}
      // State FIPS lookup needed to convert AR → 05
      if (nwsZoneCode.length >= 4) {
        const stateAbbr = nwsZoneCode.substring(0, 2);
        const countyCode = nwsZoneCode.substring(3); // skip the "C"
        const stateFipsMap: Record<string, string> = {
          AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08",
          CT: "09", DE: "10", FL: "12", GA: "13", HI: "15", ID: "16",
          IL: "17", IN: "18", IA: "19", KS: "20", KY: "21", LA: "22",
          ME: "23", MD: "24", MA: "25", MI: "26", MN: "27", MS: "28",
          MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34",
          NM: "35", NY: "36", NC: "37", ND: "38", OH: "39", OK: "40",
          OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47",
          TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54",
          WI: "55", WY: "56", DC: "11",
        };
        const stateFips = stateFipsMap[stateAbbr] || "";
        countyFips = stateFips ? `${stateFips}${countyCode}` : nwsZoneCode;
        console.log("[geocode] Numeric FIPS:", countyFips);
      }
    } else {
      console.warn("[geocode] NWS points failed:", nwsRes.status, await nwsRes.text());
    }

    // Fallback: extract state from Google result
    if (!state) {
      const stateComponent = result.address_components?.find(
        (c: { types: string[] }) => c.types.includes("administrative_area_level_1")
      );
      state = stateComponent?.short_name || "";
    }

    // Fallback: extract county name from Google result
    if (!countyName) {
      const countyComponent = result.address_components?.find(
        (c: { types: string[] }) => c.types.includes("administrative_area_level_2")
      );
      countyName = countyComponent?.long_name?.replace(" County", "") || "";
    }

    const geoResult: GeoResult = {
      address: formattedAddress,
      lat,
      lng,
      countyName,
      countyFips,
      nwsZoneCode,
      state,
    };

    console.log("[geocode] Final result:", JSON.stringify(geoResult));
    return NextResponse.json(geoResult);
  } catch (error) {
    console.error("[geocode] Error:", error);
    return NextResponse.json({ error: "Geocoding failed" }, { status: 500 });
  }
}
