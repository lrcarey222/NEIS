"use client";

import { useMemo } from "react";

import { QrCode } from "@/components/QrCode";
import { cx } from "@/components/primitives";
import { buildAudienceSummary, type AudienceStat } from "@/lib/derive";
import { useSiteUrl } from "@/lib/useSiteUrl";
import { FINDING_TYPE_META, type EventState } from "@/lib/types";

/**
 * Mode 4 — Audience vs Panel. The closing screen.
 *
 * The panel spent its credits in public, one finding at a time, with everyone
 * watching. The room spent its own credits privately, at the same time, on the
 * same board. This puts the two side by side, and does nothing else: one list,
 * one row per finding, ranked by the room. The moderator is talking over this
 * screen, and a screen with three panels and a role strip on it was competing
 * with them for the room's attention instead of holding a single argument up.
 *
 * The comparison only works because both numbers mean the same thing: a panel
 * price is what one participant paid for one finding, and the audience figure
 * is credits-per-participant, counting the people who gave a finding nothing.
 * Averaging over backers instead would let two enthusiasts outrank the room.
 *
 * The cuts that used to sit beside this — biggest gap each way, top pick per
 * role — are still computed in `buildAudienceSummary` and still exported to the
 * CSV and the printable summary, which is where a number you want to read twice
 * belongs anyway.
 */
export function AudienceMode({ state }: { state: EventState }) {
  const summary = useMemo(() => buildAudienceSummary(state), [state]);
  const site = useSiteUrl();

  // Nothing to compare yet: show the way in at full size instead of an empty
  // table. This is the screen that goes up while the room is still joining.
  if (summary.submitted === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[1.25em] px-[1.75em] pb-[1.25em] text-center">
        <div>
          <p className="eyebrow text-signal">Play along</p>
          <h2 className="text-paper mt-[0.2em] text-[2.25em] leading-none font-bold tracking-tight">
            Draft your own portfolio
          </h2>
          <p className="text-paper-mute mx-auto mt-[0.6em] max-w-[30em] text-[1em] leading-snug">
            Scan the code, pick the role you want to think like, and spend{" "}
            <span className="text-paper-dim font-semibold">
              {state.event.audienceBudget} credits
            </span>{" "}
            across the board. We will compare the room against the panel.
          </p>
        </div>

        <QrCode url={site.link("play")} className="w-[15em] p-[0.5em]" label="Scan to play along" />

        <div>
          <p className="text-paper font-mono text-[0.9375em] tracking-[0.08em]">
            {site.display}/play/
          </p>
          {summary.joined > 0 ? (
            <p className="text-signal mt-[0.5em] font-mono text-[0.75em] tracking-[0.12em] uppercase">
              {summary.joined} joined · none submitted yet
            </p>
          ) : state.event.audienceOpen ? null : (
            <p className="text-fragility mt-[0.5em] font-mono text-[0.75em] tracking-[0.12em] uppercase">
              Closed — open it from the control room
            </p>
          )}
        </div>
      </div>
    );
  }

  // The whole pool, ranked by the room. Not a top-eight: "what did the room
  // rate that the panel did not buy" is answered by the bottom of this list as
  // much as the top, and fifteen one-line rows fit a 16:9 without scrolling.
  const rows = summary.stats;
  const ceiling = Math.max(
    1,
    ...rows.map((s) => Math.max(s.average, s.panelPrice ?? 0)),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-[1.75em] pb-[1.25em]">
      <div className="mb-[0.8em] flex shrink-0 items-end justify-between gap-[2em]">
        <div>
          <p className="eyebrow">Audience vs Panel</p>
          <h2 className="text-paper mt-[0.15em] text-[1.75em] leading-none font-semibold">
            What the room would have paid
          </h2>
        </div>

        {/* The legend is the header. Two colours carry the entire screen, so
            naming them once here means no row has to repeat itself. */}
        <div className="flex shrink-0 items-end gap-[1.75em]">
          <p className="flex items-center gap-[1em] font-mono text-[0.75em] tracking-[0.1em] uppercase">
            <span className="flex items-center gap-[0.4em]">
              <span className="bg-cyan h-[0.5em] w-[1.4em] rounded-full" aria-hidden="true" />
              <span className="text-cyan">Room</span>
            </span>
            <span className="flex items-center gap-[0.4em]">
              <span className="bg-signal h-[0.5em] w-[1.4em] rounded-full" aria-hidden="true" />
              <span className="text-signal">Panel</span>
            </span>
          </p>
          <p className="text-paper-mute border-ink-500 border-l pl-[1.75em] font-mono text-[0.75em] tracking-[0.1em] uppercase">
            <span className="text-paper tabular font-bold">{summary.submitted}</span> playing
            <span className="text-paper-faint"> · </span>
            {state.event.audienceBudget} credits each
          </p>
        </div>
      </div>

      <ol className="grid min-h-0 flex-1 auto-rows-fr gap-[0.25em]">
        {rows.map((stat) => (
          <ComparisonRow key={stat.finding.id} stat={stat} ceiling={ceiling} />
        ))}
      </ol>
    </div>
  );
}

/**
 * One finding, one row: headline, then a single track carrying both numbers.
 *
 * The room's average is the fill and the panel's price is a marker on the same
 * track, rather than two stacked bars. One track means the disagreement is the
 * distance between two marks on one line — which is the only thing this screen
 * is for — and it fits the whole pool on the projector at a size that reads
 * from the back.
 *
 * A finding nobody drafted gets no marker and an explicit dash, never a
 * zero-width bar: absent and cheap must not look the same.
 */
function ComparisonRow({ stat, ceiling }: { stat: AudienceStat; ceiling: number }) {
  const roomWidth = Math.min(100, (stat.average / ceiling) * 100);
  const panelAt =
    stat.panelPrice === null ? null : Math.min(100, (stat.panelPrice / ceiling) * 100);
  const meta = FINDING_TYPE_META[stat.finding.type];

  return (
    <li
      data-type={stat.finding.type}
      className="type-bar grid min-h-0 grid-cols-[1fr_14em_7em] items-center gap-[1em] pl-[0.6em]"
    >
      <p className="text-paper truncate text-[0.9375em] leading-snug font-medium">
        {stat.finding.headline}
        <span className="text-paper-faint ml-[0.6em] font-mono text-[0.625em] tracking-[0.08em] whitespace-nowrap uppercase">
          <span aria-hidden="true">{meta.glyph}</span> {stat.breakout?.shortName}
        </span>
      </p>

      <div className="bg-ink-600 relative h-[0.6em] overflow-hidden rounded-full">
        <div
          className="bg-cyan h-full rounded-full transition-[width] duration-500"
          style={{ width: `${roomWidth}%` }}
        />
        {panelAt === null ? null : (
          <span
            aria-hidden="true"
            className="bg-signal absolute inset-y-0 w-[0.2em] rounded-full"
            style={{ left: `calc(${panelAt}% - 0.1em)` }}
          />
        )}
      </div>

      <p className="flex items-baseline justify-end gap-[0.5em] font-mono">
        <span className="tabular text-cyan text-[1em] font-bold">
          {stat.average.toFixed(1)}
        </span>
        <span className="text-paper-faint text-[0.6875em]">vs</span>
        <span
          className={cx(
            "tabular w-[2.2em] text-right text-[1em] font-bold",
            stat.panelPrice === null ? "text-paper-faint" : "text-signal",
          )}
        >
          {stat.panelPrice === null ? "—" : stat.panelPrice}
        </span>
      </p>
    </li>
  );
}
