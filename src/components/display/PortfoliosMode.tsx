"use client";

import { useMemo } from "react";

import { cx, panelistColumns } from "@/components/primitives";
import { FINDING_TYPE_META } from "@/lib/types";
import {
  allPanelistViews,
  buildFindingView,
  buildSummary,
  roundCount,
  type FindingView,
  type PanelistView,
} from "@/lib/derive";
import type { EventState } from "@/lib/types";

/**
 * Mode 3 — Final Portfolios.
 *
 * Every panelist's picks side by side, then the three summary cuts the
 * moderator uses to close the session: what the room paid most for, which
 * breakouts got drafted, and what nobody wanted.
 *
 * Each card leads with the role and its question, because a free-form draft is
 * only judgeable against what the panelist was trying to build.
 */
export function PortfoliosMode({
  state,
  onOpenFinding,
}: {
  state: EventState;
  onOpenFinding: (view: FindingView) => void;
}) {
  const panelists = useMemo(() => allPanelistViews(state), [state]);
  const summary = useMemo(() => buildSummary(state), [state]);
  const rounds = roundCount(state);

  return (
    // Two full screens, not one split screen: the roster and the summary cuts
    // each get the whole 16:9 so both stay legible from the back of the room.
    // The operator flips between them from /control.
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-[1.75em] pb-[1.25em]">
      <div className="mb-[0.7em] shrink-0">
        <p className="eyebrow">Final Portfolios</p>
        <h2 className="text-paper mt-[0.15em] text-[1.75em] leading-none font-semibold">
          {state.event.showSummary
            ? "Where the credits went"
            : `${rounds} findings each, drafted through ${panelists.length} lenses`}
        </h2>
      </div>

      {state.event.showSummary ? (
        <SummaryScreen state={state} summary={summary} onOpenFinding={onOpenFinding} />
      ) : (
        <PortfolioGrid
          state={state}
          panelists={panelists}
          summary={summary}
          onOpenFinding={onOpenFinding}
        />
      )}
    </div>
  );
}

function PortfolioGrid({
  state,
  panelists,
  summary,
  onOpenFinding,
}: {
  state: EventState;
  panelists: PanelistView[];
  summary: ReturnType<typeof buildSummary>;
  onOpenFinding: (view: FindingView) => void;
}) {
  return (
    <div
      className={cx("grid min-h-0 flex-1 gap-[0.75em]", panelistColumns(panelists.length))}
    >
      {panelists.map((view) => (
        <PortfolioCard
          key={view.panelist.id}
          view={view}
          state={state}
          onOpenFinding={onOpenFinding}
          isLeader={
            state.event.declareWinner && summary.leaders[0]?.panelist.id === view.panelist.id
          }
        />
      ))}
    </div>
  );
}

/** The closing analytical cuts, given the full screen. */
function SummaryScreen({
  state,
  summary,
  onOpenFinding,
}: {
  state: EventState;
  summary: ReturnType<typeof buildSummary>;
  onOpenFinding: (view: FindingView) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[0.75em]">
      <dl className="grid shrink-0 grid-cols-4 gap-[0.75em]">
        <HeadlineStat label="Findings submitted" value={summary.submittedFindings} />
        <HeadlineStat label="Findings acquired" value={summary.draftedFindings} />
        <HeadlineStat
          label="Credits committed"
          value={`${summary.totalSpent} / ${summary.totalBudget}`}
          accent
        />
        <HeadlineStat
          label="Average price"
          value={summary.averagePrice ? summary.averagePrice.toFixed(1) : "—"}
        />
      </dl>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-[1em]">
        <SummaryPanel title="Highest-valued findings" hint="Ranked by auction price">
          {summary.highestValued.length === 0 ? (
            <Placeholder>Nothing has been sold yet.</Placeholder>
          ) : (
            <ol className="scroll-fade min-h-0 flex-1 space-y-[0.7em] overflow-y-auto">
              {summary.highestValued.slice(0, 8).map((view, index) => (
                <li key={view.finding.id} className="flex items-start gap-[0.6em]">
                  <span className="tabular text-paper-faint w-[1.2em] shrink-0 font-mono text-[0.75em] font-bold">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenFinding(view)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-paper line-clamp-2 text-[0.8125em] leading-snug font-medium">
                      {view.finding.headline}
                    </p>
                    <p className="text-paper-faint mt-[0.2em] font-mono text-[0.625em] tracking-[0.08em] uppercase">
                      {view.breakout?.shortName} · {view.panelist?.name}
                    </p>
                  </button>
                  <span className="tabular text-signal shrink-0 font-mono text-[1em] font-bold">
                    {view.transaction?.price}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </SummaryPanel>

        <SummaryPanel title="Most represented breakouts" hint="Findings drafted per room">
          <ol className="min-h-0 flex-1 space-y-[0.9em]">
            {summary.breakoutRepresentation.map((row) => {
              const max = Math.max(1, summary.breakoutRepresentation[0]?.count ?? 1);
              return (
                <li key={row.breakout.id}>
                  <div className="mb-[0.3em] flex items-baseline justify-between gap-[0.5em]">
                    <span className="text-paper truncate text-[0.8125em] font-medium">
                      {row.breakout.shortName}
                    </span>
                    <span className="tabular text-paper-mute shrink-0 font-mono text-[0.6875em]">
                      {row.count} · {row.spend} cr
                    </span>
                  </div>
                  <div className="bg-ink-600 h-[0.3em] w-full overflow-hidden rounded-full">
                    <div
                      className="bg-cyan h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${(row.count / max) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </SummaryPanel>

        <SummaryPanel
          title="Undrafted findings"
          hint={`${summary.undrafted.length} left on the board`}
        >
          {summary.undrafted.length === 0 ? (
            <Placeholder>Every finding was acquired.</Placeholder>
          ) : (
            <ul className="scroll-fade min-h-0 flex-1 space-y-[0.7em] overflow-y-auto">
              {summary.undrafted.slice(0, 8).map((view) => (
                <li key={view.finding.id}>
                  <button
                    type="button"
                    onClick={() => onOpenFinding(view)}
                    data-type={view.finding.type}
                    className="type-bar w-full pl-[0.6em] text-left"
                  >
                    <p className="text-paper-dim line-clamp-2 text-[0.8125em] leading-snug">
                      {view.finding.headline}
                    </p>
                    <p className="text-paper-faint mt-[0.2em] font-mono text-[0.5625em] tracking-[0.1em] uppercase">
                      {view.breakout?.shortName} · rank {view.finding.breakoutRank}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SummaryPanel>
      </div>
    </div>
  );
}

function PortfolioCard({
  view,
  state,
  isLeader,
  onOpenFinding,
}: {
  view: PanelistView;
  state: EventState;
  isLeader: boolean;
  onOpenFinding: (v: FindingView) => void;
}) {
  const breakouts = state.breakouts;
  // Three picks instead of five leaves real vertical room in each card, so the
  // headline gets more of itself rather than the card getting more whitespace.
  const roomy = view.slots.length <= 3;

  return (
    <article
      className={cx(
        "panel flex flex-col overflow-hidden",
        isLeader && "border-signal/60",
      )}
    >
      <header className="border-ink-500 border-b p-[0.75em]">
        <div className="flex items-start justify-between gap-[0.5em]">
          <div className="min-w-0">
            <h3 className="text-paper truncate text-[1em] leading-tight font-semibold">
              {view.panelist.name}
            </h3>
            {view.panelist.role ? (
              <p className="text-signal mt-[0.15em] truncate font-mono text-[0.625em] font-semibold tracking-[0.1em] uppercase">
                {view.panelist.role}
                {view.panelist.affiliation ? (
                  <span className="text-paper-faint"> · {view.panelist.affiliation}</span>
                ) : null}
              </p>
            ) : view.panelist.affiliation ? (
              <p className="text-paper-faint truncate text-[0.6875em]">
                {view.panelist.affiliation}
              </p>
            ) : null}
          </div>
          {isLeader ? (
            <span className="bg-signal text-ink-900 shrink-0 rounded-sm px-[0.4em] py-[0.15em] font-mono text-[0.5625em] font-bold tracking-[0.12em] uppercase">
              Lead
            </span>
          ) : null}
        </div>

        {/* The brief this portfolio should be judged against. */}
        {view.panelist.rolePrompt ? (
          <p className="text-paper-mute mt-[0.4em] line-clamp-3 text-[0.625em] leading-snug italic">
            {view.panelist.rolePrompt}
          </p>
        ) : null}

        <dl className="mt-[0.6em] grid grid-cols-3 gap-[0.4em]">
          <Stat label="Spent" value={view.spent} />
          <Stat label="Left" value={view.remaining} accent />
          <Stat label="Picks" value={`${view.filledCount}/${view.slots.length}`} />
        </dl>
      </header>

      <ol className="flex flex-1 flex-col gap-[0.4em] p-[0.6em]">
        {view.slots.map((slot) => (
          <li
            key={slot.index}
            data-type={slot.finding?.type}
            className={cx(
              "flex flex-1 flex-col rounded-sm px-[0.55em] py-[0.5em]",
              slot.finding ? "type-bar bg-ink-700" : "border-ink-500 border border-dashed",
            )}
          >
            <p className="text-paper-faint tabular font-mono text-[0.5625em] leading-tight font-semibold tracking-[0.1em] uppercase">
              Pick {slot.index}
            </p>

            {slot.finding && slot.transaction ? (
              <button
                type="button"
                onClick={() => onOpenFinding(buildFindingView(state, slot.finding!))}
                className="mt-[0.3em] w-full text-left"
              >
                <p
                  className={cx(
                    "text-paper leading-snug font-medium",
                    roomy
                      ? "line-clamp-5 text-[0.875em]"
                      : "line-clamp-2 text-[0.75em]",
                  )}
                >
                  {slot.finding.headline}
                </p>
                {/* Type, source breakout and price on one line — five of these
                    plus the summary band have to share a single 16:9 screen. */}
                <div className="mt-[0.3em] flex items-baseline justify-between gap-[0.5em]">
                  <span className="type-text truncate font-mono text-[0.5625em] font-semibold tracking-[0.08em] uppercase">
                    <span aria-hidden="true">{FINDING_TYPE_META[slot.finding.type].glyph}</span>{" "}
                    {FINDING_TYPE_META[slot.finding.type].label}
                    <span className="text-paper-faint"> · </span>
                    <span className="text-paper-mute">{slot.breakout?.shortName}</span>
                  </span>
                  <span className="tabular text-signal shrink-0 font-mono text-[0.75em] font-bold">
                    {slot.transaction.price}
                  </span>
                </div>
              </button>
            ) : (
              <p className="text-paper-faint mt-[0.3em] font-mono text-[0.6875em] font-bold tracking-[0.14em] uppercase">
                Open
              </p>
            )}
          </li>
        ))}
      </ol>

      {/* Breakout spread — how diversified this portfolio is. */}
      <footer className="border-ink-500 flex flex-wrap gap-[0.3em] border-t p-[0.6em]">
        {breakouts.map((breakout) => {
          const count = view.breakoutCounts[breakout.id] ?? 0;
          return (
            <span
              key={breakout.id}
              title={`${breakout.name}: ${count}`}
              className={cx(
                "tabular rounded-sm px-[0.35em] py-[0.1em] font-mono text-[0.5625em] font-semibold tracking-[0.06em] uppercase",
                count > 0 ? "bg-ink-600 text-paper-dim" : "text-paper-faint/50",
              )}
            >
              {breakout.shortName.slice(0, 4)} {count}
            </span>
          );
        })}
      </footer>
    </article>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="text-paper-faint font-mono text-[0.5rem] tracking-[0.1em] uppercase">
        {label}
      </dt>
      <dd
        className={cx(
          "tabular mt-[0.1em] text-[1em] leading-none font-bold",
          accent ? "text-signal" : "text-paper",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function SummaryPanel({
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
      <header className="mb-[0.75em] shrink-0">
        <h3 className="eyebrow">{title}</h3>
        {hint ? <p className="text-paper-faint mt-[0.2em] text-[0.6875em]">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

function HeadlineStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="panel p-[0.75em]">
      <dt className="eyebrow">{label}</dt>
      <dd
        className={cx(
          "tabular mt-[0.3em] text-[1.75em] leading-none font-bold",
          accent ? "text-signal" : "text-paper",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <p className="text-paper-faint py-[1em] text-center text-[0.8125em]">{children}</p>;
}
