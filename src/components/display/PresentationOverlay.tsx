"use client";

import { cx } from "@/components/primitives";
import {
  activeSegment,
  formatRemaining,
  presenterCount,
  presenterRemainingMs,
} from "@/lib/schedule";
import { sortedBreakouts } from "@/lib/derive";
import { useServerClock } from "@/lib/useEvent";
import type { EventState } from "@/lib/types";

/**
 * The hard-timed clock for the five breakout presentations.
 *
 * Overlays the findings board rather than replacing it: the room needs to see
 * the presenter's own findings behind the clock, so the board is dimmed and
 * the timer sits over it instead of taking the screen.
 *
 * Amber at thirty seconds, red at zero, then counting up — because a clock
 * that stops at zero stops being a deadline. And red is never the only signal:
 * it says "+0:20 OVER" in words the whole time.
 */
export function PresentationOverlay({ state }: { state: EventState }) {
  const { now } = useServerClock(250);
  const schedule = state.runOfShow;
  const segment = activeSegment(schedule);

  if (!segment?.presentationTimer) return null;

  const remaining = presenterRemainingMs(schedule, segment, now);
  if (remaining === null) return null;

  const total = presenterCount(segment);
  const index = schedule.presenterIndex;
  const breakouts = sortedBreakouts(state);
  const breakout = breakouts[index];
  const over = remaining < 0;
  const urgent = !over && remaining <= 30_000;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center pb-[3em]">
      <div className="border-ink-400 bg-ink-900/95 flex items-center gap-[2em] rounded-sm border px-[2em] py-[1em] shadow-2xl backdrop-blur-sm">
        <div className="min-w-[14em]">
          <p className="eyebrow text-signal">
            Presenting · {index + 1} of {total}
          </p>
          <p className="text-paper mt-[0.2em] text-[1.75em] leading-none font-bold">
            {breakout?.shortName ?? `Presenter ${index + 1}`}
          </p>
          {breakout ? (
            <p className="text-paper-mute mt-[0.35em] text-[0.75em] leading-tight">
              {breakout.name}
            </p>
          ) : null}
        </div>

        <div className="border-ink-500 border-l pl-[2em] text-right">
          <p
            className={cx(
              "tabular font-mono text-[3.5em] leading-none font-bold",
              over ? "text-fragility" : urgent ? "text-signal" : "text-paper",
            )}
            aria-live="off"
          >
            {formatRemaining(remaining)}
          </p>
        </div>

        {/* How many are done, without counting. */}
        <ol className="border-ink-500 flex flex-col gap-[0.3em] border-l pl-[1.5em]">
          {Array.from({ length: total }, (_, seat) => (
            <li
              key={seat}
              className={cx(
                "flex items-center gap-[0.5em] font-mono text-[0.625em] tracking-[0.1em] uppercase",
                seat < index
                  ? "text-paper-faint"
                  : seat === index
                    ? "text-signal font-bold"
                    : "text-paper-mute",
              )}
            >
              <span aria-hidden="true">{seat < index ? "✓" : seat === index ? "▶" : "·"}</span>
              {breakouts[seat]?.shortName ?? `Presenter ${seat + 1}`}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
