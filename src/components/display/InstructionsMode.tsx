"use client";

import { useMemo } from "react";

import { QrCode } from "@/components/QrCode";
import { cx } from "@/components/primitives";
import { panelRoles, roundCount, sortedBreakouts } from "@/lib/derive";
import { segmentIndex } from "@/lib/schedule";
import { useSiteUrl } from "@/lib/useSiteUrl";
import { AUCTION_RANK_LIMIT, FINDING_TYPES, FINDING_TYPE_META } from "@/lib/types";
import type { EventState } from "@/lib/types";

/**
 * Mode 5 — the briefing screen.
 *
 * What is on the projector while the room is being seated and while the
 * moderator explains the exercise: what the five findings are, what happens to
 * them, and where the day goes.
 *
 * It used to open with a grid of five QR codes for joining the breakouts. Those
 * are gone: the room link and PIN are on the table card, which is in front of
 * the person who needs them, and the codes were taking two thirds of a screen
 * whose actual job is explaining the exercise. The run of show moved here for
 * the same reason — a code that has to be scanned to answer "when is lunch" is
 * a worse answer than the agenda being on the wall.
 */
export function InstructionsMode({ state }: { state: EventState }) {
  const breakouts = useMemo(() => sortedBreakouts(state), [state]);
  const roles = useMemo(() => panelRoles(state), [state]);
  const rounds = roundCount(state);
  const site = useSiteUrl();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-[1.75em] pb-[1.25em]">
      <div className="mb-[0.8em] flex shrink-0 items-end justify-between gap-[2em]">
        <div>
          <p className="eyebrow text-signal">How this session works</p>
          <h2 className="text-paper mt-[0.15em] text-[1.75em] leading-none font-semibold">
            Five rooms, five findings each, one auction
          </h2>
        </div>
        <p className="text-paper-mute font-mono text-[0.6875em] tracking-[0.12em] uppercase">
          {breakouts.length} breakouts
          <span className="text-paper-faint"> · </span>5 findings each
          <span className="text-paper-faint"> · </span>top {AUCTION_RANK_LIMIT} to the auction
        </p>
      </div>

      {/* The three steps size to their content; the day gets the rest of the
          screen. It is the thing people look up at between sessions, so it is
          the thing that should be big. */}
      <div className="grid shrink-0 grid-cols-[1.5fr_1fr_1.15fr] gap-[0.75em]">
        <section className="panel flex flex-col p-[0.75em]">
          <StepHeading number={1} title="Agree five findings — one of each type" compact />
          <ul className="mt-[0.5em] space-y-[0.3em]">
            {FINDING_TYPES.map((type) => {
              const meta = FINDING_TYPE_META[type];
              return (
                <li key={type} data-type={type} className="flex items-baseline gap-[0.5em]">
                  <span
                    aria-hidden="true"
                    className="type-text w-[1em] shrink-0 text-center text-[0.8125em]"
                  >
                    {meta.glyph}
                  </span>
                  <span className="text-paper w-[10em] shrink-0 text-[0.8125em] leading-snug font-semibold">
                    {meta.label}
                  </span>
                  <span className="text-paper-mute text-[0.75em] leading-snug">
                    {meta.blurb}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel flex flex-col p-[0.75em]">
          <StepHeading number={2} title="Submit to the board" compact />
          <ul className="text-paper-mute mt-[0.5em] space-y-[0.35em] text-[0.75em] leading-snug">
            <Bullet>
              Everything saves automatically when you leave a field. There is no save
              button.
            </Bullet>
            <Bullet>
              Use <span className="text-paper-dim font-semibold">↑ / ↓</span> to rank your
              five findings 1–5. Your{" "}
              <span className="text-paper-dim font-semibold">
                top {AUCTION_RANK_LIMIT}
              </span>{" "}
              go to the auction — rank carefully.
            </Bullet>
            <Bullet>
              <span className="text-paper-dim font-semibold">Submit findings</span> puts them
              on the big screen. After that, corrections go through the operator.
            </Bullet>
          </ul>
        </section>

        <section className="panel flex flex-col p-[0.75em]">
          <StepHeading number={3} title="Then: the draft" compact />
          <p className="text-paper-mute mt-[0.5em] text-[0.75em] leading-snug">
            The panel bids{" "}
            <span className="text-paper-dim font-semibold">
              {state.event.startingBudget} credits
            </span>{" "}
            each over {rounds} rounds. Any finding, for any reason — each panelist is
            building the strongest set for one question:
          </p>
          {roles.length ? (
            <ul className="mt-[0.4em] space-y-[0.25em]">
              {roles.map((role) => (
                <li key={role.name} className="flex items-baseline gap-[0.5em]">
                  <span className="text-signal w-[7em] shrink-0 font-mono text-[0.625em] font-semibold tracking-[0.08em] uppercase">
                    {role.name}
                  </span>
                  <span className="text-paper-mute line-clamp-2 text-[0.6875em] leading-snug italic">
                    {role.prompt || "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-paper-faint mt-[0.4em] text-[0.75em]">
              Panelist roles are set on the control screen.
            </p>
          )}

          {/* The play-along is announced here rather than sprung on the room
              mid-auction, so people know to keep their phones out. This is the
              one code left on the screen, because it is the only thing here
              that is not already on the table card. */}
          {state.event.audienceOpen ? (
            <div className="border-ink-500 mt-auto flex items-center gap-[0.6em] border-t pt-[0.6em]">
              <QrCode url={site.link("play")} className="w-[4.5em] shrink-0 p-[0.2em]" />
              <p className="text-paper-mute text-[0.6875em] leading-snug">
                <span className="text-signal font-semibold">You play too.</span> Scan this
                during the draft to spend your own {state.event.audienceBudget} credits. We
                compare the room against the panel at the end.
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <RunOfShow state={state} />
    </div>
  );
}

/**
 * The day, on the briefing screen.
 *
 * This is the wall answer to "when is lunch", which is otherwise asked of a
 * neighbour every ten minutes. Planned wall-clock times rather than live
 * projected ones: this screen is up before the day starts and during the
 * seating, when the schedule has not drifted yet and a time that moves would
 * only look like a mistake. The live version — what is actually running, and
 * how far behind — is the agenda strip along the bottom of every other mode.
 */
function RunOfShow({ state }: { state: EventState }) {
  const segments = state.runOfShow.segments;
  if (segments.length === 0) return null;

  const active = segmentIndex(state.runOfShow);
  // Down the columns, not across: a day reads top-to-bottom, and column-major
  // flow keeps the morning together instead of interleaving it with the
  // afternoon. Two columns beat one long list at 16:9 by roughly double the
  // type size.
  const rows = Math.ceil(segments.length / 2);

  return (
    <section className="mt-[0.9em] flex min-h-0 flex-1 flex-col">
      <p className="eyebrow mb-[0.5em] shrink-0">The run of show</p>
      <ol
        className="grid min-h-0 flex-1 grid-flow-col gap-x-[1.5em] gap-y-[0.15em]"
        style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {segments.map((segment, index) => {
          const isActive = index === active;
          const isPast = active >= 0 && index < active;

          return (
            <li
              key={segment.id}
              aria-current={isActive ? "step" : undefined}
              className={cx(
                "flex min-w-0 items-center gap-[0.75em] rounded-sm px-[0.5em]",
                isActive && "bg-signal/15 border-signal/50 border",
                isPast && "opacity-40",
              )}
            >
              <span
                className={cx(
                  "tabular w-[3.5em] shrink-0 font-mono text-[0.8125em] font-bold tracking-[0.04em]",
                  isActive ? "text-signal" : "text-paper-faint",
                )}
              >
                {segment.plannedStart}
              </span>
              <span
                className={cx(
                  "min-w-0 flex-1 truncate text-[0.9375em] leading-tight",
                  isActive ? "text-paper font-semibold" : "text-paper-mute",
                )}
              >
                {/* Glyph as well as colour, as everywhere else. */}
                {isPast ? "✓ " : isActive ? "▶ " : ""}
                {segment.title}
              </span>
              <span className="text-paper-faint tabular shrink-0 font-mono text-[0.75em]">
                {segment.plannedMinutes}m
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StepHeading({
  number,
  title,
  note,
  compact = false,
}: {
  number: number;
  title: string;
  note?: string;
  compact?: boolean;
}) {
  return (
    <div className={cx("flex items-baseline gap-[0.6em]", compact ? "mb-0" : "mb-[0.6em]")}>
      <span
        className={cx(
          "border-signal text-signal tabular flex shrink-0 items-center justify-center border font-mono font-bold",
          compact
            ? "h-[1.5em] w-[1.5em] text-[0.6875em]"
            : "h-[1.6em] w-[1.6em] text-[0.75em]",
        )}
        aria-hidden="true"
      >
        {number}
      </span>
      <h3
        className={cx(
          "text-paper leading-none font-semibold",
          compact ? "text-[0.875em]" : "text-[1em]",
        )}
      >
        <span className="sr-only">Step {number}. </span>
        {title}
      </h3>
      {note ? (
        <p className="text-paper-mute truncate text-[0.75em] leading-snug">{note}</p>
      ) : null}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-[0.5em]">
      <span aria-hidden="true" className="text-paper-faint shrink-0 select-none">
        —
      </span>
      <span>{children}</span>
    </li>
  );
}
