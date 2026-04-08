"use client";

import { useRef, useState } from "react";
import Script from "next/script";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useStormSearch } from "@/hooks/useStormSearch";
import SearchBar from "@/components/SearchBar";
import LoadingScreen from "@/components/LoadingScreen";
import ResultsSummary from "@/components/ResultsSummary";
import BestClaimDate from "@/components/BestClaimDate";
import EventList from "@/components/EventList";
import EmailModal from "@/components/EmailModal";

// Leaflet must be loaded client-side only
const StormMap = dynamic(() => import("@/components/StormMap"), { ssr: false });

export default function Home() {
  const { state, search, reset } = useStormSearch();
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [placesLoaded, setPlacesLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement | null>(null);

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="afterInteractive"
        onLoad={() => setPlacesLoaded(true)}
      />

      <main className="min-h-screen flex flex-col">
        {/* Header — always visible, white logo */}
        <header className="sticky top-0 z-40 bg-brand-bg/95 backdrop-blur border-b border-brand-border px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <Image
              src="/stormsheet-logo.png"
              alt="StormSheet"
              width={160}
              height={36}
              className="flex-shrink-0 h-9 w-auto"
            />
            <div className="flex-1 min-w-0">
              {state.phase === "results" ? (
                <button
                  onClick={reset}
                  className="text-brand-text-secondary text-xs hover:text-brand-gold transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  New Search
                </button>
              ) : (
                <h1 className="text-brand-text-primary text-sm font-semibold truncate">
                  StormSheet
                </h1>
              )}
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 px-4 pb-24 max-w-lg mx-auto w-full">
          {/* Search phase */}
          {state.phase === "search" && (
            <div className="pt-8 space-y-6">
              <div className="text-center">
                <h2 className="text-brand-gold text-xl font-bold mb-2">
                  Property Storm History
                </h2>
                <p className="text-brand-text-secondary text-sm">
                  Enter a property address to pull 5 years of verified storm data from NOAA
                </p>
              </div>
              {placesLoaded && <SearchBar onSearch={search} />}
              {!placesLoaded && (
                <div className="text-center text-brand-text-secondary text-sm">
                  Loading address search...
                </div>
              )}
            </div>
          )}

          {/* Loading phase */}
          {state.phase === "loading" && <LoadingScreen />}

          {/* Error phase */}
          {state.phase === "error" && (
            <div className="pt-8 space-y-4 text-center">
              <div className="w-12 h-12 bg-brand-tornado-red/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-brand-tornado-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-brand-text-primary font-semibold">{state.message}</p>
              <button
                onClick={reset}
                className="px-6 py-2 bg-brand-card border border-brand-border rounded-lg text-brand-text-primary hover:border-brand-gold transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Results phase */}
          {state.phase === "results" && (
            <div className="pt-4 space-y-4">
              {/* Address header */}
              <div>
                <h2 className="text-brand-text-primary text-base font-bold">
                  {state.data.address}
                </h2>
                <p className="text-brand-text-secondary text-xs">
                  {state.data.countyName} County, {state.data.state} | {state.data.lat.toFixed(4)}, {state.data.lng.toFixed(4)}
                </p>
              </div>

              {/* Summary stats + hero statement */}
              <ResultsSummary
                address={state.data.address}
                stats={state.data.summaryStats}
              />

              {/* BEST CLAIM DATE — impossible to miss */}
              <BestClaimDate stats={state.data.summaryStats} />

              {/* Map */}
              <StormMap
                lat={state.data.lat}
                lng={state.data.lng}
                events={state.data.events}
                mapRef={mapRef}
              />

              {/* Event list */}
              <EventList events={state.data.events} />
            </div>
          )}
        </div>

        {/* Sticky email button — visible during results phase */}
        {state.phase === "results" && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-brand-bg/95 backdrop-blur border-t border-brand-border p-4">
            <div className="max-w-lg mx-auto">
              <button
                onClick={() => setEmailModalOpen(true)}
                className="w-full py-3.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-bg font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Storm Report
              </button>
            </div>
          </div>
        )}

        {/* Email modal */}
        {state.phase === "results" && (
          <EmailModal
            isOpen={emailModalOpen}
            onClose={() => setEmailModalOpen(false)}
            result={state.data}
            mapElement={mapRef.current}
          />
        )}
      </main>
    </>
  );
}
