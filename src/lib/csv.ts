import {
  allFindingViews,
  allPanelistViews,
  auctionSlots,
  byId,
  findingCategory,
  lexicon,
  sortedBreakouts,
} from "./derive";
import { CONFIDENCE_META, type EventState } from "./types";

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

/**
 * Every breakout card with its auction outcome attached — the master sheet.
 *
 * Both framings' body fields are exported in every run: the columns a session
 * did not use come back empty, and the sheet stays comparable between a
 * findings event and an objectives one.
 */
export function findingsCsv(state: EventState): string {
  const order = new Map(sortedBreakouts(state).map((b, i) => [b.id, i]));
  const words = lexicon(state);

  const rows = allFindingViews(state)
    .sort(
      (a, b) =>
        (order.get(a.finding.breakoutId) ?? 0) - (order.get(b.finding.breakoutId) ?? 0) ||
        a.finding.breakoutRank - b.finding.breakoutRank,
    )
    .map((view) => [
      view.breakout?.name ?? "",
      view.category.label,
      view.finding.breakoutRank,
      view.finding.headline,
      view.finding.whatChanged,
      view.finding.evidence,
      view.finding.risks,
      view.finding.opportunities,
      view.finding.whyItMatters,
      CONFIDENCE_META[view.finding.confidence].short,
      view.finding.dissent,
      view.finding.submitted ? "yes" : "no",
      view.isDrafted ? "yes" : "no",
      view.panelist?.name ?? "",
      view.slot?.name ?? "",
      view.transaction?.price ?? "",
    ]);

  return toCsv(
    [
      "Breakout",
      `${words.Item} Category`,
      "Breakout Rank",
      "Headline",
      "What Changed",
      "Evidence",
      "Risks",
      "Opportunities",
      "Why It Matters",
      "Confidence",
      "Dissent",
      "Submitted",
      "Drafted",
      "Winning Panelist",
      words.Slot,
      "Price Paid",
    ],
    rows,
  );
}

/** The auction ledger, in the order the lots were actually sold. */
export function transactionsCsv(state: EventState): string {
  const findings = byId(state.findings);
  const panelists = byId(state.panelists);
  const slots = byId(auctionSlots(state));
  const breakouts = byId(state.breakouts);
  const words = lexicon(state);

  const rows = [...state.transactions]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((t, index) => {
      const finding = findings.get(t.findingId);
      return [
        index + 1,
        new Date(t.timestamp).toISOString(),
        slots.get(t.slotId)?.name ?? "",
        panelists.get(t.panelistId)?.name ?? "",
        t.price,
        finding?.headline ?? "",
        finding ? findingCategory(state, finding).label : "",
        finding ? (breakouts.get(finding.breakoutId)?.name ?? "") : "",
        t.note,
      ];
    });

  return toCsv(
    [
      "Order",
      "Timestamp (UTC)",
      words.Slot,
      "Winning Panelist",
      "Price",
      words.Item,
      `${words.Item} Category`,
      "Breakout",
      "Operator Note",
    ],
    rows,
  );
}

/** One row per panelist slot, including the ones left OPEN. */
export function portfoliosCsv(state: EventState): string {
  const words = lexicon(state);

  const rows = allPanelistViews(state).flatMap((view) =>
    view.slots.map((entry) => [
      view.panelist.name,
      view.panelist.affiliation,
      view.startingBudget,
      view.spent,
      view.remaining,
      entry.slot.name,
      entry.finding?.headline ?? "OPEN",
      entry.breakout?.name ?? "",
      entry.finding ? findingCategory(state, entry.finding).label : "",
      entry.transaction?.price ?? "",
    ]),
  );

  return toCsv(
    [
      "Panelist",
      "Affiliation",
      "Starting Budget",
      "Total Spent",
      "Credits Remaining",
      words.Slot,
      words.Item,
      "Breakout",
      `${words.Item} Category`,
      "Price Paid",
    ],
    rows,
  );
}
