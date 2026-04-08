"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ESRI_SATELLITE_URL, ESRI_ATTRIBUTION, BRAND } from "@/lib/constants";
import type { StormEvent } from "@/lib/types";

interface StormMapProps {
  lat: number;
  lng: number;
  events: StormEvent[];
  mapRef?: React.MutableRefObject<HTMLDivElement | null>;
}

/**
 * Leaflet map with ESRI satellite tiles showing property and storm event markers.
 *
 * Decision: Using vanilla Leaflet instead of react-leaflet to avoid SSR issues
 * with Next.js App Router. react-leaflet requires dynamic imports and has
 * hydration edge cases. Direct Leaflet is more reliable for a one-day build.
 */
export default function StormMap({ lat, lng, events, mapRef }: StormMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Forward ref for PDF screenshot
  useEffect(() => {
    if (mapRef && containerRef.current) {
      mapRef.current = containerRef.current;
    }
  }, [mapRef]);

  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    // ESRI satellite tiles (exact URL from spec)
    L.tileLayer(ESRI_SATELLITE_URL, {
      attribution: ESRI_ATTRIBUTION,
      maxZoom: 18,
    }).addTo(map);

    // Add zoom control on the right for mobile
    L.control.zoom({ position: "topright" }).addTo(map);

    // Property marker (gold, center)
    const propertyIcon = L.divIcon({
      className: "property-marker",
      html: `<div style="
        width: 16px; height: 16px;
        background: ${BRAND.gold};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 8px rgba(212,160,23,0.6);
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    L.marker([lat, lng], { icon: propertyIcon })
      .addTo(map)
      .bindPopup("<b>Subject Property</b>");

    // Event markers
    events.forEach((event) => {
      const color =
        event.type === "HAIL"
          ? BRAND.hailBlue
          : event.type === "WIND"
            ? BRAND.windAmber
            : event.type === "TORNADO"
              ? BRAND.tornadoRed
              : BRAND.textSecondary;

      // Larger markers for clustered events
      const size = event.stormCluster ? 12 : 8;

      const icon = L.divIcon({
        className: "event-marker",
        html: `<div style="
          width: ${size}px; height: ${size}px;
          background: ${color};
          border: 2px solid rgba(255,255,255,0.8);
          border-radius: 50%;
          ${event.stormCluster ? `box-shadow: 0 0 0 3px ${color}40, 0 0 12px ${color}60; animation: pulse 2s infinite;` : ""}
        "></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const mag = event.magnitude
        ? `${event.magnitude}${event.magnitudeUnit === "inches" ? '"' : " mph"}`
        : "";
      const dateStr = new Date(event.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      L.marker([event.lat, event.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<div style="font-size:12px">
            <b>${event.type}</b> ${mag}<br/>
            ${dateStr}<br/>
            ${event.distanceFromProperty.toFixed(1)} mi from property<br/>
            ${event.severityLabel || ""} | ${event.source}
            ${event.stormCluster ? "<br/><i style='color:#d4a017'>Multi-report storm system</i>" : ""}
          </div>`
        );
    });

    // Fit bounds to include all markers
    if (events.length > 0) {
      const allPoints: [number, number][] = [
        [lat, lng],
        ...events.map((e) => [e.lat, e.lng] as [number, number]),
      ];
      map.fitBounds(allPoints, { padding: [30, 30], maxZoom: 15 });
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [lat, lng, events]);

  return (
    <>
      {/* Pulse animation for clustered event markers */}
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 currentColor; }
          70% { box-shadow: 0 0 0 6px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
      `}</style>
      <div
        ref={containerRef}
        className="w-full h-[250px] rounded-lg overflow-hidden border border-brand-border"
      />
    </>
  );
}
