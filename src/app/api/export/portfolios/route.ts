import { csvResponse, toCsv } from "@/lib/csv";
import { allPanelistViews } from "@/lib/derive";
import { getState } from "@/lib/store";
import { FINDING_TYPE_META } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** One row per panelist-objective slot, including the ones left OPEN. */
export async function GET() {
  const state = await getState();

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

  const csv = toCsv(
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

  return csvResponse("neis-final-portfolios.csv", csv);
}
