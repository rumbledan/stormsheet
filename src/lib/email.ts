import emailjs from "@emailjs/browser";

interface SendEmailParams {
  recipientEmail: string;
  address: string;
  eventCount: number;
  pdfBase64: string;
}

/**
 * Send storm report notification via EmailJS, then download PDF separately.
 *
 * EmailJS free tier does NOT support file attachments. The email sends a
 * notification with the property details, and the PDF is downloaded
 * separately to the user's device. This is the reliable approach that
 * works on all devices including iOS.
 */
export async function sendEmailWithPdf({
  recipientEmail,
  address,
  eventCount,
  pdfBase64,
}: SendEmailParams): Promise<{ method: "emailjs" | "mailto"; success: boolean; error?: string }> {
  // EmailJS public credentials — these are client-visible by design
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "";
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "";
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "";

  // Always download the PDF regardless of email method
  downloadPdf(pdfBase64, address);

  // Try EmailJS — send notification email (no attachment)
  if (serviceId && templateId && publicKey) {
    try {
      console.log(`[email] Sending email notification to ${recipientEmail} for ${address}`);

      await emailjs.send(
        serviceId,
        templateId,
        {
          to_email: recipientEmail,
          subject: `Storm History Report — ${address}`,
          message: `Your property at ${address} has ${eventCount} verified severe weather events in the past 5 years. See the attached report for details.`,
          address: address,
          event_count: String(eventCount),
        },
        publicKey
      );

      console.log("[email] EmailJS send successful");
      return { method: "emailjs", success: true };
    } catch (error) {
      console.error("[email] EmailJS send failed:", error);
      return {
        method: "emailjs",
        success: false,
        error: error instanceof Error ? error.message : "EmailJS send failed. Check template configuration.",
      };
    }
  }

  // Fallback: open mailto
  const subject = encodeURIComponent(`Storm History Report — ${address}`);
  const body = encodeURIComponent(
    `Your property at ${address} has ${eventCount} verified severe weather events in the past 5 years.\n\nThe storm history report PDF has been downloaded to your device.\n\n— StormSheet\nstormsheet.com`
  );
  window.open(`mailto:${recipientEmail}?subject=${subject}&body=${body}`);
  return { method: "mailto", success: true };
}

/**
 * Trigger a browser download of the PDF.
 */
export function downloadPdf(pdfBase64: string, address: string): void {
  const safeAddress = address.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "-");
  const filename = `Storm-Report-${safeAddress}.pdf`;

  try {
    const byteString = atob(pdfBase64.split(",")[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes("Mac") && "ontouchend" in document);

    if (isIOS) {
      const newTab = window.open(blobUrl, "_blank");
      if (!newTab) window.location.href = blobUrl;
    } else {
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch (err) {
    console.error("[download] Blob conversion failed:", err);
    window.open(pdfBase64, "_blank");
  }
}
