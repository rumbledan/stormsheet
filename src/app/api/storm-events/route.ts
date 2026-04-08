import { NextRequest, NextResponse } from "next/server";
import { fetchStormEventsData } from "@/lib/noaa";

export async function POST(request: NextRequest) {
  try {
    const { lat, lng, state } = await request.json();

    if (typeof lat !== "number" || typeof lng !== "number" || !state) {
      return NextResponse.json({ error: "lat, lng, and state are required" }, { status: 400 });
    }

    const events = await fetchStormEventsData(lat, lng, state);
    return NextResponse.json({ events, count: events.length });
  } catch (error) {
    console.error("Storm Events error:", error);
    return NextResponse.json({ events: [], count: 0 });
  }
}
