"use client";

import { useState, useCallback } from "react";
import { geocodeAddress, fetchStorms } from "@/lib/api";
import type { AppState } from "@/lib/types";

export function useStormSearch() {
  const [state, setState] = useState<AppState>({ phase: "search" });

  const search = useCallback(async (address: string) => {
    setState({ phase: "loading" });

    try {
      // Step 1: Geocode
      const geo = await geocodeAddress(address);

      // Step 2: Fetch storms (pass nwsZoneCode for NWS alerts)
      const result = await fetchStorms(
        geo.lat,
        geo.lng,
        geo.countyFips,
        geo.nwsZoneCode,
        geo.state,
        geo.address
      );

      setState({ phase: "results", data: result });
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ phase: "search" });
  }, []);

  return { state, search, reset };
}
