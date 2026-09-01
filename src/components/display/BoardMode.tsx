"use client";

import { useMemo } from "react";

import {
  ConfidenceTag,
  EmptyState,
  EvidenceBlock,
  TypeChip,
  cx,
} from "@/components/primitives";
import {
  buildFindingView,
  findingsForBreakout,
  isAuctionEligible,
  sortedBreakouts,
  type FindingView,
} from "@/lib/derive";
import {
  activeSegment,
  formatRemaining,
  presenterCount,
  presenterRemainingMs,
  presentingSlot,
} from "@/lib/schedule";
import { useServerClock } from "@/lib/useEvent";
import { AUCTION_RANK_LIMIT, type Breakout, type EventState } from "@/lib/types";

/**
 * Mode 1 — the Strategic Findings Board.
 *
 * One column per breakout, carrying that room's top three in its own ranked
 * order — the auction pool, and nothing else. Fifteen cards fit a 16:9 screen
 * at a size the back row can read; twenty-five did not. The ten below the line
 * are still in the breakout's own workspace, the CSV and the printed pack.
 *
 * With one exception: while a breakout is presenting, the board shows **only
 * that room's three** — see `PresentationBoard`.
 */
export function BoardMode({
  state,
  onOpenFinding,
}: {
  state: EventState;
  onOpenFinding: (view: FindingView) => void;
}) {
  const schedule = state.runOfShow;
  const slot = presentingSlot(schedule, activeSegment(schedule));
  const presenting = slot === null ? null : (sortedBreakouts(state)[slot] ?? null);

  // Hand the whole screen over for as long as somebody is on their feet. The
  // board comes straight back when the operator advances the presenter.
  if (presenting) {
    return (
      <PresentationBoard
        state={state}
        breakout={presenting}
        slot={slot!}
        onOpenFinding={onOpenFinding}
      />
    );
  }

  return <FullBoard state={state} onOpenFinding={onOpenFinding} />;
}

function FullBoard({
  state,
  onOpenFinding,
}: {
  state: EventState;
  onOpenFinding: (view: FindingView) => void;
}) {
  // The auction pool only — each room's top three. Twenty-five cards on one
  // 16:9 forced every headline down to a size nobody past row four could read;
  // fifteen buys back the height to show each one properly, and the ten below
  // the line are still in the printable record and in the breakout's own view.
  const columns = useMemo(() => {
    return sortedBreakouts(state).map((breakout) => {
      const findings = findingsForBreakout(state, breakout.id)
        .filter(isAuctionEligible)
        .map((f) => buildFindingView(state, f));
      return { breakout, findings };
    });
  }, [state]);

  const all = columns.flatMap((c) => c.findings);
  const inAuction = all.length;
  const drafted = all.filter((v) => v.isDrafted).length;

  if (inAuction === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-[3em]">
        <div className="max-w-[26em] text-center">
          <p className="eyebrow mb-[0.75em]">Strategic Findings Board</p>
          <h2 className="text-paper text-[1.75em] leading-tight font-semibold">
            Waiting for the breakout sessions
          </h2>
          <p className="text-paper-mute mt-[0.75em] text-[0.9375em] leading-relaxed">
            Findings appear here the moment each room submits. Five breakouts, five
            findings each — the top {AUCTION_RANK_LIMIT} from every room go on the board.
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
            {inAuction} findings from {columns.filter((c) => c.findings.length).length}{" "}
            breakouts
          </h2>
        </div>
        <p className="text-paper-mute tabular font-mono text-[0.75em] tracking-[0.1em] uppercase">
          <span className="text-signal">{inAuction - drafted}</span> on the board
          <span className="text-paper-faint"> / </span>
          {drafted} drafted
        </p>
      </div>

      <div className="grid flex-1 grid-cols-5 gap-[0.75em] overflow-hidden">
        {columns.map(({ breakout, findings }) => (
          <section key={breakout.id} className="flex min-h-0 flex-col">
            <header className="border-ink-500 mb-[0.5em] border-b pb-[0.4em]">
              <h3 className="text-paper text-[0.9375em] leading-tight font-semibold text-balance">
                {breakout.name}
              </h3>
              <p className="text-paper-faint mt-[0.3em] font-mono text-[0.5625em] tracking-[0.12em] uppercase">
                {findings.length
                  ? `Top ${findings.length}`
                  : breakout.submissionStatus === "drafting"
                    ? "Drafting"
                    : "Not submitted"}
              </p>
            </header>

            {/* Three cards sharing the column height rather than five scrolling
                inside it, so a headline is read rather than scanned. */}
            <ol className="grid min-h-0 flex-1 auto-rows-fr gap-[0.5em]">
              {findings.length === 0 ? (
                <EmptyState title="Awaiting submission" />
              ) : (
                findings.map((view) => (
                  <BoardCard key={view.finding.id} view={view} onOpen={onOpenFinding} />
                ))
              )}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * A finding at board size.
 *
 * Fifteen of these share the screen instead of twenty-five, and the height that
 * buys goes entirely into the headline — the one thing the room reads from the
 * back — plus why it matters, which is what turns a headline into an argument
 * somebody can bid on. Evidence stays in the detail panel: on a card this size
 * it would push the headline back down to where it started.
 */
function BoardCard({
  view,
  onOpen,
}: {
  view: FindingView;
  onOpen: (view: FindingView) => void;
}) {
  const { finding, isDrafted, panelist, transaction } = view;

  return (
    <li
      data-type={finding.type}
      className={cx(
        "type-bar panel flex min-h-0 flex-col p-[0.7em] text-left transition-colors",
        isDrafted ? "opacity-50" : "hover:border-paper-faint",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(view)}
        className="flex min-h-0 flex-1 flex-col items-start overflow-hidden text-left"
        aria-label={`Open finding: ${finding.headline}`}
      >
        <div className="mb-[0.45em] flex w-full shrink-0 items-center justify-between gap-[0.5em]">
          <TypeChip type={finding.type} size="sm" />
          {isDrafted ? (
            <span className="bg-signal text-ink-900 shrink-0 rounded-sm px-[0.4em] py-[0.1em] font-mono text-[0.5em] font-bold tracking-[0.12em] uppercase">
              Drafted
            </span>
          ) : (
            <ConfidenceTag level={finding.confidence} />
          )}
        </div>

        <h4
          className={cx(
            "text-paper text-[0.9375em] leading-snug font-semibold text-balance",
            isDrafted && "line-through decoration-paper-faint/50",
          )}
        >
          {finding.headline || (
            <span className="text-paper-faint italic">Untitled finding</span>
          )}
        </h4>

        {finding.whyItMatters ? (
          <p className="text-paper-mute mt-[0.45em] line-clamp-4 text-[0.75em] leading-snug">
            {finding.whyItMatters}
          </p>
        ) : null}
      </button>

      {isDrafted && panelist ? (
        <p className="border-ink-500 text-paper-dim mt-[0.5em] shrink-0 truncate border-t pt-[0.4em] text-[0.6875em] leading-tight font-medium">
          {panelist.name}
          <span className="text-paper-faint"> · </span>
          <span className="tabular text-signal">{transaction?.price}</span>
        </p>
      ) : null}
    </li>
  );
}

/**
 * One breakout's three, given the whole screen.
 *
 * During the presentations the room is listening to one room talk for two and a
 * half minutes, so for as long as somebody is on their feet the board shows
 * only theirs — and only the three that are going to auction, which is what the
 * two and a half minutes are worth spending on. A third of the screen each is
 * enough for the headline, why it matters and the evidence, so the room follows
 * an argument rather than squinting at a headline.
 *
 * The clock and the roster live in this header rather than in a floating
 * overlay, because the whole screen is already the presentation and an overlay
 * would only cover the findings it is timing.
 */
function PresentationBoard({
  state,
  breakout,
  slot,
  onOpenFinding,
}: {
  state: EventState;
  breakout: Breakout;
  slot: number;
  onOpenFinding: (view: FindingView) => void;
}) {
  const { now } = useServerClock(250);
  const schedule = state.runOfShow;
  const segment = activeSegment(schedule);

  const findings = useMemo(
    () =>
      findingsForBreakout(state, breakout.id)
        .filter(isAuctionEligible)
        .map((f) => buildFindingView(state, f)),
    [state, breakout.id],
  );

  const total = presenterCount(segment);
  const remaining = presenterRemainingMs(schedule, segment, now);
  const over = remaining !== null && remaining < 0;
  const urgent = remaining !== null && !over && remaining <= 30_000;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-[1.75em] pb-[1.25em]">
      <header className="border-ink-500 mb-[0.9em] flex items-end justify-between gap-[2em] border-b pb-[0.75em]">
        <div className="min-w-0">
          <p className="eyebrow text-signal">
            Presenting · {slot + 1} of {total}
          </p>
          <h2 className="text-paper mt-[0.15em] text-[2.25em] leading-none font-bold tracking-tight">
            {breakout.name}
          </h2>
        </div>

        <div className="flex shrink-0 items-end gap-[1.75em]">
          {/* Who has been and who is left, without counting. */}
          <ol className="flex flex-col items-end gap-[0.25em]">
            {sortedBreakouts(state)
              .slice(0, total)
              .map((room, index) => (
                <li
                  key={room.id}
                  className={cx(
                    "flex items-center gap-[0.5em] font-mono text-[0.625em] tracking-[0.1em] uppercase",
                    index < slot
                      ? "text-paper-faint"
                      : index === slot
                        ? "text-signal font-bold"
                        : "text-paper-mute",
                  )}
                >
                  <span aria-hidden="true">
                    {index < slot ? "✓" : index === slot ? "▶" : "·"}
                  </span>
                  {room.shortName}
                </li>
              ))}
          </ol>

          {remaining !== null ? (
            <div className="border-ink-500 border-l pl-[1.75em] text-right">
              <p className="eyebrow">{over ? "Over by" : "Remaining"}</p>
              <p
                className={cx(
                  "tabular font-mono text-[3em] leading-none font-bold",
                  over ? "text-fragility" : urgent ? "text-signal" : "text-paper",
                )}
                aria-live="off"
              >
                {/* Text, not colour alone: "+0:20 OVER" reads the same to
                    everyone in the room. */}
                {formatRemaining(remaining)}
              </p>
            </div>
          ) : null}
        </div>
      </header>

      {findings.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-[26em] text-center">
            <h3 className="text-paper text-[1.5em] leading-tight font-semibold">
              {breakout.name} has not submitted yet
            </h3>
            <p className="text-paper-mute mt-[0.6em] text-[0.9375em] leading-relaxed">
              Their findings appear here the moment the room submits.
            </p>
          </div>
        </div>
      ) : (
        <ol
          className="grid min-h-0 flex-1 gap-[0.75em]"
          style={{
            gridTemplateColumns: `repeat(${Math.max(findings.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {findings.map((view) => (
            <PresentationCard
              key={view.finding.id}
              view={view}
              onOpen={onOpenFinding}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * A finding at presentation size.
 *
 * Three of these share the screen, so each one carries the full headline
 * unclamped, why it matters, and the evidence — the material the presenter is
 * actually speaking to.
 */
function PresentationCard({
  view,
  onOpen,
}: {
  view: FindingView;
  onOpen: (view: FindingView) => void;
}) {
  const { finding, isDrafted } = view;

  return (
    <li
      data-type={finding.type}
      className={cx(
        "type-bar panel flex min-h-0 flex-col p-[0.9em] text-left",
        isDrafted && "opacity-60",
      )}
    >
      {/* Content flows from the top rather than being spread over the card.
          The cards stay a uniform height so the outlines align across the row,
          but the metadata sits with the headline it describes instead of being
          pinned to a bottom edge it has nothing to do with. */}
      <button
        type="button"
        onClick={() => onOpen(view)}
        className="scroll-fade flex min-h-0 flex-1 flex-col items-start overflow-hidden text-left"
        aria-label={`Open finding: ${finding.headline}`}
      >
        {/* Two fixed rows rather than one wrapping one. "Underappreciated
            Opportunity" is long enough to wrap on a fifth of the screen, and a
            single row would push that one card's headline out of line with the
            other four — which is exactly the row of five the room is reading
            across. */}
        <div className="mb-[0.7em] w-full shrink-0">
          <div className="flex items-center justify-between gap-[0.5em]">
            <TypeChip type={finding.type} size="md" />
            {isDrafted ? (
              <span className="bg-signal text-ink-900 shrink-0 rounded-sm px-[0.4em] py-[0.1em] font-mono text-[0.5625em] font-bold tracking-[0.12em] uppercase">
                Drafted
              </span>
            ) : null}
          </div>
          <div className="mt-[0.4em] flex items-center gap-[0.75em]">
            <span className="tabular text-paper-faint font-mono text-[0.6875em] font-bold tracking-[0.1em] uppercase">
              #{finding.breakoutRank}
            </span>
            <ConfidenceTag level={finding.confidence} />
          </div>
        </div>

        <h3 className="text-paper shrink-0 text-[1.25em] leading-snug font-semibold text-balance">
          {finding.headline || (
            <span className="text-paper-faint italic">Untitled finding</span>
          )}
        </h3>

        {finding.whyItMatters ? (
          <p className="text-paper-dim mt-[0.7em] shrink-0 text-[0.875em] leading-snug">
            {finding.whyItMatters}
          </p>
        ) : null}

        {finding.evidence ? (
          <div className="border-ink-500 mt-[0.8em] w-full shrink-0 border-t pt-[0.65em]">
            <EvidenceBlock
              text={finding.evidence}
              className="text-paper-mute text-[0.8125em] leading-snug"
            />
          </div>
        ) : null}
      </button>
    </li>
  );
}
