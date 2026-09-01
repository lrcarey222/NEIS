import {
  allFindingViews,
  allPanelistViews,
  buildAudienceSummary,
  byId,
  entrySpend,
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

// --- The four exports ------------------------------------------------------

/**
 * Every finding with its auction outcome and the room's verdict attached — the
 * master sheet, and the one worth keeping after the event.
 */
export function findingsCsv(state: EventState): string {
  const order = new Map(sortedBreakouts(state).map((b, i) => [b.id, i]));
  const audience = buildAudienceSummary(state);
  const stats = new Map(audience.stats.map((stat) => [stat.finding.id, stat]));

  const rows = allFindingViews(state)
    .sort(
      (a, b) =>
        (order.get(a.finding.breakoutId) ?? 0) - (order.get(b.finding.breakoutId) ?? 0) ||
        a.finding.breakoutRank - b.finding.breakoutRank,
    )
    .map((view) => {
      const stat = stats.get(view.finding.id);
      return [
        view.breakout?.name ?? "",
        FINDING_TYPE_META[view.finding.type].label,
        view.finding.breakoutRank,
        view.finding.headline,
        view.finding.evidence,
        view.finding.whyItMatters,
        CONFIDENCE_META[view.finding.confidence].short,
        view.finding.dissent,
        view.finding.submitted ? "yes" : "no",
        view.isDrafted ? "yes" : "no",
        view.panelist?.name ?? "",
        view.panelist?.role ?? "",
        view.transaction?.price ?? "",
        stat?.total ?? "",
        stat?.backers ?? "",
        stat ? stat.average.toFixed(2) : "",
        stat ? stat.delta.toFixed(2) : "",
      ];
    });

  return toCsv(
    [
      "Breakout",
      "Finding Type",
      "Breakout Rank",
      "Headline",
      "Evidence",
      "Why It Matters",
      "Confidence",
      "Dissent",
      "Submitted",
      "Drafted",
      "Winning Panelist",
      "Panelist Role",
      "Price Paid",
      "Audience Credits",
      "Audience Backers",
      "Audience Average",
      "Audience minus Panel",
    ],
    rows,
  );
}

/** The auction ledger, in the order the lots were actually sold. */
export function transactionsCsv(state: EventState): string {
  const findings = byId(state.findings);
  const panelists = byId(state.panelists);
  const breakouts = byId(state.breakouts);

  // Each panelist's picks are numbered in the order they won them, which is
  // the only positional meaning a pick has.
  const pickNumbers = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const t of [...state.transactions].sort((a, b) => a.timestamp - b.timestamp)) {
    const next = (counts.get(t.panelistId) ?? 0) + 1;
    counts.set(t.panelistId, next);
    pickNumbers.set(t.id, next);
  }

  const rows = [...state.transactions]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((t, index) => {
      const finding = findings.get(t.findingId);
      const panelist = panelists.get(t.panelistId);
      return [
        index + 1,
        new Date(t.timestamp).toISOString(),
        panelist?.name ?? "",
        panelist?.role ?? "",
        pickNumbers.get(t.id) ?? "",
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
      "Winning Panelist",
      "Panelist Role",
      "Their Pick #",
      "Price",
      "Finding",
      "Finding Type",
      "Breakout",
      "Operator Note",
    ],
    rows,
  );
}

/** One row per pick, including the ones left OPEN. */
export function portfoliosCsv(state: EventState): string {
  const rows = allPanelistViews(state).flatMap((view) =>
    view.slots.map((slot) => [
      view.panelist.name,
      view.panelist.affiliation,
      view.panelist.role,
      view.panelist.rolePrompt,
      view.startingBudget,
      view.spent,
      view.remaining,
      slot.index,
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
      "Role",
      "Action Prompt",
      "Starting Budget",
      "Total Spent",
      "Credits Remaining",
      "Pick #",
      "Finding",
      "Breakout",
      "Finding Type",
      "Price Paid",
    ],
    rows,
  );
}

/**
 * One row per audience member, with what they backed.
 *
 * Allocations are flattened into a single cell rather than a column per
 * finding: 25 mostly-empty columns is unreadable in Excel, and the per-finding
 * aggregates already live in the findings sheet.
 */
export function audienceCsv(state: EventState): string {
  const findings = byId(state.findings);

  const rows = [...state.audience]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((entry) => {
      const picks = Object.entries(entry.allocations)
        .sort(([, a], [, b]) => b - a)
        .map(
          ([findingId, credits]) =>
            `${credits} — ${findings.get(findingId)?.headline ?? findingId}`,
        );
      return [
        entry.name,
        entry.affiliation,
        entry.role,
        entry.submitted ? "yes" : "no",
        new Date(entry.createdAt).toISOString(),
        state.event.audienceBudget,
        entrySpend(entry),
        picks.length,
        picks.join("\n"),
      ];
    });

  return toCsv(
    [
      "Name",
      "Organisation",
      "Role",
      "Submitted",
      "Joined (UTC)",
      "Budget",
      "Credits Allocated",
      "Findings Backed",
      "Allocations",
    ],
    rows,
  );
}
