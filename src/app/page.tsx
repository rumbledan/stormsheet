"use client";

import { useRef, useState, useEffect } from "react";
import Script from "next/script";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useStormSearch } from "@/hooks/useStormSearch";
import SearchBar from "@/components/SearchBar";
import LoadingScreen from "@/components/LoadingScreen";
import ResultsSummary from "@/components/ResultsSummary";
import BestClaimDate from "@/components/BestClaimDate";
import EventList from "@/components/EventList";
import { generateStormReportPdf } from "@/lib/pdf";
import { downloadPdf } from "@/lib/email";

// Leaflet must be loaded client-side only
const StormMap = dynamic(() => import("@/components/StormMap"), { ssr: false });

export default function Home() {
  const { state, search, reset } = useStormSearch();
  const [pdfStatus, setPdfStatus] = useState<"idle" | "generating">("idle");
  const [placesLoaded, setPlacesLoaded] = useState(false);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load custom logo from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("stormsheet_custom_logo");
    if (saved) setCustomLogo(saved);
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setCustomLogo(base64);
      localStorage.setItem("stormsheet_custom_logo", base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setCustomLogo(null);
    localStorage.removeItem("stormsheet_custom_logo");
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleDownload = async () => {
    if (state.phase !== "results" || pdfStatus === "generating") return;
    setPdfStatus("generating");
    try {
      const pdfBase64 = await generateStormReportPdf(state.data, mapRef.current, customLogo);
      downloadPdf(pdfBase64, state.data.address);
    } catch (err) {
      console.error("[pdf] Generation failed:", err);
    } finally {
      setPdfStatus("idle");
    }
  };

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="afterInteractive"
        onLoad={() => setPlacesLoaded(true)}
      />

      <main className="min-h-screen flex flex-col">
        {/* Header — results mode: compact bar. Search mode: part of hero */}
        {state.phase !== "search" && (
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
                {state.phase === "results" && (
                  <button
                    onClick={reset}
                    className="text-brand-text-secondary text-xs hover:text-brand-gold transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    New Search
                  </button>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Content area */}
        <div className={state.phase === "search" ? "" : "flex-1 px-4 pb-24 max-w-lg mx-auto w-full"}>
          {/* LANDING PAGE — Marketing layout */}
          {state.phase === "search" && (
            <div className="relative bg-[#0a0f1e]">
              {/* Storm atmosphere background */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Lightning texture overlay */}
                <div className="absolute inset-0 opacity-[0.07]" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                }} />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(59,130,246,0.18)_0%,_transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(59,130,246,0.1)_0%,_transparent_45%)]" />
                <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-[radial-gradient(circle,_rgba(59,130,246,0.08)_0%,_transparent_70%)] animate-pulse" style={{ animationDuration: "5s" }} />
                {/* Subtle horizontal glow line */}
                <div className="absolute bottom-[12%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
              </div>

              {/* Nav */}
              <nav className="relative z-10 px-6 sm:px-10 py-6">
                <div className="max-w-6xl mx-auto">
                  <Image
                    src="/stormsheet-logo.png"
                    alt="StormSheet"
                    width={200}
                    height={44}
                    className="h-10 w-auto"
                  />
                </div>
              </nav>

              {/* Hero — two column: text left, report preview right */}
              <div className="relative z-10 px-6 sm:px-10 py-10 lg:py-16">
                <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                  {/* LEFT — Content */}
                  <div className="space-y-7">
                    <h1 className="text-4xl sm:text-5xl xl:text-[3.4rem] font-extrabold text-white leading-[1.1] tracking-tight">
                      Know Your Property&apos;s{" "}
                      <br className="hidden sm:block" />
                      Storm History{" "}
                      <span className="text-blue-400">in Seconds</span>
                    </h1>
                    <p className="text-lg text-gray-400 leading-relaxed max-w-lg">
                      Verified NOAA + NWS storm data.
                      <br />
                      Instant, homeowner-ready reports.
                    </p>

                    {/* Search input — full width, prominent */}
                    <div className="max-w-lg">
                      {placesLoaded ? (
                        <SearchBar onSearch={search} />
                      ) : (
                        <div className="text-gray-500 text-sm py-4">
                          Loading address search...
                        </div>
                      )}
                    </div>

                    {/* Trust bullets — 2x2 grid on mobile, vertical stack on desktop */}
                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 pt-2">
                      {[
                        { short: "NOAA Verified", full: "NOAA Verified Data" },
                        { short: "NWS Sources", full: "National Weather Service Sources" },
                        { short: "5-Year History", full: "5-Year Storm History" },
                        { short: "Homeowner Ready", full: "Homeowner-Ready Reports" },
                      ].map((item) => (
                        <div key={item.full} className="flex items-center gap-2 lg:gap-3">
                          <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" fillRule="evenodd" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm lg:text-base font-medium text-gray-200">
                            <span className="lg:hidden">{item.short}</span>
                            <span className="hidden lg:inline">{item.full}</span>
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Social proof */}
                    <div className="pt-2">
                      <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/5 border border-white/10">
                        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                        <span className="text-sm text-gray-400">
                          Last report: <span className="text-white font-medium">3 hail events, 2 high-wind events detected</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT — Tilted report preview (CSS mockup) */}
                  <div className="flex justify-center items-center mt-8 lg:mt-0">
                    <div className="relative" style={{ perspective: "1200px" }}>
                      <div
                        className="relative w-[340px] shadow-2xl shadow-blue-500/10"
                        style={{ transform: "rotateY(-8deg) rotateX(4deg) rotateZ(-2deg)" }}
                      >
                        {/* Page 1 — front */}
                        <div className="bg-white rounded-lg p-5 space-y-3">
                          {/* Header */}
                          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                            <Image src="/stormsheet-logo.png" alt="" width={100} height={22} className="h-5 w-auto opacity-80" />
                            <span className="text-[8px] font-bold text-gray-600 tracking-wider">STORM DAMAGE REPORT</span>
                          </div>

                          {/* Title */}
                          <div className="text-center py-1">
                            <p className="text-[11px] font-extrabold text-gray-800 tracking-wide">STORMSHEET PROPERTY REPORT</p>
                            <p className="text-[7px] text-gray-500 mt-0.5">1629 Bland St, Benton, Saline County, AR 72201</p>
                          </div>

                          {/* Two boxes: map + stats */}
                          <div className="grid grid-cols-2 gap-2">
                            {/* Map — satellite-style visual */}
                            <div className="bg-gradient-to-br from-[#2d5a27] via-[#3a6b32] to-[#4a7a3f] rounded h-24 relative overflow-hidden">
                              {/* Road grid pattern */}
                              <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(90deg, rgba(200,200,180,0.2) 1px, transparent 1px), linear-gradient(0deg, rgba(200,200,180,0.15) 1px, transparent 1px)", backgroundSize: "18px 14px" }} />
                              {/* Darker patches for buildings/terrain */}
                              <div className="absolute top-2 left-3 w-6 h-4 bg-[#3d6335]/80 rounded-sm" />
                              <div className="absolute top-6 right-4 w-8 h-3 bg-[#2d5025]/60 rounded-sm" />
                              <div className="absolute bottom-4 left-6 w-5 h-5 bg-[#4a7a3f]/70 rounded-sm" />
                              {/* Blue pin markers */}
                              {[[15,20],[35,45],[55,30],[25,65],[70,55],[45,75],[60,15]].map(([x,y], i) => (
                                <div key={i} className="absolute w-2 h-2 bg-blue-400 rounded-full border border-blue-200 shadow-sm shadow-blue-400/50" style={{ left: `${x}%`, top: `${y}%` }} />
                              ))}
                              {/* Center property marker */}
                              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-md" />
                            </div>
                            {/* Stats */}
                            <div className="flex flex-col items-center justify-center bg-gray-50 rounded p-2">
                              <div className="w-14 h-8 bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 rounded-t-full relative mb-1">
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-5 bg-gray-800 origin-bottom rounded-full" style={{ transform: "rotate(35deg)" }} />
                              </div>
                              <p className="text-[13px] font-extrabold text-gray-800">12 Storm Events</p>
                              <p className="text-[6px] text-gray-500">Including 3 clusters</p>
                              <p className="text-[6px] text-gray-500">8 Hail, 2 Wind, 1 Tornado</p>
                            </div>
                          </div>

                          {/* Mini table */}
                          <div className="space-y-0">
                            <div className="grid grid-cols-7 gap-0.5 bg-[#1e3a5f] text-white text-[5px] font-bold px-1 py-1 rounded-t">
                              <span>Date</span><span>Type</span><span>Magnitude</span><span>Distance</span><span>Severity</span><span>Status</span><span>Radar</span>
                            </div>
                            {[0,1,2,3,4,5,6].map((i) => (
                              <div key={i} className={`grid grid-cols-7 gap-0.5 text-[5px] px-1 py-0.5 ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                                <span className="text-gray-600">Apr {12+i}, 2025</span>
                                <span className="text-gray-700 font-medium">HAIL</span>
                                <span className="text-gray-600">1.{i}0&quot;</span>
                                <span className="text-gray-600">{(0.5+i*0.3).toFixed(1)} mi</span>
                                <span className="text-orange-600 font-medium">Moderate</span>
                                <span className="text-gray-500">HISTORICAL</span>
                                <span className="text-gray-400 truncate">KLZK</span>
                              </div>
                            ))}
                          </div>

                          {/* Footer logos */}
                          <div className="flex items-center justify-center gap-3 pt-1 border-t border-gray-100">
                            <span className="text-[5px] text-gray-400">Powered by NOAA + NWS federal data</span>
                          </div>
                        </div>

                        {/* Shadow/depth effect — second page peeking behind */}
                        <div className="absolute -bottom-2 -right-2 w-full h-full bg-white/80 rounded-lg -z-10 border border-gray-200" style={{ transform: "rotate(2deg)" }} />
                        <div className="absolute -bottom-4 -right-3 w-full h-full bg-white/50 rounded-lg -z-20 border border-gray-200" style={{ transform: "rotate(4deg)" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="relative z-10 pb-8 px-6 sm:px-10 space-y-4">
                <div className="max-w-6xl mx-auto border-t border-white/10 pt-6">
                  <p className="text-sm text-gray-400 text-center">
                    Used by homeowners, contractors, and insurance professionals
                  </p>
                  <p className="text-[11px] text-gray-600 text-center mt-3 max-w-3xl mx-auto leading-relaxed">
                    Storm data is sourced in real-time from multiple NOAA and National Weather Service (NWS) databases. This report is intended for informational and homeowner education purposes only and may be used by homeowners, contractors, and insurance professionals. StormSheet is not affiliated with or endorsed by NOAA or NWS. &copy; 2026 StormSheet. All rights reserved.
                  </p>
                </div>
              </div>
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

        {/* Sticky download area — logo upload + download button */}
        {state.phase === "results" && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-brand-bg/95 backdrop-blur border-t border-brand-border p-4">
            <div className="max-w-lg mx-auto space-y-3">
              {/* Logo upload section */}
              <div className="flex items-center justify-between">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                {customLogo ? (
                  <div className="flex items-center gap-3 flex-1">
                    <img src={customLogo} alt="Your logo" className="h-8 max-w-[120px] object-contain rounded" />
                    <span className="text-brand-text-secondary text-xs">Your logo on report</span>
                    <button
                      onClick={handleRemoveLogo}
                      className="ml-auto text-brand-text-secondary hover:text-brand-tornado-red text-xs flex items-center gap-1 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-2 text-sm text-brand-text-secondary hover:text-brand-gold transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Add your company logo to the report
                  </button>
                )}
              </div>

              {/* Download button */}
              <button
                onClick={handleDownload}
                disabled={pdfStatus === "generating"}
                className="w-full py-3.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-bg font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-base disabled:opacity-60"
              >
                {pdfStatus === "generating" ? (
                  <>
                    <span className="w-5 h-5 border-2 border-brand-bg/30 border-t-brand-bg rounded-full animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Storm Report
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
