"use client";

import { cx } from "@/components/primitives";
import {
  activeSegment,
  formatRemaining,
  presenterCount,
  presenterRemainingMs,
  presentingSlot,
} from "@/lib/schedule";
import { sortedBreakouts } from "@/lib/derive";
import { useServerClock } from "@/lib/useEvent";
import type { EventState } from "@/lib/types";

/**
 * The hard-timed clock for the five breakout presentations, as a floating
 * overlay over whatever else is on screen.
 *
 * This is the fallback path. On the findings board the presentation gets the
 * whole screen — `BoardMode` shows the presenting room's five findings and
 * carries the clock in its own header, because an overlay there would only
 * cover the findings it is timing. So this renders when the operator has the
 * projector on some *other* mode mid-presentation and would otherwise lose the
 * clock entirely.
 *
 * Amber at thirty seconds, red at zero, then counting up — because a clock
 * that stops at zero stops being a deadline. And red is never the only signal:
 * it says "+0:20 OVER" in words the whole time.
 */
export function PresentationOverlay({
  state,
  /** True when the mode on screen already shows the presentation itself. */
  ownedByMode = false,
}: {
  state: EventState;
  ownedByMode?: boolean;
}) {
  const { now } = useServerClock(250);
  const schedule = state.runOfShow;
  const segment = activeSegment(schedule);

  const index = presentingSlot(schedule, segment);
  if (index === null || ownedByMode) return null;

  const remaining = presenterRemainingMs(schedule, segment, now);
  if (remaining === null) return null;

  const total = presenterCount(segment);
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
