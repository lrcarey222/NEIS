"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { FindingCard } from "@/components/FindingCard";
import { cx } from "@/components/primitives";
import {
  allPanelistViews,
  availableFindings,
  currentObjective,
  sortedObjectives,
  type FindingView,
  type PanelistView,
} from "@/lib/derive";
import type { EventState } from "@/lib/types";

/**
 * Mode 2 — the live auction scoreboard. This is what is on screen for most of
 * the session, so the layout is fixed: round banner across the top, panelist
 * portfolios down the left two thirds, available pool on the right.
 *
 * Remaining budget is the single largest number on any panelist card, because
 * that is the number the room is doing arithmetic on between bids.
 */
export function AuctionMode({
  state,
  onOpenFinding,
}: {
  state: EventState;
  onOpenFinding: (view: FindingView) => void;
}) {
  const objective = currentObjective(state);
  const objectives = sortedObjectives(state);
  const panelists = useMemo(() => allPanelistViews(state), [state]);
  const available = useMemo(() => availableFindings(state), [state]);
  const justSold = useJustSold(state);

  const roundNumber = state.event.currentRoundIndex + 1;

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-[1.75em] pb-[1.25em]">
      {/* Round banner */}
      <div className="border-ink-500 mb-[1em] border-b pb-[0.875em]">
        {objective ? (
          <div className="flex items-end justify-between gap-[2em]">
            <div className="min-w-0">
              <p className="eyebrow text-signal">
                Round {roundNumber} of {objectives.length}
              </p>
              <h2 className="text-paper mt-[0.15em] text-[2.5em] leading-none font-bold tracking-tight uppercase">
                {objective.name}
              </h2>
              <p className="text-paper-mute mt-[0.6em] max-w-[52em] text-[0.9375em] leading-snug">
                {objective.prompt}
              </p>
            </div>
            <RoundPips objectives={objectives} current={state.event.currentRoundIndex} />
          </div>
        ) : (
          <div>
            <p className="eyebrow text-signal">Auction</p>
            <h2 className="text-paper mt-[0.15em] text-[2.25em] leading-none font-bold tracking-tight uppercase">
              {state.event.currentRoundIndex < 0 ? "Standing by" : "Rounds complete"}
            </h2>
            <p className="text-paper-mute mt-[0.5em] text-[0.9375em]">
              {state.event.currentRoundIndex < 0
                ? "The moderator will open Round 1 shortly."
                : "All strategic objectives have been contested."}
            </p>
          </div>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_20em] gap-[1.25em]">
        {/* Panelist portfolios */}
        <div
          className={cx(
            "grid min-h-0 gap-[0.75em]",
            panelists.length <= 2
              ? "grid-cols-2"
              : panelists.length === 3
                ? "grid-cols-3"
                : panelists.length === 4
                  ? "grid-cols-4"
                  : "grid-cols-5",
          )}
        >
          {panelists.map((view) => (
            <PanelistColumn
              key={view.panelist.id}
              view={view}
              activeObjectiveId={objective?.id ?? null}
              highlightFindingId={justSold?.findingId ?? null}
              onOpenFinding={onOpenFinding}
            />
          ))}
        </div>

        {/* Available pool */}
        <section className="flex min-h-0 flex-col">
          <header className="border-ink-500 mb-[0.625em] flex items-baseline justify-between border-b pb-[0.5em]">
            <h3 className="eyebrow">On the board</h3>
            <span className="tabular text-signal font-mono text-[0.875em] font-bold">
              {available.length}
            </span>
          </header>
          <div className="scroll-fade flex min-h-0 flex-1 flex-col gap-[0.5em] overflow-y-auto pr-[0.25em]">
            {available.length === 0 ? (
              <p className="text-paper-faint py-[2em] text-center text-[0.8125em]">
                No findings remaining.
              </p>
            ) : (
              available.map((view) => (
                <FindingCard
                  key={view.finding.id}
                  view={view}
                  onOpen={onOpenFinding}
                  compact
                  soldAnimation={justSold?.findingId === view.finding.id}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function RoundPips({
  objectives,
  current,
}: {
  objectives: { id: string; shortName: string }[];
  current: number;
}) {
  return (
    <ol className="flex shrink-0 gap-[0.5em]">
      {objectives.map((objective, index) => (
        <li key={objective.id} className="flex flex-col items-center gap-[0.4em]">
          <span
            className={cx(
              "h-[0.25em] w-[3em] rounded-full",
              index < current ? "bg-paper-faint" : index === current ? "bg-signal" : "bg-ink-500",
            )}
          />
          <span
            className={cx(
              "font-mono text-[0.5625em] tracking-[0.1em] uppercase",
              index === current ? "text-signal" : "text-paper-faint",
            )}
          >
            {objective.shortName}
          </span>
        </li>
      ))}
    </ol>
  );
}

function PanelistColumn({
  view,
  activeObjectiveId,
  highlightFindingId,
  onOpenFinding,
}: {
  view: PanelistView;
  activeObjectiveId: string | null;
  highlightFindingId: string | null;
  onOpenFinding: (view: FindingView) => void;
}) {
  const { panelist, remaining, startingBudget, slots } = view;
  const share = startingBudget > 0 ? remaining / startingBudget : 0;

  return (
    <article className="panel flex min-h-0 flex-col overflow-hidden">
      <header className="border-ink-500 border-b p-[0.75em]">
        <h3 className="text-paper truncate text-[1em] leading-tight font-semibold">
          {panelist.name}
        </h3>
        {panelist.affiliation ? (
          <p className="text-paper-faint truncate text-[0.6875em]">{panelist.affiliation}</p>
        ) : null}

        {/* Budget: the biggest thing on the card, by design. */}
        <div className="mt-[0.5em] flex items-baseline gap-[0.35em]">
          <span
            className={cx(
              "tabular text-[2em] leading-none font-bold",
              remaining === 0 ? "text-fragility" : "text-signal",
            )}
          >
            {remaining}
          </span>
          <span className="text-paper-faint tabular font-mono text-[0.75em]">
            / {startingBudget}
          </span>
        </div>
        <div className="bg-ink-600 mt-[0.5em] h-[0.25em] w-full overflow-hidden rounded-full">
          <div
            className={cx(
              "h-full rounded-full transition-[width] duration-500",
              remaining === 0 ? "bg-fragility" : "bg-signal",
            )}
            style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }}
          />
        </div>
      </header>

      {/* Slots share the card height evenly, so the five objectives read as a
          fixed roster rather than a list that happens to be short. */}
      <ol className="flex min-h-0 flex-1 flex-col gap-[0.35em] p-[0.6em]">
        {slots.map((slot) => {
          const isActive = slot.objective.id === activeObjectiveId && !slot.transaction;
          const isNew = slot.finding?.id === highlightFindingId;

          return (
            <li
              key={slot.objective.id}
              data-type={slot.finding?.type}
              className={cx(
                // flex-1 without overflow-hidden: slots share the spare height,
                // but min-height:auto still floors each one at its content, so a
                // filled slot never clips its headline.
                "flex flex-1 flex-col rounded-sm px-[0.5em] py-[0.45em] transition-colors",
                slot.transaction
                  ? "type-bar bg-ink-700"
                  : isActive
                    ? "border-signal/50 bg-signal/[0.06] border border-dashed"
                    : "border-ink-500 border border-dashed",
                isNew && "animate-flash",
              )}
            >
              <p
                className={cx(
                  "font-mono text-[0.5625em] leading-tight font-semibold tracking-[0.1em] uppercase",
                  isActive ? "text-signal" : "text-paper-faint",
                )}
              >
                {slot.objective.name}
              </p>

              {slot.finding && slot.transaction ? (
                <button
                  type="button"
                  onClick={() =>
                    onOpenFinding({
                      finding: slot.finding!,
                      breakout: slot.breakout,
                      transaction: slot.transaction,
                      panelist: view.panelist,
                      objective: slot.objective,
                      isDrafted: true,
                      isAvailable: false,
                    })
                  }
                  className="mt-[0.3em] w-full text-left"
                >
                  {/* Two lines, not three: five filled slots plus the budget
                      header have to fit the card at 16:9. The full headline is
                      on the right-hand pool and in the detail panel. */}
                  <p className="text-paper line-clamp-2 text-[0.75em] leading-snug font-medium">
                    {slot.finding.headline}
                  </p>
                  <p className="mt-[0.3em] flex items-center gap-[0.4em]">
                    <span className="type-text font-mono text-[0.5625em] font-semibold tracking-[0.1em] uppercase">
                      {slot.breakout?.shortName}
                    </span>
                    <span className="text-paper-faint">·</span>
                    <span className="tabular text-signal font-mono text-[0.625em] font-bold">
                      {slot.transaction.price}
                    </span>
                  </p>
                </button>
              ) : (
                <p
                  className={cx(
                    "mt-[0.3em] font-mono text-[0.6875em] font-bold tracking-[0.14em] uppercase",
                    isActive ? "text-signal" : "text-paper-faint",
                  )}
                >
                  {isActive ? "◂ Bidding" : "Open"}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </article>
  );
}

/**
 * Detects a newly recorded sale so the board can animate the card leaving the
 * pool and flash it into the buyer's portfolio. Watching the transaction list
 * rather than being told about it means the animation fires on every screen in
 * the room at once, including ones that just reconnected.
 */
function useJustSold(state: EventState): { findingId: string; id: string } | null {
  const [recent, setRecent] = useState<{ findingId: string; id: string } | null>(null);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const ids = new Set(state.transactions.map((t) => t.id));

    // First snapshot: record what already exists without animating history.
    if (seen.current === null) {
      seen.current = ids;
      return;
    }

    const fresh = state.transactions.find((t) => !seen.current!.has(t.id));
    seen.current = ids;

    if (!fresh) return;
    setRecent({ findingId: fresh.findingId, id: fresh.id });
    const timeout = setTimeout(() => setRecent(null), 1600);
    return () => clearTimeout(timeout);
  }, [state.transactions]);

  return recent;
}
