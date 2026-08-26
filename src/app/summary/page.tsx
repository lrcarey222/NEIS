"use client";

import {
  allPanelistViews,
  buildSummary,
  findingsForBreakout,
  sortedBreakouts,
  transactionForFinding,
} from "@/lib/derive";
import { useEvent } from "@/lib/useEvent";
import { CONFIDENCE_META, FINDING_TYPE_META } from "@/lib/types";

/**
 * Print-oriented record of the whole session.
 *
 * Rendered as a plain document with its own light palette rather than the dark
 * presentation theme, so Ctrl-P / Save as PDF produces something that can be
 * circulated after the event without a black background.
 */
export default function SummaryPage() {
  const { state, status } = useEvent("summary");

  if (!state) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white p-8">
        <p className="font-mono text-xs tracking-widest text-[#666] uppercase">
          {status === "connecting" ? "Loading the event…" : "No event to summarise yet."}
        </p>
      </div>
    );
  }

  const panelists = allPanelistViews(state);
  const summary = buildSummary(state);
  const breakouts = sortedBreakouts(state);

  return (
    // Full-bleed white so the page reads as a document on screen as well as in
    // the print dialog, rather than a white column on the dark app background.
    <div className="min-h-dvh bg-white">
    <main className="mx-auto w-full max-w-4xl bg-white px-8 py-10 text-[#111] print:px-0 print:py-0">
      <div className="no-print mb-8 flex items-center justify-between gap-4 rounded border border-[#ddd] bg-[#fafafa] p-3">
        <p className="text-sm text-[#555]">
          Use your browser&apos;s Print dialog and choose “Save as PDF”.
        </p>
        <a
          href="../control/"
          className="rounded border border-[#ccc] px-3 py-1.5 text-sm font-semibold text-[#111] no-underline"
        >
          Back to control
        </a>
      </div>

      <header className="mb-8 border-b-2 border-[#111] pb-4">
        <p className="font-mono text-[0.6875rem] font-semibold tracking-[0.16em] text-[#666] uppercase">
          {state.event.subtitle || "Strategic Findings Auction"}
        </p>
        <h1 className="mt-1 text-3xl leading-tight font-bold">{state.event.title}</h1>
        <p className="mt-2 text-sm text-[#555]">
          {summary.submittedFindings} findings submitted · {summary.draftedFindings} acquired ·{" "}
          {summary.totalSpent} of {summary.totalBudget} credits committed
        </p>
      </header>

      {/* Portfolios */}
      <section className="mb-10">
        <h2 className="mb-4 border-b border-[#ccc] pb-1 text-lg font-bold">
          Final portfolios
        </h2>
        <div className="space-y-6">
          {panelists.map((view) => (
            <article key={view.panelist.id} className="break-inside-avoid">
              <header className="mb-2 flex items-baseline justify-between gap-4">
                <h3 className="text-base font-bold">
                  {view.panelist.name}
                  {view.panelist.affiliation ? (
                    <span className="ml-2 text-sm font-normal text-[#666]">
                      {view.panelist.affiliation}
                    </span>
                  ) : null}
                </h3>
                <p className="font-mono text-xs text-[#555]">
                  spent {view.spent} · remaining {view.remaining} · {view.filledCount}/
                  {view.slots.length} slots
                </p>
              </header>

              <table className="w-full border-collapse text-sm">
                <tbody>
                  {view.slots.map((slot) => (
                    <tr key={slot.objective.id} className="border-t border-[#e5e5e5]">
                      <td className="w-48 py-1.5 pr-3 align-top font-mono text-[0.625rem] tracking-wide text-[#666] uppercase">
                        {slot.objective.name}
                      </td>
                      <td className="py-1.5 pr-3 align-top">
                        {slot.finding ? (
                          <>
                            <span className="font-medium">{slot.finding.headline}</span>
                            <span className="block text-xs text-[#666]">
                              {slot.breakout?.name} ·{" "}
                              {FINDING_TYPE_META[slot.finding.type].label}
                            </span>
                          </>
                        ) : (
                          <span className="text-[#999] italic">Open</span>
                        )}
                      </td>
                      <td className="w-16 py-1.5 text-right align-top font-mono font-bold">
                        {slot.transaction?.price ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      </section>

      {/* Highest valued */}
      <section className="mb-10 break-inside-avoid">
        <h2 className="mb-3 border-b border-[#ccc] pb-1 text-lg font-bold">
          Highest-valued findings
        </h2>
        {summary.highestValued.length === 0 ? (
          <p className="text-sm text-[#666]">Nothing was sold.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {summary.highestValued.map((view, index) => (
              <li key={view.finding.id} className="flex gap-3">
                <span className="w-5 shrink-0 font-mono font-bold text-[#666]">
                  {index + 1}
                </span>
                <span className="flex-1">
                  <span className="font-medium">{view.finding.headline}</span>
                  <span className="block text-xs text-[#666]">
                    {view.breakout?.name} · {view.panelist?.name} · {view.objective?.name}
                  </span>
                </span>
                <span className="w-12 shrink-0 text-right font-mono font-bold">
                  {view.transaction?.price}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Breakout representation */}
      <section className="mb-10 break-inside-avoid">
        <h2 className="mb-3 border-b border-[#ccc] pb-1 text-lg font-bold">
          Breakout representation
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#ccc] text-left font-mono text-[0.625rem] tracking-wide text-[#666] uppercase">
              <th className="py-1.5">Breakout</th>
              <th className="py-1.5 text-right">Findings drafted</th>
              <th className="py-1.5 text-right">Credits</th>
            </tr>
          </thead>
          <tbody>
            {summary.breakoutRepresentation.map((row) => (
              <tr key={row.breakout.id} className="border-b border-[#eee]">
                <td className="py-1.5">{row.breakout.name}</td>
                <td className="py-1.5 text-right font-mono">{row.count}</td>
                <td className="py-1.5 text-right font-mono">{row.spend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Full findings record */}
      <section>
        <h2 className="mb-4 border-b border-[#ccc] pb-1 text-lg font-bold">
          All strategic findings
        </h2>
        {breakouts.map((breakout) => {
          const findings = findingsForBreakout(state, breakout.id).filter((f) => f.submitted);
          if (findings.length === 0) return null;

          return (
            <div key={breakout.id} className="mb-6 break-inside-avoid">
              <h3 className="mb-2 text-sm font-bold">{breakout.name}</h3>
              <ol className="space-y-3">
                {findings.map((finding) => {
                  const transaction = transactionForFinding(state, finding.id);
                  const buyer = transaction
                    ? state.panelists.find((p) => p.id === transaction.panelistId)
                    : null;

                  return (
                    <li key={finding.id} className="border-l-2 border-[#ddd] pl-3 text-sm">
                      <p className="font-mono text-[0.625rem] tracking-wide text-[#666] uppercase">
                        {FINDING_TYPE_META[finding.type].label} · rank {finding.breakoutRank} ·{" "}
                        {CONFIDENCE_META[finding.confidence].short} confidence
                        {transaction
                          ? ` · sold to ${buyer?.name} for ${transaction.price}`
                          : " · undrafted"}
                      </p>
                      <p className="mt-0.5 font-medium">{finding.headline}</p>
                      {finding.whatChanged ? (
                        <p className="mt-1 text-[#333]">{finding.whatChanged}</p>
                      ) : null}
                      {finding.evidence ? (
                        <p className="mt-1 whitespace-pre-line text-[#555]">{finding.evidence}</p>
                      ) : null}
                      {finding.whyItMatters ? (
                        <p className="mt-1 text-[#333]">
                          <em>Why it matters:</em> {finding.whyItMatters}
                        </p>
                      ) : null}
                      {finding.dissent ? (
                        <p className="mt-1 text-[#555]">
                          <em>Dissent:</em> {finding.dissent}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </section>

      <footer className="mt-10 border-t border-[#ccc] pt-3 font-mono text-[0.625rem] text-[#888]">
        Generated from the live event record.
      </footer>
    </main>
    </div>
  );
}
