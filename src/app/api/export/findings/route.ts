import { csvResponse, toCsv } from "@/lib/csv";
import { allFindingViews, sortedBreakouts } from "@/lib/derive";
import { getState } from "@/lib/store";
import { CONFIDENCE_META, FINDING_TYPE_META } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Every finding with its auction outcome attached — the master sheet for
 * post-event analysis. Public, like /display: it is the record of a public
 * session and the operator should never have to hunt for a PIN to hand it over.
 */
export async function GET() {
  const state = await getState();
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

  const csv = toCsv(
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

  return csvResponse("neis-findings.csv", csv);
}
