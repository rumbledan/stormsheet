import { NextRequest, NextResponse } from "next/server";
import { fetchSwdiData } from "@/lib/noaa";

export async function POST(request: NextRequest) {
  try {
    const { lat, lng } = await request.json();

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
    }

    const events = await fetchSwdiData(lat, lng);
    return NextResponse.json({ events, count: events.length });
  } catch (error) {
    console.error("SWDI error:", error);
    return NextResponse.json({ events: [], count: 0 });
  }
}
