"use client";

import { useEffect, useState } from "react";

import type { TimerState } from "@/lib/types";
import { cx } from "./primitives";

/**
 * Renders the shared countdown.
 *
 * The server stores only an absolute end time, so every screen computes the
 * same remaining value independently and no screen can drift out of sync with
 * the projector.
 */
export function useCountdown(timer: TimerState): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer.running]);

  if (timer.running && timer.endsAt) return Math.max(0, timer.endsAt - now);
  if (!timer.running && timer.pausedRemainingMs !== null) return timer.pausedRemainingMs;
  return null;
}

export function formatDuration(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function CountdownDisplay({
  timer,
  size = "md",
}: {
  timer: TimerState;
  size?: "sm" | "md" | "lg";
}) {
  const remaining = useCountdown(timer);
  if (remaining === null) return null;

  const expired = remaining === 0;
  // Under a minute the clock turns amber; at zero it goes red and stays put
  // rather than counting into negative time.
  const urgent = remaining <= 60_000 && !expired;

  const sizing = {
    sm: "text-xl",
    md: "text-3xl",
    lg: "text-[2.75em]",
  }[size];

  return (
    <div className="flex flex-col items-end">
      {timer.label ? (
        <span className="text-paper-faint font-mono text-[0.625em] tracking-[0.14em] uppercase">
          {timer.label}
        </span>
      ) : null}
      <span
        className={cx(
          "tabular font-mono leading-none font-bold",
          sizing,
          expired ? "text-fragility" : urgent ? "text-signal" : "text-paper",
          !timer.running && !expired && "opacity-60",
        )}
        aria-live={urgent || expired ? "polite" : "off"}
      >
        {expired ? "TIME" : formatDuration(remaining)}
      </span>
    </div>
  );
}
