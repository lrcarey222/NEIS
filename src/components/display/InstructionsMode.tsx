"use client";

import { useMemo } from "react";

import { QrCode } from "@/components/QrCode";
import { cx } from "@/components/primitives";
import { panelRoles, roundCount, sortedBreakouts } from "@/lib/derive";
import { useSiteUrl } from "@/lib/useSiteUrl";
import { FINDING_TYPES, FINDING_TYPE_META } from "@/lib/types";
import type { EventState } from "@/lib/types";

/**
 * Mode 5 — the briefing screen.
 *
 * This is what is on the projector while the room is being seated and while
 * the moderator explains the exercise: how to get into your breakout, what the
 * five findings are, and what happens to them afterwards. It carries the room
 * PINs, because the failure mode this screen exists to prevent is a table that
 * never finds its link.
 */
export function InstructionsMode({ state }: { state: EventState }) {
  const breakouts = useMemo(() => sortedBreakouts(state), [state]);
  const roles = useMemo(() => panelRoles(state), [state]);
  const rounds = roundCount(state);
  const site = useSiteUrl();

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-[1.75em] pb-[1.25em]">
      <div className="mb-[0.8em] flex items-end justify-between gap-[2em]">
        <div>
          <p className="eyebrow text-signal">How this session works</p>
          <h2 className="text-paper mt-[0.15em] text-[1.75em] leading-none font-semibold">
            Scan your table&apos;s code to open your breakout
          </h2>
        </div>
        <p className="text-paper-mute font-mono text-[0.6875em] tracking-[0.12em] uppercase">
          {breakouts.length} breakouts
          <span className="text-paper-faint"> · </span>5 findings each
          <span className="text-paper-faint"> · </span>then the auction
        </p>
      </div>

      <section className="flex min-h-0 flex-1 flex-col">
        <StepHeading
          number={1}
          title="Join your breakout"
          note="Everyone at the table can be in at once — each field saves separately, so you will not overwrite each other."
        />

        <div
          className="grid flex-1 gap-[0.75em]"
          style={{
            gridTemplateColumns: `repeat(${Math.max(breakouts.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {breakouts.map((breakout) => (
            <article
              key={breakout.id}
              className="panel flex min-h-0 flex-col items-center p-[0.75em]"
            >
              {/* Sized off the card's width and centred in whatever height the
                  row has left, so the code stays square and stays the largest
                  thing on the card — it has to be scannable from a seat away. */}
              <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                <QrCode
                  url={site.link(`breakout/${breakout.slug}`)}
                  className="w-full max-w-[14em] p-[0.35em]"
                />
              </div>
              <h3 className="text-paper mt-[0.6em] text-center text-[0.875em] leading-tight font-semibold text-balance">
                {breakout.name}
              </h3>
              <p className="text-paper-faint mt-[0.35em] text-center font-mono text-[0.5625em] leading-snug break-all">
                {site.display}/breakout/{breakout.slug}/
              </p>
              <p className="mt-[0.5em] font-mono text-[0.6875em] tracking-[0.12em] uppercase">
                <span className="text-paper-faint">PIN </span>
                <span className="text-signal tabular font-bold">
                  {breakout.pin || "on your table card"}
                </span>
              </p>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-[0.9em] grid shrink-0 grid-cols-[1.5fr_1fr_1.15fr] gap-[0.75em]">
        <section className="panel p-[0.75em]">
          <StepHeading number={2} title="Agree five findings — one of each type" compact />
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

        <section className="panel p-[0.75em]">
          <StepHeading number={3} title="Submit to the board" compact />
          <ul className="text-paper-mute mt-[0.5em] space-y-[0.35em] text-[0.75em] leading-snug">
            <Bullet>
              Everything saves automatically when you leave a field. There is no save
              button.
            </Bullet>
            <Bullet>
              Use <span className="text-paper-dim font-semibold">↑ / ↓</span> to rank your
              five findings 1–5.
            </Bullet>
            <Bullet>
              <span className="text-paper-dim font-semibold">Submit findings</span> puts them
              on the big screen. After that, corrections go through the operator.
            </Bullet>
          </ul>
        </section>

        <section className="panel p-[0.75em]">
          <StepHeading number={4} title="Then: the draft" compact />
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
              mid-auction, so people know to keep their phones out. */}
          {state.event.audienceOpen ? (
            <div className="border-ink-500 mt-[0.6em] flex items-center gap-[0.6em] border-t pt-[0.6em]">
              <QrCode url={site.link("play")} className="w-[4em] shrink-0 p-[0.2em]" />
              <p className="text-paper-mute text-[0.6875em] leading-snug">
                <span className="text-signal font-semibold">You play too.</span> Scan this
                during the draft to spend your own {state.event.audienceBudget} credits. We
                compare the room against the panel at the end.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
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
