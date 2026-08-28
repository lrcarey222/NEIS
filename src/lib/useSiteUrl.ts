"use client";

import { useEffect, useState } from "react";

/**
 * Absolute links to the app's other pages, resolved in the browser.
 *
 * A static export has no idea what host it is being served from, and on GitHub
 * Pages it is not even at the domain root — so every QR code has to be built
 * from `window.location` at runtime rather than from a configured base URL.
 *
 * Two things it gets right that hand-rolled string concatenation kept getting
 * wrong: it drops the *current* page's own segment before appending (so
 * /display/ links to /play/, not /display/play/), and it carries the `?event=`
 * slot through, so a rehearsal projector sends the room into the rehearsal
 * event rather than the live one.
 */
export interface SiteUrl {
  /** Origin plus base path, no trailing slash. Empty until mounted. */
  base: string;
  /** Host and base path, for printing under a QR code. */
  display: string;
  /** Absolute URL for a path such as "play" or "breakout/grid". */
  link: (path: string) => string;
}

/** Page segments that are one level below the base path. */
const APP_SEGMENTS = ["display", "control", "summary", "play"];

export function useSiteUrl(): SiteUrl {
  const [base, setBase] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const origin = `${window.location.origin}${window.location.pathname}`
      .replace(new RegExp(`/(${APP_SEGMENTS.join("|")})/?$`), "")
      // /breakout/<slug>/ is two segments deep.
      .replace(/\/breakout\/[^/]+\/?$/, "")
      .replace(/\/$/, "");

    const slot = new URLSearchParams(window.location.search).get("event");
    setBase(origin);
    setQuery(slot ? `?event=${encodeURIComponent(slot)}` : "");
  }, []);

  return {
    base,
    display: base.replace(/^https?:\/\//, ""),
    link: (path: string) => `${base}/${path.replace(/^\/+/, "")}/${query}`,
  };
}
