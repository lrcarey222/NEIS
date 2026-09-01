"use client";

import { Logo } from "@/components/Logo";
import { StatusDot, cx } from "@/components/primitives";
import { sortedBreakouts } from "@/lib/derive";
import {
  activeSegment,
  formatRemaining,
  isOverrun,
  nextSegment,
  projectedStarts,
  remainingMs,
  segmentIndex,
} from "@/lib/schedule";
import { useEvent, useServerClock } from "@/lib/useEvent";

/**
 * The day, on a phone. Public, no PIN.
 *
 * The projector answers "where are we" for anyone facing it; this answers it
 * for the person at the back who is wondering whether they have time for a
 * coffee. Deliberately read-only and deliberately unauthenticated — a page a
 * whole room scans cannot also be a gate, and there is nothing on it that is
 * not already on the wall.
 *
 * Phone-shaped: one column, generous tap targets, no horizontal scroll.
 */
export default function AgendaPage() {
  const { state, status } = useEvent("agenda");
  const { now } = useServerClock(1000);

  if (!state) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 text-center">
        <p className="eyebrow animate-pulse">
          {status === "connecting" ? "Loading the agenda…" : "No event yet."}
        </p>
      </main>
    );
  }

  const schedule = state.runOfShow;
  const current = activeSegment(schedule);
  const upcoming = nextSegment(schedule);
  const active = segmentIndex(schedule);
  const starts = projectedStarts(schedule.segments);
  const breakouts = sortedBreakouts(state);
  const over = isOverrun(schedule, now);
  const running = current !== null && schedule.segmentStartedAt !== null;

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6">
      <header className="mb-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <Logo className="text-paper h-6 w-auto shrink-0" />
          <StatusDot status={status} />
        </div>
        <p className="eyebrow">Run of show</p>
        <h1 className="text-paper mt-1 text-xl leading-tight font-medium">
          {state.event.title}
        </h1>
        {state.event.subtitle ? (
          <p className="text-paper-mute mt-1 text-sm">{state.event.subtitle}</p>
        ) : null}
      </header>

      {schedule.segments.length === 0 ? (
        <p className="text-paper-faint text-sm">
          No agenda has been published for this event yet.
        </p>
      ) : (
        <>
          <section className="panel rule-signal mb-3 p-4">
            <p className="eyebrow text-signal">
              {current ? "Happening now" : "Not started yet"}
            </p>
            <h2 className="text-paper mt-1 text-lg leading-tight font-semibold">
              {current?.title ?? "The session has not begun"}
            </h2>
            {current?.description ? (
              <p className="text-paper-mute mt-2 text-sm leading-relaxed">
                {current.description}
              </p>
            ) : null}
            {current?.speakers && current.speakers.length > 0 ? (
              <p className="text-paper-dim mt-2 text-sm">
                {current.speakers.join(" · ")}
              </p>
            ) : null}

            {running ? (
              <p className="mt-3 flex items-baseline gap-2">
                <span
                  className={cx(
                    "tabular font-mono text-2xl leading-none font-bold",
                    over ? "text-fragility" : "text-paper",
                  )}
                >
                  {formatRemaining(remainingMs(schedule, now))}
                </span>
                <span className="text-paper-faint font-mono text-[0.6875rem] tracking-[0.12em] uppercase">
                  {over ? "past its slot" : "remaining"}
                </span>
              </p>
            ) : null}
          </section>

          <section className="panel mb-6 p-4">
            <p className="eyebrow">Up next</p>
            <p className="text-paper-dim mt-1 text-base leading-tight font-medium">
              {upcoming ? `${starts[active + 1] ?? ""} ${upcoming.title}`.trim() : "End of the day"}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="eyebrow mb-3">The whole day</h2>
            <ol className="space-y-1">
              {schedule.segments.map((segment, index) => {
                const isActive = index === active;
                const isPast = active >= 0 && index < active;

                return (
                  <li
                    key={segment.id}
                    aria-current={isActive ? "step" : undefined}
                    className={cx(
                      "flex gap-3 rounded-sm px-3 py-2.5",
                      isActive && "bg-signal/10 border-signal/50 border",
                      isPast && "opacity-45",
                    )}
                  >
                    <span
                      className={cx(
                        "tabular w-12 shrink-0 font-mono text-xs",
                        isActive ? "text-signal font-bold" : "text-paper-faint",
                      )}
                    >
                      {starts[index]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cx(
                          "block text-sm leading-snug",
                          isActive ? "text-paper font-semibold" : "text-paper-mute",
                        )}
                      >
                        {/* Glyph as well as colour, as everywhere else. */}
                        {isPast ? "✓ " : isActive ? "▶ " : ""}
                        {segment.title}
                      </span>
                      {isActive && segment.description ? (
                        <span className="text-paper-faint mt-1 block text-xs leading-snug">
                          {segment.description}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-paper-faint tabular shrink-0 font-mono text-xs">
                      {segment.plannedMinutes}m
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}

      <section>
        <h2 className="eyebrow mb-3">Breakout rooms</h2>
        <ul className="space-y-1">
          {breakouts.map((breakout) => (
            <li key={breakout.id} className="flex items-baseline gap-3 px-3 py-2">
              <span className="text-paper flex-1 text-sm leading-snug">{breakout.name}</span>
              <span className="text-paper-faint shrink-0 font-mono text-[0.6875rem] tracking-[0.08em] uppercase">
                {breakout.shortName}
              </span>
            </li>
          ))}
        </ul>
        {/* Room PINs are deliberately not here. They are on the table cards and
            on the projected briefing, both of which are inside the room; this
            page is a public URL that anyone with the link can open. */}
        <p className="text-paper-faint mt-3 px-3 text-xs leading-relaxed">
          Your room&apos;s link and PIN are on your table card.
        </p>
      </section>

      <footer className="border-ink-500 mt-8 border-t pt-4">
        <p className="text-paper-faint text-xs leading-relaxed">
          Times update live as the session runs, so they are what is actually happening
          rather than what was printed.
        </p>
      </footer>
    </main>
  );
}
