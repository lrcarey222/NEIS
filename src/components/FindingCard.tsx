"use client";

import type { FindingView } from "@/lib/derive";
import { ConfidenceTag, RankTag, TypeChip, cx } from "./primitives";

/**
 * The finding as it appears on the board and in the auction pool.
 *
 * Hierarchy is deliberate and matches the brief: breakout and finding type
 * first (the coloured left bar and the chip), then the headline at the largest
 * size on the card, then the metadata row. From the back of the room the bar
 * and the headline are what carry.
 */
export function FindingCard({
  view,
  onOpen,
  compact = false,
  soldAnimation = false,
}: {
  view: FindingView;
  onOpen?: (view: FindingView) => void;
  compact?: boolean;
  /** Play the "leaving the board" animation — set briefly after a sale. */
  soldAnimation?: boolean;
}) {
  const { finding, isDrafted, panelist, transaction } = view;
  const interactive = Boolean(onOpen);

  return (
    <article
      data-type={finding.type}
      data-finding-id={finding.id}
      className={cx(
        "type-bar panel group relative w-full text-left transition-colors",
        // Compact spacing is em-based so the whole card shrinks with the
        // display root: a 1366x768 projector gets the same layout as a 4K panel,
        // just smaller, instead of cards that stay tall and overflow the column.
        compact ? "p-[0.5em]" : "p-3",
        isDrafted ? "opacity-45" : "hover:border-paper-faint",
        soldAnimation && "animate-sold",
        interactive && "cursor-pointer",
      )}
      onClick={interactive ? () => onOpen?.(view) : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen?.(view);
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Open finding: ${finding.headline}` : undefined}
    >
      <div
        className={cx(
          "flex items-start justify-between gap-2",
          compact ? "mb-[0.4em]" : "mb-2",
        )}
      >
        <TypeChip type={finding.type} size={compact ? "sm" : "md"} />
        {isDrafted ? (
          <span className="bg-signal text-ink-900 rounded-sm px-1.5 py-0.5 font-mono text-[0.5625em] font-bold tracking-[0.14em] uppercase">
            Drafted
          </span>
        ) : null}
      </div>

      {/* Clamped in compact mode so a long headline cannot push the fifth card
          in a board column below the fold — nobody scrolls a projector. */}
      <h3
        className={cx(
          "text-paper font-semibold text-balance",
          compact ? "line-clamp-3 text-[0.8125em] leading-snug" : "text-[0.9375em] leading-snug",
          isDrafted && "line-through decoration-paper-faint/60",
        )}
        title={finding.headline || undefined}
      >
        {finding.headline || (
          <span className="text-paper-faint italic">Untitled finding</span>
        )}
      </h3>

      <div
        className={cx(
          "flex flex-wrap items-center gap-y-1",
          compact ? "mt-[0.35em] gap-x-[0.7em]" : "mt-2.5 gap-x-3",
        )}
      >
        <RankTag rank={finding.breakoutRank} />
        <ConfidenceTag level={finding.confidence} />
      </div>

      {isDrafted && panelist ? (
        <div
          className={cx(
            "border-ink-500 border-t",
            compact ? "mt-[0.35em] pt-[0.35em]" : "mt-2.5 pt-2",
          )}
          // On the board the buyer's role goes in the tooltip rather than a
          // second line: name and price are what the room reads at a glance,
          // and the full record is one click away in the detail panel.
          title={panelist.role ? `Drafted by ${panelist.name} as ${panelist.role}` : undefined}
        >
          <p className="text-paper-dim truncate text-[0.75em] leading-tight font-medium">
            {panelist.name}
            <span className="text-paper-faint"> · </span>
            <span className="tabular text-signal">{transaction?.price}</span>
            {compact || !panelist.role ? null : (
              <>
                <span className="text-paper-faint"> · </span>
                <span className="text-paper-faint">{panelist.role}</span>
              </>
            )}
          </p>
        </div>
      ) : null}
    </article>
  );
}
