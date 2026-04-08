"use client";

import { useState, useRef, useEffect } from "react";
import { sendEmailWithPdf, downloadPdf } from "@/lib/email";
import { generateStormReportPdf } from "@/lib/pdf";
import type { SearchResult } from "@/lib/types";

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: SearchResult;
  mapElement: HTMLElement | null;
}

export default function EmailModal({ isOpen, onClose, result, mapElement }: EmailModalProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "generating" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [method, setMethod] = useState<"emailjs" | "mailto" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if EmailJS is configured
  const emailJsConfigured = !!(
    process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID &&
    process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID &&
    process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
  );

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (isOpen) {
      setStatus("idle");
      setErrorMsg("");
      setMethod(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!email.trim() || !email.includes("@")) return;
    setStatus("generating");
    setErrorMsg("");

    try {
      const pdfBase64 = await generateStormReportPdf(result, mapElement);
      setStatus("sending");

      const sendResult = await sendEmailWithPdf({
        recipientEmail: email.trim(),
        address: result.address,
        eventCount: result.summaryStats.totalEvents,
        pdfBase64,
      });

      setMethod(sendResult.method);
      if (sendResult.success) {
        setStatus("sent");
        if (sendResult.method === "mailto") {
          downloadPdf(pdfBase64, result.address);
        }
      } else {
        setStatus("error");
        setErrorMsg(sendResult.error || "Failed to send email");
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDownloadOnly = async () => {
    setStatus("generating");
    try {
      const pdfBase64 = await generateStormReportPdf(result, mapElement);
      downloadPdf(pdfBase64, result.address);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "PDF generation failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-md bg-brand-card border border-brand-border rounded-t-2xl sm:rounded-2xl p-6 mx-4 mb-0 sm:mb-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-brand-text-secondary hover:text-brand-text-primary"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-brand-text-primary text-lg font-bold mb-1">
          StormSheet Report
        </h2>
        <p className="text-brand-text-secondary text-sm mb-4">
          {result.summaryStats.totalEvents} events found for {result.address}
        </p>

        {status === "sent" ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-brand-text-primary font-semibold">
              {method === "emailjs" ? "Report Sent!" : "Email Client Opened"}
            </p>
            <p className="text-brand-text-secondary text-sm mt-1">
              {method === "emailjs"
                ? `Report sent to ${email}`
                : "PDF downloaded. Attach it to your email."}
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-brand-gold text-brand-bg font-semibold rounded-lg"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {emailJsConfigured && (
              <div className="mb-4">
                <input
                  ref={inputRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="homeowner@email.com"
                  disabled={status !== "idle"}
                  className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-lg text-brand-text-primary placeholder-brand-text-secondary focus:outline-none focus:border-brand-gold"
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
              </div>
            )}

            {status === "error" && (
              <p className="text-brand-tornado-red text-sm mb-3">{errorMsg}</p>
            )}

            {/* Dual action buttons — side by side, equal width */}
            <div className="flex gap-3">
              <button
                onClick={handleDownloadOnly}
                disabled={status === "generating" || status === "sending"}
                className="flex-1 py-3 border-2 border-brand-gold text-brand-gold hover:bg-brand-gold/10 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === "generating" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-brand-gold/30 border-t-brand-gold rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PDF
                  </>
                )}
              </button>

              {emailJsConfigured ? (
                <button
                  onClick={handleSend}
                  disabled={!email.trim() || !email.includes("@") || status === "generating" || status === "sending"}
                  className="flex-1 py-3 bg-brand-gold hover:bg-brand-gold-hover text-brand-bg font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {status === "sending" ? (
                    <>
                      <span className="w-4 h-4 border-2 border-brand-bg/30 border-t-brand-bg rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Report
                    </>
                  )}
                </button>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-brand-text-secondary text-xs text-center italic">
                    Email delivery coming soon
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
