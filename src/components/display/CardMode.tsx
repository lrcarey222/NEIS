"use client";

import { QrCode } from "@/components/QrCode";
import { cx } from "@/components/primitives";
import { submittedEntries } from "@/lib/derive";
import {
  activeSegment,
  formatRemaining,
  isOverrun,
  nextSegment,
  remainingMs,
} from "@/lib/schedule";
import { useServerClock } from "@/lib/useEvent";
import { useSiteUrl } from "@/lib/useSiteUrl";
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

  const playAlong = segment.audienceQr === true;

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-[3em] pb-[1.25em]">
      <div className="flex min-h-0 items-center gap-[3em]">
        <div className={cx("min-w-0", playAlong ? "flex-1" : "max-w-[46em]")}>
          <p className="eyebrow text-signal mb-[0.6em]">
            {segment.plannedStart ? `${segment.plannedStart} · ` : ""}
            {segment.plannedMinutes} minutes
          </p>

          <h2
            className={cx(
              "text-paper leading-[1.02] font-bold tracking-tight text-balance",
              // The code has to be scannable from the back of the room, so on a
              // play-along card the title gives up the width, not the QR.
              playAlong ? "text-[3em]" : "text-[4em]",
            )}
          >
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

        {playAlong ? <PlayAlongPanel state={state} /> : null}
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

/**
 * The play-along, on the title card of a segment that has nothing else to do.
 *
 * The transition and seating is the only ten minutes in the day when the whole
 * room is holding a phone and waiting — so it is where the play-along gets its
 * best shot at a crowd, well before the draft it belongs to. The code stays up
 * whether or not /play is open yet: a phone that lands early is told to keep
 * the page open, and it unlocks itself when the operator opens the draft.
 */
function PlayAlongPanel({ state }: { state: EventState }) {
  const site = useSiteUrl();
  const joined = state.audience.length;
  const submitted = submittedEntries(state).length;

  return (
    <section className="panel flex w-[19em] shrink-0 flex-col items-center p-[1.25em] text-center">
      <p className="eyebrow text-signal">You play too</p>
      <QrCode
        url={site.link("play")}
        className="mt-[0.75em] w-full p-[0.5em]"
        label="Scan to play along"
      />
      <p className="text-paper mt-[0.75em] text-[1.125em] leading-snug font-semibold text-balance">
        Draft your own {state.event.audienceBudget} credits against the panel
      </p>
      <p className="text-paper-faint mt-[0.4em] font-mono text-[0.6875em] leading-snug break-all">
        {site.display}/play/
      </p>
      {joined > 0 ? (
        <p className="border-ink-500 mt-[0.75em] w-full border-t pt-[0.6em]">
          <span className="tabular text-signal font-mono text-[1.75em] leading-none font-bold">
            {joined}
          </span>
          <span className="text-paper-mute ml-[0.4em] font-mono text-[0.6875em] tracking-[0.1em] uppercase">
            in{submitted > 0 ? ` · ${submitted} submitted` : ""}
          </span>
        </p>
      ) : (
        <p className="text-paper-mute mt-[0.75em] text-[0.8125em] leading-snug">
          Scan now — the room is compared against the panel at the end.
        </p>
      )}
    </section>
  );
}
