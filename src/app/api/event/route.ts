import {
  asBool,
  asInt,
  asString,
  asTrimmed,
  clamp,
  fail,
  ok,
  oneOf,
  readJson,
  requireAdmin,
} from "@/lib/api";
import { mutate } from "@/lib/store";
import {
  DISPLAY_MODES,
  EVENT_STATUSES,
  type DisplayMode,
  type EventStatus,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface EventPatch {
  title?: string;
  subtitle?: string;
  startingBudget?: number;
  minBid?: number;
  displayMode?: DisplayMode;
  status?: EventStatus;
  declareWinner?: boolean;
  showSummary?: boolean;
  enforceBudgetReserve?: boolean;
  currentRoundIndex?: number;
  /** "next" | "prev" | number — convenience for the operator's round controls. */
  round?: "next" | "prev" | number;
  /** Apply a changed starting budget to every panelist as well. */
  applyBudgetToPanelists?: boolean;
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<EventPatch>(request);
  if (!body) return fail("Malformed request.");

  const next = await mutate("event.patch", (state) => {
    const event = state.event;

    if (body.title !== undefined) {
      event.title = asTrimmed(body.title) || event.title;
    }
    if (body.subtitle !== undefined) {
      event.subtitle = asString(body.subtitle).trim();
    }
    if (body.startingBudget !== undefined) {
      event.startingBudget = clamp(asInt(body.startingBudget, event.startingBudget), 1, 100_000);
      if (asBool(body.applyBudgetToPanelists, true)) {
        // Only safe before bidding starts; the operator is warned in the UI and
        // the guard below keeps a mid-auction change from rewriting the ledger.
        if (state.transactions.length === 0) {
          for (const panelist of state.panelists) {
            panelist.startingBudget = event.startingBudget;
          }
        }
      }
    }
    if (body.minBid !== undefined) {
      event.minBid = clamp(asInt(body.minBid, event.minBid), 0, 10_000);
    }
    if (body.displayMode !== undefined) {
      event.displayMode = oneOf(body.displayMode, DISPLAY_MODES, event.displayMode);
    }
    if (body.status !== undefined) {
      event.status = oneOf(body.status, EVENT_STATUSES, event.status);
    }
    if (body.declareWinner !== undefined) {
      event.declareWinner = asBool(body.declareWinner, event.declareWinner);
    }
    if (body.showSummary !== undefined) {
      event.showSummary = asBool(body.showSummary, event.showSummary);
    }
    if (body.enforceBudgetReserve !== undefined) {
      event.enforceBudgetReserve = asBool(
        body.enforceBudgetReserve,
        event.enforceBudgetReserve,
      );
    }

    const lastRound = state.objectives.length - 1;
    if (body.currentRoundIndex !== undefined) {
      event.currentRoundIndex = clamp(
        asInt(body.currentRoundIndex, event.currentRoundIndex),
        -1,
        lastRound,
      );
    }
    if (body.round === "next") {
      event.currentRoundIndex = clamp(event.currentRoundIndex + 1, -1, lastRound);
    } else if (body.round === "prev") {
      event.currentRoundIndex = clamp(event.currentRoundIndex - 1, -1, lastRound);
    } else if (typeof body.round === "number") {
      event.currentRoundIndex = clamp(asInt(body.round, -1), -1, lastRound);
    }
  });

  return ok(next);
}
