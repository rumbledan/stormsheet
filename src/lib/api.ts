import type { GeoResult, SearchResult } from "./types";

export async function geocodeAddress(address: string): Promise<GeoResult> {
  const res = await fetch("/api/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Geocoding failed");
  }

  return res.json();
}

export async function fetchStorms(
  lat: number,
  lng: number,
  countyFips: string,
  nwsZoneCode: string,
  state: string,
  address: string
): Promise<SearchResult> {
  const res = await fetch("/api/storms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, countyFips, nwsZoneCode, state, address }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch storm data");
  }

  return res.json();
}
