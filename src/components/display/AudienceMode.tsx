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
 * same board. This puts the two side by side.
 *
 * The comparison only works because both numbers mean the same thing: a panel
 * price is what one participant paid for one finding, and the audience figure
 * is credits-per-participant, counting the people who gave a finding nothing.
 * Averaging over backers instead would let two enthusiasts outrank the room.
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

  const top = summary.stats.filter((s) => s.total > 0).slice(0, 8);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-[1.75em] pb-[1.25em]">
      <div className="mb-[0.7em] flex shrink-0 items-end justify-between gap-[2em]">
        <div>
          <p className="eyebrow">Audience vs Panel</p>
          <h2 className="text-paper mt-[0.15em] text-[1.75em] leading-none font-semibold">
            What the room would have paid
          </h2>
        </div>
        <p className="text-paper-mute font-mono text-[0.6875em] tracking-[0.12em] uppercase">
          <span className="text-signal tabular font-bold">{summary.submitted}</span> portfolios
          <span className="text-paper-faint"> · </span>
          <span className="tabular">{summary.creditsAllocated}</span> credits allocated
          <span className="text-paper-faint"> · </span>
          {state.event.audienceBudget} each
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1.6fr_1fr] gap-[1em]">
        {/* The main comparison. */}
        <Panel
          title="Most backed by the room"
          hint="Audience credits per person, against what the panel actually paid"
        >
          <ol className="scroll-fade min-h-0 flex-1 space-y-[0.55em] overflow-y-auto pr-[0.25em]">
            {top.map((stat, index) => (
              <ComparisonRow key={stat.finding.id} stat={stat} rank={index + 1} max={top[0]} />
            ))}
          </ol>
        </Panel>

        <div className="grid min-h-0 grid-rows-2 gap-[1em]">
          <Panel
            title="The room saw what the panel missed"
            hint="Biggest gap in the audience's favour"
          >
            {summary.overlooked.length === 0 ? (
              <Placeholder>The panel and the room agreed on everything.</Placeholder>
            ) : (
              <ol className="scroll-fade min-h-0 flex-1 space-y-[0.6em] overflow-y-auto">
                {summary.overlooked.slice(0, 4).map((stat) => (
                  <GapRow key={stat.finding.id} stat={stat} tone="audience" />
                ))}
              </ol>
            )}
          </Panel>

          <Panel
            title="The panel paid up, the room did not"
            hint="Biggest gap in the panel's favour"
          >
            {summary.contested.length === 0 ? (
              <Placeholder>Nothing the panel bought was ignored by the room.</Placeholder>
            ) : (
              <ol className="scroll-fade min-h-0 flex-1 space-y-[0.6em] overflow-y-auto">
                {summary.contested.slice(0, 4).map((stat) => (
                  <GapRow key={stat.finding.id} stat={stat} tone="panel" />
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>

      {/* How the lenses differed — the same question the panel was answering,
          asked of everyone in the room who picked that role. */}
      {summary.byRole.length > 0 ? (
        <div className="mt-[0.75em] shrink-0">
          <p className="eyebrow mb-[0.5em]">Top pick by role</p>
          <div
            className="grid gap-[0.6em]"
            style={{
              gridTemplateColumns: `repeat(${Math.min(summary.byRole.length, 5)}, minmax(0, 1fr))`,
            }}
          >
            {summary.byRole.slice(0, 5).map((row) => (
              <article key={row.role} className="panel p-[0.6em]">
                <p className="text-signal truncate font-mono text-[0.625em] font-semibold tracking-[0.1em] uppercase">
                  {row.role}
                  <span className="text-paper-faint"> · {row.entries}</span>
                </p>
                {row.top[0] ? (
                  <>
                    <p
                      data-type={row.top[0].finding.type}
                      className="type-bar text-paper mt-[0.35em] line-clamp-2 pl-[0.5em] text-[0.6875em] leading-snug font-medium"
                    >
                      {row.top[0].finding.headline}
                    </p>
                    <p className="text-paper-faint tabular mt-[0.25em] font-mono text-[0.5625em] tracking-[0.08em] uppercase">
                      {row.top[0].average.toFixed(1)} avg · {row.top[0].backers} backer
                      {row.top[0].backers === 1 ? "" : "s"}
                    </p>
                  </>
                ) : (
                  <p className="text-paper-faint mt-[0.35em] text-[0.6875em]">No picks yet.</p>
                )}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One finding: the room's average as a bar, the panel's price as a marker.
 *
 * Both bars share a scale set by the top row, so a glance across the column
 * reads as relative value rather than as eight full-width bars.
 */
function ComparisonRow({
  stat,
  rank,
  max,
}: {
  stat: AudienceStat;
  rank: number;
  max: AudienceStat | undefined;
}) {
  const ceiling = Math.max(
    1,
    max?.average ?? 1,
    ...[stat.panelPrice ?? 0, stat.average],
  );
  const audienceWidth = (stat.average / ceiling) * 100;
  const panelWidth = ((stat.panelPrice ?? 0) / ceiling) * 100;
  const meta = FINDING_TYPE_META[stat.finding.type];

  return (
    <li className="flex items-start gap-[0.6em]">
      <span className="tabular text-paper-faint w-[1.2em] shrink-0 font-mono text-[0.75em] font-bold">
        {rank}
      </span>
      <div data-type={stat.finding.type} className="type-bar min-w-0 flex-1 pl-[0.6em]">
        <div className="flex items-baseline justify-between gap-[0.6em]">
          <p className="text-paper line-clamp-1 text-[0.8125em] leading-snug font-medium">
            {stat.finding.headline}
          </p>
          <span className="text-paper-faint shrink-0 font-mono text-[0.5625em] tracking-[0.08em] uppercase">
            <span aria-hidden="true">{meta.glyph}</span> {stat.breakout?.shortName}
          </span>
        </div>

        {/* Audience bar. */}
        <div className="mt-[0.3em] flex items-center gap-[0.5em]">
          <span className="text-cyan w-[3.5em] shrink-0 font-mono text-[0.5625em] tracking-[0.08em] uppercase">
            Room
          </span>
          <div className="bg-ink-600 h-[0.45em] min-w-0 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-cyan h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.min(100, audienceWidth)}%` }}
            />
          </div>
          <span className="tabular text-cyan w-[3em] shrink-0 text-right font-mono text-[0.75em] font-bold">
            {stat.average.toFixed(1)}
          </span>
        </div>

        {/* Panel bar. An undrafted finding gets an explicit "not drafted"
            rather than a zero-width bar, which reads as missing data. */}
        <div className="mt-[0.2em] flex items-center gap-[0.5em]">
          <span className="text-signal w-[3.5em] shrink-0 font-mono text-[0.5625em] tracking-[0.08em] uppercase">
            Panel
          </span>
          <div className="bg-ink-600 h-[0.45em] min-w-0 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-signal h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.min(100, panelWidth)}%` }}
            />
          </div>
          <span
            className={cx(
              "tabular w-[3em] shrink-0 text-right font-mono text-[0.75em] font-bold",
              stat.panelPrice === null ? "text-paper-faint" : "text-signal",
            )}
          >
            {stat.panelPrice === null ? "—" : stat.panelPrice}
          </span>
        </div>
      </div>
    </li>
  );
}

function GapRow({ stat, tone }: { stat: AudienceStat; tone: "audience" | "panel" }) {
  return (
    <li data-type={stat.finding.type} className="type-bar pl-[0.6em]">
      <p className="text-paper line-clamp-2 text-[0.75em] leading-snug font-medium">
        {stat.finding.headline}
      </p>
      <p className="mt-[0.2em] flex items-baseline gap-[0.4em] font-mono text-[0.5625em] tracking-[0.08em] uppercase">
        <span className="text-cyan tabular">room {stat.average.toFixed(1)}</span>
        <span className="text-paper-faint">vs</span>
        <span className="text-signal tabular">
          panel {stat.panelPrice === null ? "not drafted" : stat.panelPrice}
        </span>
        <span
          className={cx(
            "tabular ml-auto font-bold",
            tone === "audience" ? "text-cyan" : "text-signal",
          )}
        >
          {stat.delta > 0 ? "+" : ""}
          {stat.delta.toFixed(1)}
        </span>
      </p>
    </li>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel flex min-h-0 flex-col p-[0.875em]">
      <header className="mb-[0.65em] shrink-0">
        <h3 className="eyebrow">{title}</h3>
        {hint ? <p className="text-paper-faint mt-[0.2em] text-[0.6875em]">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <p className="text-paper-faint py-[1em] text-center text-[0.8125em]">{children}</p>;
}
