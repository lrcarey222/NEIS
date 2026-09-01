"use client";

import { useState } from "react";

import { cx } from "@/components/primitives";
import {
  advancePresenter,
  advanceSegment,
  extendSegment,
  resetPresenterTimer,
  toggleSchedulePause,
} from "@/lib/actions";
import {
  activeSegment,
  describeDrift,
  driftMs,
  formatRemaining,
  isOverrun,
  nextSegment,
  presenterCount,
  presenterRemainingMs,
  remainingMs,
} from "@/lib/schedule";
import { useServerClock } from "@/lib/useEvent";
import type { EventState } from "@/lib/types";

/**
 * Where the day has got to, across the top of /control on every tab.
 *
 * This cannot live inside a tab. The operator is on the Auction tab recording
 * bids while the clock runs, and a countdown they have to navigate away from
 * is a countdown nobody looks at.
 *
 * Four things, in the order the operator needs them: what is running, how long
 * is left, how far behind the day is, and what comes next. Then the three
 * controls, of which only NEXT SEGMENT is confirmed — it moves the projector in
 * front of the room, and the other two do not.
 */
export function RunOfShowBar({ state }: { state: EventState }) {
  const { now, offsetMs } = useServerClock(250);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const schedule = state.runOfShow;
  const current = activeSegment(schedule);
  const upcoming = nextSegment(schedule);
  const paused = schedule.pausedAt !== null;
  const started = schedule.segmentStartedAt !== null;

  const remaining = remainingMs(schedule, now);
  const over = isOverrun(schedule, now);
  const drift = driftMs(schedule, now);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    const result = await action();
    setError(result.ok ? null : (result.error ?? "Could not update the schedule."));
  }

  // An event created before schema 3, or one whose agenda has been cleared.
  if (schedule.segments.length === 0) {
    return (
      <div className="panel text-paper-faint mb-4 px-3 py-2 text-xs">
        No run of show loaded. Add one from the{" "}
        <strong className="text-paper-mute">Run of Show</strong> tab.
      </div>
    );
  }

  return (
    <div className="panel mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="eyebrow">
          {current ? "Now" : "Not started"}
          {paused ? <span className="text-signal"> · held</span> : null}
        </p>
        <p className="text-paper truncate text-base leading-tight font-semibold">
          {current?.title ?? "Press NEXT SEGMENT to open the day"}
        </p>
      </div>

      {/* The clock. Text, not colour: "+3:20 OVER" reads the same to an
          operator who cannot tell amber from red at a glance. */}
      <div className="shrink-0 text-right">
        <p className="eyebrow">{over ? "Over by" : "Remaining"}</p>
        <p
          className={cx(
            "tabular font-mono text-2xl leading-none font-bold",
            over ? "text-fragility" : "text-paper",
            paused && "opacity-60",
          )}
          aria-live="off"
        >
          {started ? formatRemaining(remaining) : "—:—"}
        </p>
      </div>

      {/* The single most useful number the operator can have. */}
      <div className="border-ink-500 shrink-0 border-l pl-5 text-right">
        <p className="eyebrow">Schedule</p>
        <p
          className={cx(
            "font-mono text-sm leading-none font-bold tracking-[0.06em] uppercase",
            !started
              ? "text-paper-faint"
              : Math.abs(drift) < 60_000
                ? "text-momentum"
                : drift > 0
                  ? "text-fragility"
                  : "text-signal",
          )}
        >
          {started ? describeDrift(drift) : "—"}
        </p>
      </div>

      <div className="border-ink-500 min-w-0 shrink-0 border-l pl-5">
        <p className="eyebrow">Next</p>
        <p className="text-paper-mute max-w-[16rem] truncate text-sm font-medium">
          {upcoming?.title ?? "End of the day"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost px-3 py-1.5 text-xs"
          disabled={!started}
          onClick={() => void run(() => toggleSchedulePause(state, offsetMs))}
        >
          {paused ? "▶ Resume" : "❚❚ Pause"}
        </button>
        <button
          type="button"
          className="btn btn-ghost px-3 py-1.5 text-xs"
          disabled={!current}
          onClick={() => void run(() => extendSegment(state, 5))}
          title="Lengthens this segment, so the knock-on shows in the drift and the wall-clock starts"
        >
          +5 min
        </button>

        {confirming ? (
          <span className="flex items-center gap-2">
            <span className="text-paper-mute max-w-[14rem] text-xs leading-snug">
              Move the big screen to{" "}
              <strong className="text-paper">{upcoming?.title}</strong>?
            </span>
            <button
              type="button"
              className="btn btn-ghost px-2.5 py-1.5 text-xs"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary px-3 py-1.5 text-xs"
              onClick={() => {
                setConfirming(false);
                void run(() => advanceSegment(state, offsetMs));
              }}
            >
              Confirm
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="btn btn-primary px-3 py-1.5 text-xs"
            disabled={!upcoming}
            onClick={() => setConfirming(true)}
          >
            Next segment →
          </button>
        )}
      </div>

      {current?.presentationTimer ? (
        <PresenterControls state={state} now={now} offsetMs={offsetMs} onError={setError} />
      ) : null}

      {error ? (
        <p role="alert" className="text-fragility w-full text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The hard-timed sub-clock for the five breakout presentations.
 *
 * A second row rather than a second screen: the operator is watching five
 * people stand up in fifteen minutes and cannot be navigating between tabs to
 * start each clock. The roster of pips is there so a glance answers "how many
 * are left" without counting.
 */
function PresenterControls({
  state,
  now,
  offsetMs,
  onError,
}: {
  state: EventState;
  now: number;
  offsetMs: number;
  onError: (message: string | null) => void;
}) {
  const schedule = state.runOfShow;
  const segment = activeSegment(schedule);
  const total = presenterCount(segment);
  const remaining = presenterRemainingMs(schedule, segment, now);
  const done = Math.max(0, Math.min(total, schedule.presenterIndex));
  const finished = schedule.presenterIndex >= total;

  const breakouts = [...state.breakouts].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentName =
    schedule.presenterIndex >= 0
      ? (breakouts[schedule.presenterIndex]?.shortName ??
        `Presenter ${schedule.presenterIndex + 1}`)
      : null;

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    const result = await action();
    onError(result.ok ? null : (result.error ?? "Could not update the timer."));
  }

  return (
    <div className="border-ink-500 flex w-full flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
      <span className="eyebrow text-signal">Presentations</span>

      <ol className="flex items-center gap-1.5" aria-label="Presenters">
        {Array.from({ length: total }, (_, index) => (
          <li
            key={index}
            title={breakouts[index]?.name ?? `Presenter ${index + 1}`}
            className={cx(
              "tabular rounded-sm px-1.5 py-0.5 font-mono text-[0.625rem] font-bold tracking-[0.1em] uppercase",
              index < done
                ? "bg-ink-600 text-paper-faint line-through"
                : index === schedule.presenterIndex
                  ? "bg-signal text-ink-900"
                  : "border-ink-400 text-paper-mute border",
            )}
          >
            {breakouts[index]?.shortName.slice(0, 4) ?? index + 1}
          </li>
        ))}
      </ol>

      <span className="text-paper-mute font-mono text-[0.6875rem] tracking-[0.1em] uppercase">
        {finished ? "all done" : `${done} done · ${total - done} to go`}
      </span>

      {remaining !== null ? (
        <span className="flex items-baseline gap-2">
          <span className="text-paper text-sm font-semibold">{currentName}</span>
          <span
            className={cx(
              "tabular font-mono text-lg leading-none font-bold",
              remaining < 0
                ? "text-fragility"
                : remaining <= 30_000
                  ? "text-signal"
                  : "text-paper",
            )}
          >
            {formatRemaining(remaining)}
          </span>
        </span>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost px-2.5 py-1 text-xs"
          onClick={() => void run(() => resetPresenterTimer())}
        >
          Reset
        </button>
        <button
          type="button"
          className="btn btn-primary px-3 py-1.5 text-xs"
          disabled={finished}
          onClick={() => void run(() => advancePresenter(state, offsetMs))}
        >
          {schedule.presenterIndex < 0 ? "Start presenter 1" : "Next presenter →"}
        </button>
      </div>
    </div>
  );
}
