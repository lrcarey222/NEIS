import { csvResponse, toCsv } from "@/lib/csv";
import { byId } from "@/lib/derive";
import { getState } from "@/lib/store";
import { FINDING_TYPE_META } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The auction ledger, in the order the lots were actually sold. */
export async function GET() {
  const state = await getState();
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

  const csv = toCsv(
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

  return csvResponse("neis-auction-ledger.csv", csv);
}
