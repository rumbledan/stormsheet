import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StormSheet — Free Property Storm History",
  description:
    "Pull verified NOAA storm history for any property. Federal weather data at your fingertips.",
  manifest: "/manifest.json",
  icons: {
    icon: "/stormsheet-icon.png",
    apple: "/stormsheet-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "StormSheet",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "StormSheet — Free Property Storm History",
    description: "Pull verified NOAA storm history for any property. Federal weather data at your fingertips.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "StormSheet Storm History Report" }],
    type: "website",
    siteName: "StormSheet",
  },
  twitter: {
    card: "summary_large_image",
    title: "StormSheet — Free Property Storm History",
    description: "Pull verified NOAA storm history for any property. Federal weather data at your fingertips.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f1117",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-brand-bg text-brand-text-primary">
        {children}
      </body>
    </html>
  );
}
