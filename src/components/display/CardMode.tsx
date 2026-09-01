"use client";

import { cx } from "@/components/primitives";
import {
  activeSegment,
  formatRemaining,
  isOverrun,
  nextSegment,
  remainingMs,
} from "@/lib/schedule";
import { useServerClock } from "@/lib/useEvent";
import type { EventState } from "@/lib/types";

/**
 * The segment title card.
 *
 * This is what fills 8:30 to 9:40 — the welcome, the opening panel, the
 * transitions and the close — where the projector previously had nothing to
 * show but a findings board with nothing on it.
 *
 * On a title card the clock can be large, because nothing is competing with
 * it. That is deliberately not true of the auction: see AgendaStrip, where the
 * same information is deliberately peripheral.
 */
export function CardMode({ state }: { state: EventState }) {
  const { now } = useServerClock(250);
  const schedule = state.runOfShow;
  const segment = activeSegment(schedule);
  const upcoming = nextSegment(schedule);
  const started = schedule.segmentStartedAt !== null;
  const over = isOverrun(schedule, now);
  const paused = schedule.pausedAt !== null;

  if (!segment) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-[1.75em] pb-[1.25em]">
        <div className="max-w-[40em] text-center">
          <p className="eyebrow mb-[0.5em]">Standing by</p>
          <h2 className="text-paper text-[2.5em] leading-tight font-semibold text-balance">
            {state.event.title}
          </h2>
          {state.event.subtitle ? (
            <p className="text-paper-mute mt-[0.5em] text-[1em]">{state.event.subtitle}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-[3em] pb-[1.25em]">
      <div className="max-w-[46em]">
        <p className="eyebrow text-signal mb-[0.6em]">
          {segment.plannedStart ? `${segment.plannedStart} · ` : ""}
          {segment.plannedMinutes} minutes
        </p>

        <h2 className="text-paper text-[4em] leading-[1.02] font-bold tracking-tight text-balance">
          {segment.title}
        </h2>

        {segment.description ? (
          <p className="text-paper-dim mt-[0.6em] max-w-[26em] text-[1.375em] leading-snug">
            {segment.description}
          </p>
        ) : null}

        {segment.speakers && segment.speakers.length > 0 ? (
          <ul className="mt-[1.4em] flex flex-wrap gap-x-[1.75em] gap-y-[0.6em]">
            {segment.speakers.map((speaker) => (
              <li
                key={speaker}
                className="border-signal/50 text-paper border-l-[0.15em] pl-[0.6em] text-[1.25em] leading-tight font-medium"
              >
                {speaker}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* The clock, and what the room is moving to next. */}
      <div className="border-ink-500 mt-[2em] flex items-end justify-between gap-[2em] border-t pt-[1em]">
        <div className="min-w-0">
          <p className="eyebrow">Next</p>
          <p className="text-paper-mute mt-[0.2em] truncate text-[1.125em] font-medium">
            {upcoming?.title ?? "End of the day"}
          </p>
        </div>

        {started ? (
          <div className="shrink-0 text-right">
            <p className="eyebrow">
              {over ? "Over by" : paused ? "Held" : "Remaining"}
            </p>
            <p
              className={cx(
                "tabular font-mono text-[3em] leading-none font-bold",
                over ? "text-fragility" : "text-paper",
                paused && !over && "opacity-60",
              )}
            >
              {formatRemaining(remainingMs(schedule, now))}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
