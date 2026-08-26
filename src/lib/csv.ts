import {
  allFindingViews,
  allPanelistViews,
  byId,
  sortedBreakouts,
} from "./derive";
import {
  CONFIDENCE_META,
  FINDING_TYPE_META,
  type EventState,
} from "./types";

/** RFC 4180 escaping. Excel is the target consumer, so CRLF line endings. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(",")];
  for (const row of rows) lines.push(row.map(cell).join(","));
  // Leading BOM so Excel opens UTF-8 accented characters correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

/**
 * Hands the browser a file.
 *
 * On a static site there is no download endpoint, so the CSV is built in the
 * page and handed over as a blob URL. Revoked on the next tick to avoid
 * leaking a reference for every export the operator takes.
 */
export function downloadCsv(filename: string, body: string): void {
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// --- The three exports -----------------------------------------------------

/** Every finding with its auction outcome attached — the master sheet. */
export function findingsCsv(state: EventState): string {
  const order = new Map(sortedBreakouts(state).map((b, i) => [b.id, i]));

  const rows = allFindingViews(state)
    .sort(
      (a, b) =>
        (order.get(a.finding.breakoutId) ?? 0) - (order.get(b.finding.breakoutId) ?? 0) ||
        a.finding.breakoutRank - b.finding.breakoutRank,
    )
    .map((view) => [
      view.breakout?.name ?? "",
      FINDING_TYPE_META[view.finding.type].label,
      view.finding.breakoutRank,
      view.finding.headline,
      view.finding.whatChanged,
      view.finding.evidence,
      view.finding.whyItMatters,
      CONFIDENCE_META[view.finding.confidence].short,
      view.finding.dissent,
      view.finding.submitted ? "yes" : "no",
      view.isDrafted ? "yes" : "no",
      view.panelist?.name ?? "",
      view.objective?.name ?? "",
      view.transaction?.price ?? "",
    ]);

  return toCsv(
    [
      "Breakout",
      "Finding Type",
      "Breakout Rank",
      "Headline",
      "What Changed",
      "Evidence",
      "Why It Matters",
      "Confidence",
      "Dissent",
      "Submitted",
      "Drafted",
      "Winning Panelist",
      "Strategic Objective",
      "Price Paid",
    ],
    rows,
  );
}

/** The auction ledger, in the order the lots were actually sold. */
export function transactionsCsv(state: EventState): string {
  const findings = byId(state.findings);
  const panelists = byId(state.panelists);
  const objectives = byId(state.objectives);
  const breakouts = byId(state.breakouts);

  const rows = [...state.transactions]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((t, index) => {
      const finding = findings.get(t.findingId);
      return [
        index + 1,
        new Date(t.timestamp).toISOString(),
        objectives.get(t.objectiveId)?.name ?? "",
        panelists.get(t.panelistId)?.name ?? "",
        t.price,
        finding?.headline ?? "",
        finding ? FINDING_TYPE_META[finding.type].label : "",
        finding ? (breakouts.get(finding.breakoutId)?.name ?? "") : "",
        t.note,
      ];
    });

  return toCsv(
    [
      "Order",
      "Timestamp (UTC)",
      "Strategic Objective",
      "Winning Panelist",
      "Price",
      "Finding",
      "Finding Type",
      "Breakout",
      "Operator Note",
    ],
    rows,
  );
}

/** One row per panelist-objective slot, including the ones left OPEN. */
export function portfoliosCsv(state: EventState): string {
  const rows = allPanelistViews(state).flatMap((view) =>
    view.slots.map((slot) => [
      view.panelist.name,
      view.panelist.affiliation,
      view.startingBudget,
      view.spent,
      view.remaining,
      slot.objective.name,
      slot.finding?.headline ?? "OPEN",
      slot.breakout?.name ?? "",
      slot.finding ? FINDING_TYPE_META[slot.finding.type].label : "",
      slot.transaction?.price ?? "",
    ]),
  );

  return toCsv(
    [
      "Panelist",
      "Affiliation",
      "Starting Budget",
      "Total Spent",
      "Credits Remaining",
      "Strategic Objective",
      "Finding",
      "Breakout",
      "Finding Type",
      "Price Paid",
    ],
    rows,
  );
}
