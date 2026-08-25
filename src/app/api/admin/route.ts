import { asInt, asString, asTrimmed, fail, ok, readJson, requireAdmin } from "@/lib/api";
import { createBlankFindings, createEvent } from "@/lib/seed";
import { getState, mutate, replaceState } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminAction =
  | "create_demo_event"
  | "create_live_event"
  | "reset_auction"
  | "clear_findings"
  | "seed_blank_findings"
  | "submit_all_breakouts";

interface AdminPayload {
  action: AdminAction;
  title?: string;
  subtitle?: string;
  startingBudget?: number;
  minBid?: number;
  panelistNames?: string[];
  /** Required for the two destructive whole-event actions. */
  confirm?: string;
}

/**
 * Destructive and setup-level operations, kept behind an explicit action name
 * plus a typed confirmation so nothing here can fire from a stray click on a
 * laptop sitting open at the front of the room.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<AdminPayload>(request);
  if (!body?.action) return fail("Malformed request.");

  const destructive =
    body.action === "create_demo_event" ||
    body.action === "create_live_event" ||
    body.action === "clear_findings";

  if (destructive && asTrimmed(body.confirm).toUpperCase() !== "RESET") {
    return fail('Type RESET to confirm this action.', 428);
  }

  switch (body.action) {
    case "create_demo_event": {
      const next = await replaceState(
        "admin.create_demo_event",
        createEvent({
          demo: true,
          title: asTrimmed(body.title) || undefined,
          subtitle: asString(body.subtitle).trim() || undefined,
          startingBudget: body.startingBudget ? asInt(body.startingBudget, 100) : undefined,
          minBid: body.minBid !== undefined ? asInt(body.minBid, 1) : undefined,
          panelistNames: body.panelistNames?.map((n) => asTrimmed(n)).filter(Boolean),
        }),
      );
      return ok(next);
    }

    case "create_live_event": {
      const next = await replaceState(
        "admin.create_live_event",
        createEvent({
          demo: false,
          title: asTrimmed(body.title) || undefined,
          subtitle: asString(body.subtitle).trim() || undefined,
          startingBudget: body.startingBudget ? asInt(body.startingBudget, 100) : undefined,
          minBid: body.minBid !== undefined ? asInt(body.minBid, 1) : undefined,
          panelistNames: body.panelistNames?.map((n) => asTrimmed(n)).filter(Boolean),
        }),
      );
      return ok(next);
    }

    // Rehearse the auction again without losing the findings the breakouts
    // spent an hour producing.
    case "reset_auction": {
      const next = await mutate("admin.reset_auction", (draft) => {
        draft.transactions = [];
        draft.event.currentRoundIndex = -1;
        draft.event.displayMode = "board";
        draft.event.status = "breakouts";
      });
      return ok(next);
    }

    case "clear_findings": {
      const next = await mutate("admin.clear_findings", (draft) => {
        draft.findings = [];
        draft.transactions = [];
        for (const breakout of draft.breakouts) {
          breakout.submissionStatus = "not_started";
          breakout.submittedAt = null;
        }
        draft.event.currentRoundIndex = -1;
        draft.event.isDemo = false;
      });
      return ok(next);
    }

    // Gives every room its five empty templates so facilitators open their
    // page and start typing instead of clicking "add finding" five times.
    case "seed_blank_findings": {
      const next = await mutate("admin.seed_blank_findings", (draft) => {
        for (const breakout of draft.breakouts) {
          const has = draft.findings.some((f) => f.breakoutId === breakout.id);
          if (!has) draft.findings.push(...createBlankFindings(breakout.id));
        }
      });
      return ok(next);
    }

    case "submit_all_breakouts": {
      const next = await mutate("admin.submit_all_breakouts", (draft) => {
        for (const breakout of draft.breakouts) {
          breakout.submissionStatus = "submitted";
          breakout.submittedAt = Date.now();
        }
        for (const finding of draft.findings) finding.submitted = true;
      });
      return ok(next);
    }

    default:
      return fail("Unknown action.");
  }
}

/** Diagnostics for the operator: where state lives, how big it is. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const state = await getState();
  return ok({
    revision: state.revision,
    findings: state.findings.length,
    submitted: state.findings.filter((f) => f.submitted).length,
    transactions: state.transactions.length,
    panelists: state.panelists.length,
    objectives: state.objectives.length,
    isDemo: state.event.isDemo,
  });
}
