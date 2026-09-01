"use client";

import { useEffect, useRef } from "react";

import type { FindingView } from "@/lib/derive";
import { CONFIDENCE_META, FINDING_TYPE_META } from "@/lib/types";
import { ConfidenceTag, EvidenceBlock, RankTag, TypeChip } from "./primitives";

/**
 * Side panel shown when a finding is clicked anywhere in the app.
 *
 * Its real job happens live: a panelist asks "wait, what was that one again?"
 * and the moderator needs the full text on screen within a second. So it opens
 * over whatever is behind it, closes on Escape or a click outside, and puts
 * the purchase record at the top when the finding has already been sold.
 */
export function FindingDetail({
  view,
  onClose,
}: {
  view: FindingView | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const open = view !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Move focus into the panel so Escape and screen readers both land here.
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!view) return null;

  const { finding, breakout, panelist, transaction, isDrafted } = view;
  const meta = FINDING_TYPE_META[finding.type];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close finding detail"
        onClick={onClose}
        className="bg-ink-900/75 absolute inset-0 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        data-type={finding.type}
        className="bg-ink-850 border-ink-500 animate-rise relative flex h-full w-full max-w-2xl flex-col border-l shadow-2xl outline-none"
      >
        <header className="border-ink-500 type-bar flex items-start justify-between gap-4 border-b p-6">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <TypeChip type={finding.type} size="md" />
              {breakout ? (
                <span className="text-paper-mute border-ink-400 rounded-sm border px-2 py-0.5 font-mono text-[0.6875rem] font-semibold tracking-[0.1em] uppercase">
                  {breakout.shortName}
                </span>
              ) : null}
            </div>
            <h2 className="text-paper text-2xl leading-tight font-semibold text-balance">
              {finding.headline || "Untitled finding"}
            </h2>
            <p className="text-paper-faint mt-2 text-xs">{meta.blurb}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost shrink-0 px-2.5 py-1.5 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {isDrafted && transaction ? (
            <section className="border-signal/40 bg-signal/[0.07] mb-6 rounded-sm border p-4">
              <p className="eyebrow text-signal mb-3">Acquired at auction</p>
              <dl className="grid grid-cols-3 gap-4">
                <div>
                  <dt className="text-paper-faint text-[0.6875rem] tracking-wide uppercase">
                    Purchased by
                  </dt>
                  <dd className="text-paper mt-1 text-base font-semibold">
                    {panelist?.name ?? "—"}
                  </dd>
                </div>
                <div>
                  {/* The lens they were drafting through is the whole reason
                      this pick is interesting, so it sits beside the price. */}
                  <dt className="text-paper-faint text-[0.6875rem] tracking-wide uppercase">
                    Drafting as
                  </dt>
                  <dd className="text-paper mt-1 text-base font-semibold">
                    {panelist?.role || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-paper-faint text-[0.6875rem] tracking-wide uppercase">
                    Price
                  </dt>
                  <dd className="tabular text-signal mt-1 text-base font-semibold">
                    {transaction.price} credits
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}

          <dl className="space-y-6">
            <Row label="Breakout">{breakout?.name ?? "—"}</Row>

            <div className="grid grid-cols-2 gap-6">
              <Row label="Confidence">
                <span className="flex items-center gap-2">
                  <ConfidenceTag level={finding.confidence} />
                  <span className="text-paper-mute text-sm">
                    {CONFIDENCE_META[finding.confidence].label}
                  </span>
                </span>
              </Row>
              <Row label="Breakout rank">
                <RankTag rank={finding.breakoutRank} />
              </Row>
            </div>

            {finding.evidence ? (
              <Row label="Evidence">
                <EvidenceBlock
                  text={finding.evidence}
                  className="text-paper-dim text-sm leading-relaxed"
                />
              </Row>
            ) : null}

            {finding.whyItMatters ? (
              <Row label="Why it matters">
                <p className="text-paper-dim leading-relaxed whitespace-pre-line">
                  {finding.whyItMatters}
                </p>
              </Row>
            ) : null}

            {finding.dissent ? (
              <Row label="Dissenting view">
                <p className="border-ink-400 text-paper-mute border-l-2 pl-3 text-sm leading-relaxed whitespace-pre-line italic">
                  {finding.dissent}
                </p>
              </Row>
            ) : null}
          </dl>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow mb-2">{label}</dt>
      <dd className="text-paper text-[0.9375rem]">{children}</dd>
    </div>
  );
}
