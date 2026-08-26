import type { Metadata, Viewport } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";

import "./globals.css";

// Roboto is what neiscenter.org uses. next/font self-hosts it at build time, so
// the exact brand typeface ships with the site and nothing is fetched from a
// font CDN while the room is watching.
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NEIS Strategic Findings Auction",
  description:
    "Live Strategic Findings board and auction scoreboard for the NEIS Center session at NYC Climate Week.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${roboto.variable} ${robotoMono.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
