"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { FindingCard } from "@/components/FindingCard";
import { QrCode } from "@/components/QrCode";
import { cx, panelistColumns } from "@/components/primitives";
import {
  allPanelistViews,
  auctionFindings,
  availableFindings,
  buildFindingView,
  roundCount,
  roundNumbers,
  submittedEntries,
  type FindingView,
  type PanelistView,
} from "@/lib/derive";
import { useSiteUrl } from "@/lib/useSiteUrl";
import { AUCTION_RANK_LIMIT, type EventState } from "@/lib/types";

/**
 * Mode 2 — the live auction scoreboard. This is what is on screen for most of
 * the session, so the layout is fixed: round banner across the top, panelist
 * portfolios down the left two thirds, available pool on the right.
 *
 * Remaining budget is the single largest number on any panelist card, because
 * that is the number the room is doing arithmetic on between bids. Under the
 * name sits the role and its question — the panel is drafting free-form, so
 * what a pick is *for* is the only thing that makes it judgeable.
 */
export function AuctionMode({
  state,
  onOpenFinding,
}: {
  state: EventState;
  onOpenFinding: (view: FindingView) => void;
}) {
  const panelists = useMemo(() => allPanelistViews(state), [state]);
  const pool = useMemo(() => auctionFindings(state), [state]);
  const available = useMemo(() => availableFindings(state), [state]);
  const justSold = useJustSold(state);

  const rounds = roundCount(state);
  const roundIndex = state.event.currentRoundIndex;
  const roundNumber = roundIndex + 1;
  const inProgress = roundIndex >= 0 && roundIndex < rounds;

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-[1.75em] pb-[1.25em]">
      {/* Round banner */}
      <div className="border-ink-500 mb-[1em] border-b pb-[0.875em]">
        <div className="flex items-end justify-between gap-[2em]">
          <div className="min-w-0">
            <p className="eyebrow text-signal">
              {inProgress
                ? `Round ${roundNumber} of ${rounds}`
                : roundIndex < 0
                  ? "Auction"
                  : "Rounds complete"}
            </p>
            <h2 className="text-paper mt-[0.15em] text-[2.5em] leading-none font-bold tracking-tight uppercase">
              {inProgress
                ? `Pick ${roundNumber}`
                : roundIndex < 0
                  ? "Standing by"
                  : "Draft complete"}
            </h2>
            <p className="text-paper-mute mt-[0.6em] max-w-[52em] text-[0.9375em] leading-snug">
              {inProgress
                ? `Any of the ${pool.length} findings on the board, for any reason — each room's top ${AUCTION_RANK_LIMIT}. Each panelist is building the strongest set for the question under their name.`
                : roundIndex < 0
                  ? "The moderator will open Round 1 shortly."
                  : "Every panelist has drafted a full team."}
            </p>
          </div>
          <RoundPips rounds={roundNumbers(state)} current={roundIndex} />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_20em] gap-[1.25em]">
        {/* Panelist portfolios */}
        <div
          className={cx("grid min-h-0 gap-[0.75em]", panelistColumns(panelists.length))}
        >
          {panelists.map((view) => (
            <PanelistColumn
              key={view.panelist.id}
              state={state}
              view={view}
              rounds={rounds}
              awaitingPick={roundIndex >= 0 && view.filledCount <= roundIndex}
              highlightFindingId={justSold?.findingId ?? null}
              onOpenFinding={onOpenFinding}
            />
          ))}
        </div>

        {/* Right column: play-along, then the available pool. */}
        <div className="flex min-h-0 flex-col gap-[0.875em]">
          {state.event.audienceOpen ? <PlayAlongTile state={state} /> : null}

          <section className="flex min-h-0 flex-1 flex-col">
            <header className="border-ink-500 mb-[0.625em] flex items-baseline justify-between gap-[0.5em] border-b pb-[0.5em]">
              <h3 className="eyebrow truncate">On the board</h3>
              <span className="tabular shrink-0 font-mono text-[0.875em] font-bold">
                <span className="text-signal">{available.length}</span>
                <span className="text-paper-faint"> / {pool.length}</span>
              </span>
            </header>
            <div className="scroll-fade flex min-h-0 flex-1 flex-col gap-[0.5em] overflow-y-auto pr-[0.25em]">
              {available.length === 0 ? (
                <p className="text-paper-faint py-[2em] text-center text-[0.8125em]">
                  No findings remaining.
                </p>
              ) : (
                /* Split into the rooms' own rank tiers rather than run as one
                   list of fifteen. Every room's #1 sits together at the top,
                   which is the comparison the panel is actually making — and it
                   puts the front of the pool above the fold on a projector that
                   nobody can scroll. */
                Array.from({ length: AUCTION_RANK_LIMIT }, (_, index) => {
                  const rank = index + 1;
                  const tier = available.filter((v) => v.finding.breakoutRank === rank);
                  if (tier.length === 0) return null;

                  return (
                    <div key={rank} className="flex flex-col gap-[0.5em]">
                      <p className="text-paper-faint mt-[0.15em] font-mono text-[0.5625em] font-semibold tracking-[0.14em] uppercase">
                        Room pick #{rank}
                      </p>
                      {tier.map((view) => (
                        <FindingCard
                          key={view.finding.id}
                          view={view}
                          onOpen={onOpenFinding}
                          compact
                          showBreakout
                          soldAnimation={justSold?.findingId === view.finding.id}
                        />
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * The audience's way in, on screen for the whole auction.
 *
 * The live count is the point as much as the code is: a number that climbs
 * while the panel bids tells the room the play-along is real, and tells the
 * operator the network is working without leaving the projector.
 */
function PlayAlongTile({ state }: { state: EventState }) {
  const site = useSiteUrl();
  const playing = submittedEntries(state).length;
  const joined = state.audience.length;

  return (
    <section className="panel shrink-0 p-[0.75em]">
      <div className="flex items-start gap-[0.75em]">
        <QrCode
          url={site.link("play")}
          className="w-[6.5em] shrink-0 p-[0.3em]"
          label="Scan to play along"
        />
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-signal">Play along</p>
          <p className="text-paper mt-[0.25em] text-[0.9375em] leading-tight font-semibold">
            Draft your own {state.event.audienceBudget} credits
          </p>
          <p className="text-paper-faint mt-[0.3em] font-mono text-[0.5625em] leading-snug break-all">
            {site.display}/play/
          </p>
          <p className="mt-[0.45em] flex items-baseline gap-[0.35em]">
            <span className="tabular text-signal font-mono text-[1.5em] leading-none font-bold">
              {playing}
            </span>
            <span className="text-paper-mute font-mono text-[0.625em] tracking-[0.1em] uppercase">
              submitted
              {joined > playing ? ` · ${joined - playing} drafting` : ""}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

function RoundPips({ rounds, current }: { rounds: number[]; current: number }) {
  return (
    <ol className="flex shrink-0 gap-[0.5em]">
      {rounds.map((round, index) => (
        <li key={round} className="flex flex-col items-center gap-[0.4em]">
          <span
            className={cx(
              "h-[0.25em] w-[3em] rounded-full",
              index < current ? "bg-paper-faint" : index === current ? "bg-signal" : "bg-ink-500",
            )}
          />
          <span
            className={cx(
              "tabular font-mono text-[0.5625em] tracking-[0.1em] uppercase",
              index === current ? "text-signal" : "text-paper-faint",
            )}
          >
            {round}
          </span>
        </li>
      ))}
    </ol>
  );
}

function PanelistColumn({
  state,
  view,
  rounds,
  awaitingPick,
  highlightFindingId,
  onOpenFinding,
}: {
  state: EventState;
  view: PanelistView;
  rounds: number;
  /** Has not yet picked in the round currently on screen. */
  awaitingPick: boolean;
  highlightFindingId: string | null;
  onOpenFinding: (view: FindingView) => void;
}) {
  const { panelist, remaining, startingBudget, slots } = view;
  const share = startingBudget > 0 ? remaining / startingBudget : 0;
  const picks = Math.max(rounds, slots.length);
  // Three picks rather than five leaves height to spend on the headline.
  const roomy = picks <= 3;

  return (
    <article className="panel flex min-h-0 flex-col overflow-hidden">
      <header className="border-ink-500 border-b p-[0.75em]">
        <h3 className="text-paper truncate text-[1em] leading-tight font-semibold">
          {panelist.name}
        </h3>

        {/* The lens, then the question. Two lines at most: five of these plus
            the budget block and the picks share one 16:9 column. */}
        {panelist.role ? (
          <p className="text-signal mt-[0.25em] truncate font-mono text-[0.625em] font-semibold tracking-[0.1em] uppercase">
            {panelist.role}
            {panelist.affiliation ? (
              <span className="text-paper-faint"> · {panelist.affiliation}</span>
            ) : null}
          </p>
        ) : panelist.affiliation ? (
          <p className="text-paper-faint truncate text-[0.6875em]">{panelist.affiliation}</p>
        ) : null}

        {panelist.rolePrompt ? (
          <p className="text-paper-mute mt-[0.3em] line-clamp-2 text-[0.625em] leading-snug italic">
            {panelist.rolePrompt}
          </p>
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

      {/* Picks share the card height evenly, so the team reads as a fixed
          roster rather than a list that happens to be short. */}
      <ol className="flex min-h-0 flex-1 flex-col gap-[0.35em] p-[0.6em]">
        {Array.from({ length: picks }, (_, index) => {
          const slot = slots[index];
          const finding = slot?.finding ?? null;
          const transaction = slot?.transaction ?? null;
          // Only the first empty position is "up next"; the rest are just open.
          const isNext = awaitingPick && index === view.filledCount;
          const isNew = finding?.id === highlightFindingId;

          return (
            <li
              key={index}
              data-type={finding?.type}
              className={cx(
                // flex-1 without overflow-hidden: picks share the spare height,
                // but min-height:auto still floors each one at its content, so a
                // filled pick never clips its headline.
                "flex flex-1 flex-col rounded-sm px-[0.5em] py-[0.45em] transition-colors",
                transaction
                  ? "type-bar bg-ink-700"
                  : isNext
                    ? "border-signal/50 bg-signal/[0.06] border border-dashed"
                    : "border-ink-500 border border-dashed",
                isNew && "animate-flash",
              )}
            >
              <p
                className={cx(
                  "tabular font-mono text-[0.5625em] leading-tight font-semibold tracking-[0.1em] uppercase",
                  isNext ? "text-signal" : "text-paper-faint",
                )}
              >
                Pick {index + 1}
              </p>

              {finding && transaction ? (
                <button
                  type="button"
                  onClick={() => onOpenFinding(buildFindingView(state, finding))}
                  className="mt-[0.3em] w-full text-left"
                >
                  {/* How many lines the headline gets depends on how many
                      picks share the card: at five it is two, at three there is
                      room for the whole thing. The full text is always on the
                      right-hand pool and in the detail panel. */}
                  <p
                    className={cx(
                      "text-paper leading-snug font-medium",
                      roomy
                        ? "line-clamp-4 text-[0.8125em]"
                        : "line-clamp-2 text-[0.75em]",
                    )}
                  >
                    {finding.headline}
                  </p>
                  <p className="mt-[0.3em] flex items-center gap-[0.4em]">
                    <span className="type-text font-mono text-[0.5625em] font-semibold tracking-[0.1em] uppercase">
                      {slot?.breakout?.shortName}
                    </span>
                    <span className="text-paper-faint">·</span>
                    <span className="tabular text-signal font-mono text-[0.625em] font-bold">
                      {transaction.price}
                    </span>
                  </p>
                </button>
              ) : (
                <p
                  className={cx(
                    "mt-[0.3em] font-mono text-[0.6875em] font-bold tracking-[0.14em] uppercase",
                    isNext ? "text-signal" : "text-paper-faint",
                  )}
                >
                  {isNext ? "◂ Bidding" : "Open"}
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
