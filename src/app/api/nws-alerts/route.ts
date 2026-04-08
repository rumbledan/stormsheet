import { NextRequest, NextResponse } from "next/server";
import { fetchNwsAlertsData } from "@/lib/noaa";

export async function POST(request: NextRequest) {
  try {
    const { countyFips, lat, lng } = await request.json();
    const events = await fetchNwsAlertsData(countyFips || "", lat || 0, lng || 0);
    return NextResponse.json({ events, count: events.length });
  } catch (error) {
    console.error("NWS Alerts error:", error);
    return NextResponse.json({ events: [], count: 0 });
  }
}
