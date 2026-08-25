import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "NEIS Strategic Findings Auction",
  description:
    "Live Strategic Findings board and auction scoreboard for the NEIS session at NYC Climate Week.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#05080c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
