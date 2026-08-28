"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { cx } from "./primitives";

/**
 * A QR code, rendered as inline SVG.
 *
 * Generated in the browser rather than fetched: there is no server in a static
 * export, and a code that is already in the DOM keeps working on a conference
 * network that only survived the page load. It renders on a light tile
 * regardless of the surrounding theme, because phone cameras are much less
 * reliable at reading an inverted code across a room.
 */
export function QrCode({
  url,
  className,
  label,
}: {
  url: string;
  className?: string;
  /** Accessible name. The code itself is decorative to a screen reader. */
  label?: string;
}) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void QRCode.toString(url, {
      type: "svg",
      margin: 0,
      color: { dark: "#05080c", light: "#f4f6f8" },
    }).then((markup) => {
      if (!cancelled) setSvg(markup);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div
      className={cx("aspect-square bg-[#f4f6f8] [&>svg]:h-full [&>svg]:w-full", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
