"use client";

import { useMemo } from "react";

import { FindingCard } from "@/components/FindingCard";
import { EmptyState, cx } from "@/components/primitives";
import {
  buildFindingView,
  findingsForBreakout,
  sortedBreakouts,
  type FindingView,
} from "@/lib/derive";
import type { EventState } from "@/lib/types";

/**
 * Mode 1 — the Strategic Findings Board.
 *
 * One column per breakout, findings in the breakout's own ranked order. The
 * whole board has to fit on a 16:9 screen without scrolling, so the columns
 * flex and the cards stay compact; the detail panel carries everything that
 * does not fit.
 */
export function BoardMode({
  state,
  onOpenFinding,
}: {
  state: EventState;
  onOpenFinding: (view: FindingView) => void;
}) {
  const columns = useMemo(() => {
    return sortedBreakouts(state).map((breakout) => {
      const findings = findingsForBreakout(state, breakout.id)
        .filter((f) => f.submitted)
        .map((f) => buildFindingView(state, f));
      return { breakout, findings };
    });
  }, [state]);

  const totalSubmitted = columns.reduce((sum, c) => sum + c.findings.length, 0);
  const drafted = columns.reduce(
    (sum, c) => sum + c.findings.filter((f) => f.isDrafted).length,
    0,
  );

  if (totalSubmitted === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-[3em]">
        <div className="max-w-[26em] text-center">
          <p className="eyebrow mb-[0.75em]">Strategic Findings Board</p>
          <h2 className="text-paper text-[1.75em] leading-tight font-semibold">
            Waiting for the breakout sessions
          </h2>
          <p className="text-paper-mute mt-[0.75em] text-[0.9375em] leading-relaxed">
            Findings appear here the moment each room submits. Five breakouts, five
            findings each.
          </p>
          <div className="mt-[2em] flex justify-center gap-[0.75em]">
            {sortedBreakouts(state).map((breakout) => (
              <div key={breakout.id} className="flex flex-col items-center gap-[0.5em]">
                <span
                  className={cx(
                    "h-[0.5em] w-[0.5em] rounded-full",
                    breakout.submissionStatus === "submitted"
                      ? "bg-momentum"
                      : breakout.submissionStatus === "drafting"
                        ? "bg-signal"
                        : "bg-ink-400",
                  )}
                />
                <span className="text-paper-faint font-mono text-[0.5625em] tracking-[0.1em] uppercase">
                  {breakout.shortName}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-[1.75em] pb-[1.25em]">
      <div className="mb-[0.7em] flex items-baseline justify-between">
        <div>
          <p className="eyebrow">Strategic Findings Board</p>
          <h2 className="text-paper mt-[0.15em] text-[1.375em] leading-none font-semibold">
            {totalSubmitted} findings from {columns.filter((c) => c.findings.length).length}{" "}
            breakouts
          </h2>
        </div>
        <p className="text-paper-mute tabular font-mono text-[0.75em] tracking-[0.1em] uppercase">
          <span className="text-signal">{totalSubmitted - drafted}</span> available
          <span className="text-paper-faint"> / </span>
          {drafted} drafted
        </p>
      </div>

      <div className="grid flex-1 grid-cols-5 gap-[0.75em] overflow-hidden">
        {columns.map(({ breakout, findings }) => (
          <section key={breakout.id} className="flex min-h-0 flex-col">
            <header className="border-ink-500 mb-[0.625em] border-b pb-[0.5em]">
              <h3 className="text-paper text-[0.9375em] leading-tight font-semibold text-balance">
                {breakout.name}
              </h3>
              <p className="text-paper-faint mt-[0.35em] font-mono text-[0.5625em] tracking-[0.12em] uppercase">
                {findings.length
                  ? `${findings.length} findings`
                  : breakout.submissionStatus === "drafting"
                    ? "Drafting"
                    : "Not submitted"}
              </p>
            </header>

            <div className="scroll-fade flex min-h-0 flex-1 flex-col gap-[0.4em] overflow-y-auto">
              {findings.length === 0 ? (
                <EmptyState title="Awaiting submission" />
              ) : (
                findings.map((view) => (
                  <FindingCard
                    key={view.finding.id}
                    view={view}
                    onOpen={onOpenFinding}
                    compact
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
