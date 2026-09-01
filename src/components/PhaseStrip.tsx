"use client";

import { cx } from "@/components/primitives";
import {
  activeSegment,
  elapsedMs,
  formatRemaining,
  phaseViews,
} from "@/lib/schedule";
import { useServerClock } from "@/lib/useEvent";
import type { EventState } from "@/lib/types";

/**
 * The breakout's own run of show, above the cards.
 *
 * This is the mitigation for the biggest risk in the day: a room that talks
 * for seventy minutes and then finds it has five to write in. The phase at
 * minute 35 says "open your cards and start typing headlines now", and the
 * whole point of this component is that it is impossible to miss — its note is
 * the largest text in the strip, not a tooltip.
 *
 * Rendered only when the live segment actually has phases, so it appears when
 * the operator opens the breakouts and disappears on its own afterwards.
 */
export function PhaseStrip({ state }: { state: EventState }) {
  const { now } = useServerClock(1000);
  const schedule = state.runOfShow;
  const segment = activeSegment(schedule);
  const elapsed = elapsedMs(schedule, now);
  const views = phaseViews(segment, elapsed);

  if (views.length === 0 || schedule.segmentStartedAt === null) return null;

  const current = views.find((view) => view.state === "current")!;
  const paused = schedule.pausedAt !== null;
  const over = current.remainingMs < 0;

  return (
    <section className="panel mb-6 overflow-hidden" aria-label="Session run of show">
      <header className="border-ink-500 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b p-3">
        <div className="min-w-0">
          <p className="eyebrow text-signal">
            Now — step {current.index + 1} of {views.length}
            {paused ? " · held" : ""}
          </p>
          <p className="text-paper mt-0.5 text-lg leading-tight font-semibold">
            {current.phase.title}
          </p>
        </div>

        <p
          className={cx(
            "tabular shrink-0 font-mono text-2xl leading-none font-bold",
            over ? "text-fragility" : "text-paper",
            paused && !over && "opacity-60",
          )}
        >
          {formatRemaining(current.remainingMs)}
          <span className="text-paper-faint ml-2 font-mono text-[0.6875rem] tracking-[0.12em] uppercase">
            {over ? "over" : "left in this step"}
          </span>
        </p>
      </header>

      {/* The instruction, at the size of the thing it is telling you to do. */}
      {current.phase.note ? (
        <p className="border-signal/50 text-paper border-l-2 px-3 py-3 text-base leading-snug font-medium">
          {current.phase.note}
        </p>
      ) : null}

      <ol className="border-ink-500 flex flex-wrap gap-x-1 gap-y-1 border-t p-2">
        {views.map((view) => (
          <li
            key={view.index}
            className={cx(
              "flex min-w-0 flex-1 items-baseline gap-1.5 rounded-sm px-2 py-1",
              view.state === "current"
                ? "bg-signal/15 border-signal/50 border"
                : view.state === "past"
                  ? "opacity-40"
                  : "",
            )}
            aria-current={view.state === "current" ? "step" : undefined}
          >
            {/* Glyph as well as colour, as everywhere else in the app. */}
            <span
              aria-hidden="true"
              className={cx(
                "shrink-0 font-mono text-[0.625rem]",
                view.state === "current"
                  ? "text-signal"
                  : view.state === "past"
                    ? "text-paper-faint"
                    : "text-ink-400",
              )}
            >
              {view.state === "current" ? "▶" : view.state === "past" ? "✓" : "·"}
            </span>
            <span
              title={view.phase.title}
              className={cx(
                "truncate text-xs leading-tight",
                view.state === "current"
                  ? "text-paper font-semibold"
                  : "text-paper-mute",
              )}
            >
              {view.phase.title}
            </span>
            <span className="text-paper-faint tabular ml-auto shrink-0 font-mono text-[0.625rem]">
              {view.phase.minutes}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
