"use client";

import { cx } from "@/components/primitives";
import {
  activeSegment,
  formatRemaining,
  isOverrun,
  projectedStarts,
  remainingMs,
  segmentIndex,
} from "@/lib/schedule";
import { useServerClock } from "@/lib/useEvent";
import type { EventState } from "@/lib/types";

/**
 * The day, as a thin band along the bottom of every display mode.
 *
 * It answers the two questions people in a room actually ask a projector —
 * where are we, and when do we break — without a slide change. Past segments
 * dim, the live one is marked with a glyph as well as a colour, and the rest
 * carry their wall-clock starts.
 *
 * The clock treatment here is the opposite of the title card's on purpose. On
 * a card there is nothing competing with the countdown so it can be large;
 * during the auction it has to be small and peripheral, because a countdown
 * arguing with the bidding is a distraction. That is also why the whole strip
 * is toggleable from /control — during the auction the screen is full.
 */
export function AgendaStrip({ state }: { state: EventState }) {
  const { now } = useServerClock(1000);
  const schedule = state.runOfShow;

  if (!schedule.agendaVisible || schedule.segments.length === 0) return null;

  const active = segmentIndex(schedule);
  const starts = projectedStarts(schedule.segments);
  const over = isOverrun(schedule, now);
  const running = activeSegment(schedule) !== null && schedule.segmentStartedAt !== null;
  const paused = schedule.pausedAt !== null;

  return (
    <div className="border-ink-500 flex shrink-0 items-stretch gap-[1em] border-t px-[1.75em] py-[0.5em]">
      {/* Time above title rather than beside it. Twelve segments across 1920px
          leaves about 150px each; spending that on one line means the time
          eats a third of it and the title truncates to nothing, which is how
          you end up projecting "12:28" next to "12:30" and no words at all. */}
      <ol className="flex min-w-0 flex-1 items-stretch gap-[0.2em]">
        {schedule.segments.map((segment, index) => {
          const isActive = index === active;
          const isPast = active >= 0 && index < active;

          return (
            <li
              key={segment.id}
              className={cx(
                "flex min-w-0 flex-1 basis-0 flex-col justify-center rounded-sm px-[0.45em] py-[0.15em]",
                // The live segment never truncates: it is the one thing on the
                // strip somebody is actually trying to read.
                isActive && "bg-signal/15 border-signal/50 shrink-0 basis-auto border",
                isPast && "opacity-35",
              )}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="flex items-baseline gap-[0.3em]">
                {/* A glyph, not just a colour — the marker has to survive a
                    washed-out projector and a colour-blind reader alike. */}
                <span
                  aria-hidden="true"
                  className={cx(
                    "shrink-0 font-mono text-[0.5em]",
                    isActive ? "text-signal" : isPast ? "text-paper-faint" : "text-ink-400",
                  )}
                >
                  {isActive ? "▶" : isPast ? "✓" : "·"}
                </span>
                <span
                  className={cx(
                    "tabular font-mono text-[0.5em] tracking-[0.06em]",
                    isActive ? "text-signal" : "text-paper-faint",
                  )}
                >
                  {starts[index]}
                </span>
              </span>
              <span
                title={segment.title}
                className={cx(
                  "truncate text-[0.625em] leading-tight",
                  isActive ? "text-paper font-semibold" : "text-paper-mute",
                )}
              >
                {segment.title}
              </span>
            </li>
          );
        })}
      </ol>

      {running ? (
        <div className="border-ink-500 flex shrink-0 items-baseline gap-[0.5em] border-l pl-[1em]">
          <span className="text-paper-faint font-mono text-[0.5625em] tracking-[0.12em] uppercase">
            {over ? "over" : paused ? "held" : "left"}
          </span>
          <span
            className={cx(
              "tabular font-mono text-[0.875em] leading-none font-bold",
              over ? "text-fragility" : "text-paper-dim",
              paused && !over && "opacity-60",
            )}
          >
            {formatRemaining(remainingMs(schedule, now))}
          </span>
        </div>
      ) : null}
    </div>
  );
}
