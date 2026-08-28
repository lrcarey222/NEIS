"use client";

import { auctionSlots, blankCardPlan, validateAward, type AwardInput } from "./derive";
import { net } from "./net";
import { createBlankFindings, createEvent, type CreateEventOptions } from "./seed";
import { toMap } from "./serialize";
import type {
  Breakout,
  Confidence,
  EventState,
  Finding,
  FindingType,
  Framing,
  Objective,
  Panelist,
  SubmissionStatus,
  Transaction,
} from "./types";

// ---------------------------------------------------------------------------
// Every mutation in the app.
//
// These replaced the server API routes when the backend became Firebase. Two
// rules shape the whole file:
//
//   1. Writes are as narrow as possible. A facilitator typing a headline writes
//      `findings/<id>/headline`, not the whole finding and certainly not the
//      whole event. That is what lets five breakout tables — and two people at
//      the same table — edit simultaneously without overwriting each other.
//
//   2. Anything that must not race goes through `transact`, which re-validates
//      against the committed state inside a database transaction. Only awards
//      and undo need this, but for them it is the difference between a correct
//      scoreboard and a finding sold twice.
// ---------------------------------------------------------------------------

export interface Result {
  ok: boolean;
  error?: string;
  warnings?: string[];
}

const OK: Result = { ok: true };

function fail(error: string, warnings?: string[]): Result {
  return { ok: false, error, warnings };
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

async function guard(run: () => Promise<void>): Promise<Result> {
  try {
    await run();
    return OK;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/permission_denied/i.test(message)) {
      return fail(
        "The database rejected that write. Publish database.rules.json in the Firebase console.",
      );
    }
    return fail(message || "Could not save. Check the connection.");
  }
}

// --- Event lifecycle -------------------------------------------------------

export async function createNewEvent(options: CreateEventOptions): Promise<Result> {
  return guard(() => net().writeEvent(createEvent(options)));
}

/** Clears the auction but keeps every card the breakouts produced. */
export async function resetAuction(): Promise<Result> {
  return guard(() =>
    net().updatePaths({
      transactions: null,
      "event/currentRoundIndex": -1,
      "event/displayMode": "board",
      "event/status": "breakouts",
      "event/showSummary": false,
    }),
  );
}

export async function clearFindings(state: EventState): Promise<Result> {
  const updates: Record<string, unknown> = {
    findings: null,
    transactions: null,
    "event/currentRoundIndex": -1,
    "event/isDemo": false,
  };
  for (const breakout of state.breakouts) {
    updates[`breakouts/${breakout.id}/submissionStatus`] = "not_started";
    updates[`breakouts/${breakout.id}/submittedAt`] = null;
  }
  return guard(() => net().updatePaths(updates));
}

/**
 * Gives every room its blank cards, skipping rooms that already have some.
 *
 * The roster follows the breakout framing: five typed findings, or one card per
 * strategic objective.
 */
export async function seedBlankFindings(state: EventState): Promise<Result> {
  const plan = blankCardPlan(state);
  if (plan.length === 0) {
    return fail("There are no strategic objectives to build cards from. Add some first.");
  }

  const updates: Record<string, unknown> = {};
  for (const breakout of state.breakouts) {
    if (state.findings.some((f) => f.breakoutId === breakout.id)) continue;
    for (const finding of createBlankFindings(breakout.id, plan)) {
      updates[`findings/${finding.id}`] = finding;
    }
  }
  if (Object.keys(updates).length === 0) {
    return fail("Every breakout already has cards.");
  }
  return guard(() => net().updatePaths(updates));
}

/**
 * Throws away every card and re-seeds blanks for the current framing.
 *
 * The escape hatch for switching the breakout framing after the rooms have
 * already been seeded: the existing cards carry the wrong roster, and no
 * per-card edit fixes that. Destructive, so /control keeps it behind RESET.
 */
export async function rebuildBreakoutCards(state: EventState): Promise<Result> {
  const plan = blankCardPlan(state);
  if (plan.length === 0) {
    return fail("There are no strategic objectives to build cards from. Add some first.");
  }
  if (state.transactions.length > 0) {
    return fail("Cards have already been sold at auction. Reset the auction first.");
  }

  // The whole `findings` node is replaced in one path rather than as
  // `findings/<id>` entries plus a `findings: null` — Firebase rejects a
  // multi-path update whose keys are ancestors of one another.
  const replacement: Record<string, Finding> = {};
  const updates: Record<string, unknown> = { findings: replacement };
  for (const breakout of state.breakouts) {
    updates[`breakouts/${breakout.id}/submissionStatus`] = "not_started";
    updates[`breakouts/${breakout.id}/submittedAt`] = null;
    for (const finding of createBlankFindings(breakout.id, plan)) {
      replacement[finding.id] = finding;
    }
  }
  return guard(() => net().updatePaths(updates));
}

export async function submitAllBreakouts(state: EventState): Promise<Result> {
  const updates: Record<string, unknown> = {};
  for (const breakout of state.breakouts) {
    updates[`breakouts/${breakout.id}/submissionStatus`] = "submitted";
    updates[`breakouts/${breakout.id}/submittedAt`] = Date.now();
  }
  for (const finding of state.findings) {
    updates[`findings/${finding.id}/submitted`] = true;
  }
  return guard(() => net().updatePaths(updates));
}

// --- Event settings --------------------------------------------------------

type EventPatch = Partial<EventState["event"]> & {
  applyBudgetToPanelists?: boolean;
};

export async function patchEvent(
  state: EventState,
  patch: EventPatch,
): Promise<Result> {
  const { applyBudgetToPanelists, ...fields } = patch;
  const updates: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) updates[`event/${key}`] = value;
  }

  // Changing the event budget rewrites every panelist, but only before any
  // credits have been spent — afterwards it would silently rewrite the ledger.
  if (applyBudgetToPanelists && fields.startingBudget !== undefined) {
    if (state.transactions.length === 0) {
      for (const panelist of state.panelists) {
        updates[`panelists/${panelist.id}/startingBudget`] = fields.startingBudget;
      }
    }
  }

  return guard(() => net().updatePaths(updates));
}

/**
 * Switch what the breakouts write, or what the panel's teams are made of.
 *
 * Separate from `patchEvent` because the two fields have consequences a generic
 * field write would not carry: the auction framing redefines what a round *is*,
 * so the round pointer has to go back to standby, and it cannot change at all
 * once transactions exist because every recorded `slotId` would stop resolving.
 */
export async function setFraming(
  state: EventState,
  patch: { breakoutFraming?: Framing; auctionFraming?: Framing },
): Promise<Result> {
  const updates: Record<string, unknown> = {};

  if (patch.breakoutFraming && patch.breakoutFraming !== state.event.breakoutFraming) {
    updates["event/breakoutFraming"] = patch.breakoutFraming;
  }

  if (patch.auctionFraming && patch.auctionFraming !== state.event.auctionFraming) {
    if (state.transactions.length > 0) {
      return fail(
        "The auction has started, and every recorded award points at a slot in the current format. Reset the auction first.",
      );
    }
    updates["event/auctionFraming"] = patch.auctionFraming;
    updates["event/currentRoundIndex"] = -1;
  }

  if (Object.keys(updates).length === 0) return OK;
  return guard(() => net().updatePaths(updates));
}

export async function setRound(state: EventState, target: number | "next" | "prev") {
  const last = auctionSlots(state).length - 1;
  const current = state.event.currentRoundIndex;
  const next =
    target === "next" ? current + 1 : target === "prev" ? current - 1 : target;
  return patchEvent(state, {
    currentRoundIndex: Math.max(-1, Math.min(last, next)),
  });
}

// --- Timer -----------------------------------------------------------------

export type TimerAction = "start" | "pause" | "resume" | "reset" | "hide" | "show";

export async function patchTimer(
  state: EventState,
  action: TimerAction,
  options: { seconds?: number; label?: string } = {},
): Promise<Result> {
  const timer = state.timer;
  const now = Date.now();
  const updates: Record<string, unknown> = {};

  switch (action) {
    case "start":
      updates["timer/endsAt"] = now + Math.max(0, options.seconds ?? 600) * 1000;
      updates["timer/pausedRemainingMs"] = null;
      updates["timer/running"] = true;
      updates["timer/visible"] = true;
      if (options.label !== undefined) updates["timer/label"] = options.label;
      break;
    case "pause":
      if (!timer.running || !timer.endsAt) return OK;
      updates["timer/pausedRemainingMs"] = Math.max(0, timer.endsAt - now);
      updates["timer/running"] = false;
      break;
    case "resume":
      if (timer.running || timer.pausedRemainingMs === null) return OK;
      updates["timer/endsAt"] = now + timer.pausedRemainingMs;
      updates["timer/pausedRemainingMs"] = null;
      updates["timer/running"] = true;
      updates["timer/visible"] = true;
      break;
    case "reset":
      updates["timer/endsAt"] = null;
      updates["timer/pausedRemainingMs"] = null;
      updates["timer/running"] = false;
      break;
    case "hide":
      updates["timer/visible"] = false;
      break;
    case "show":
      updates["timer/visible"] = true;
      break;
  }

  return guard(() => net().updatePaths(updates));
}

// --- Findings --------------------------------------------------------------

export type FindingPatch = Partial<
  Pick<
    Finding,
    | "type"
    | "objectiveId"
    | "headline"
    | "whatChanged"
    | "evidence"
    | "risks"
    | "opportunities"
    | "whyItMatters"
    | "confidence"
    | "breakoutRank"
    | "dissent"
    | "submitted"
  >
>;

/**
 * Field-level write. This is the hot path during the breakout session: one
 * call per field, per blur, so concurrent editing never clobbers.
 */
export async function patchFinding(id: string, patch: FindingPatch): Promise<Result> {
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) updates[`findings/${id}/${key}`] = value;
  }
  if (Object.keys(updates).length === 0) return OK;
  updates[`findings/${id}/updatedAt`] = Date.now();
  return guard(() => net().updatePaths(updates));
}

export async function createFinding(
  state: EventState,
  breakoutId: string,
  patch: FindingPatch = {},
): Promise<Result> {
  const siblings = state.findings.filter((f) => f.breakoutId === breakoutId);
  const now = Date.now();
  const finding: Finding = {
    id: newId("fd"),
    breakoutId,
    type: patch.type ?? "momentum",
    objectiveId: patch.objectiveId ?? "",
    headline: patch.headline ?? "",
    whatChanged: patch.whatChanged ?? "",
    evidence: patch.evidence ?? "",
    risks: patch.risks ?? "",
    opportunities: patch.opportunities ?? "",
    whyItMatters: patch.whyItMatters ?? "",
    confidence: patch.confidence ?? "medium",
    breakoutRank: patch.breakoutRank ?? siblings.length + 1,
    dissent: patch.dissent ?? "",
    submitted: patch.submitted ?? false,
    createdAt: now,
    updatedAt: now,
  };
  return guard(() => net().updatePaths({ [`findings/${finding.id}`]: finding }));
}

export async function deleteFinding(state: EventState, id: string): Promise<Result> {
  if (state.transactions.some((t) => t.findingId === id)) {
    return fail("This card has been sold at auction. Undo the transaction first.");
  }
  return guard(() => net().removePath(`findings/${id}`));
}

export async function reorderFindings(orderedIds: string[]): Promise<Result> {
  const updates: Record<string, unknown> = {};
  orderedIds.forEach((id, index) => {
    updates[`findings/${id}/breakoutRank`] = index + 1;
  });
  return guard(() => net().updatePaths(updates));
}

// --- Breakouts -------------------------------------------------------------

export async function patchBreakout(
  state: EventState,
  slug: string,
  patch: Partial<Pick<Breakout, "name" | "shortName" | "description" | "pin">> & {
    submissionStatus?: SubmissionStatus;
  },
): Promise<Result> {
  const breakout = state.breakouts.find((b) => b.slug === slug);
  if (!breakout) return fail("Unknown breakout.");

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "submissionStatus" || value === undefined) continue;
    updates[`breakouts/${breakout.id}/${key}`] = value;
  }

  if (patch.submissionStatus !== undefined) {
    const status = patch.submissionStatus;
    updates[`breakouts/${breakout.id}/submissionStatus`] = status;
    updates[`breakouts/${breakout.id}/submittedAt`] =
      status === "submitted" ? Date.now() : null;

    // Submitting publishes the room's findings to the board in one step;
    // reopening pulls them back so a half-edited card is never on screen.
    for (const finding of state.findings) {
      if (finding.breakoutId === breakout.id) {
        updates[`findings/${finding.id}/submitted`] = status === "submitted";
      }
    }
  }

  return guard(() => net().updatePaths(updates));
}

// --- Panelists -------------------------------------------------------------

export async function createPanelist(state: EventState): Promise<Result> {
  const panelist: Panelist = {
    id: newId("pl"),
    name: `Panelist ${state.panelists.length + 1}`,
    affiliation: "",
    startingBudget: state.event.startingBudget,
    sortOrder: state.panelists.length,
  };
  return guard(() => net().updatePaths({ [`panelists/${panelist.id}`]: panelist }));
}

export async function patchPanelist(
  state: EventState,
  id: string,
  patch: Partial<Pick<Panelist, "name" | "affiliation" | "startingBudget" | "sortOrder">>,
): Promise<Result> {
  const panelist = state.panelists.find((p) => p.id === id);
  if (!panelist) return fail("Unknown panelist.");

  // A budget below what has already been spent would show a negative balance
  // on the big screen. Refuse rather than render nonsense.
  if (patch.startingBudget !== undefined) {
    const spent = state.transactions
      .filter((t) => t.panelistId === id)
      .reduce((sum, t) => sum + t.price, 0);
    if (patch.startingBudget < spent) {
      return fail(
        `${panelist.name} has already spent ${spent} credits. Set the budget to at least that, or undo a transaction first.`,
      );
    }
  }

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) updates[`panelists/${id}/${key}`] = value;
  }
  return guard(() => net().updatePaths(updates));
}

export async function deletePanelist(state: EventState, id: string): Promise<Result> {
  if (state.transactions.some((t) => t.panelistId === id)) {
    return fail("This panelist has already acquired findings. Undo their transactions first.");
  }
  return guard(() => net().removePath(`panelists/${id}`));
}

// --- Objectives ------------------------------------------------------------

export async function createObjective(state: EventState): Promise<Result> {
  const objective: Objective = {
    id: newId("ob"),
    name: `Objective ${state.objectives.length + 1}`,
    shortName: "Objective",
    prompt: "",
    roundOrder: state.objectives.length,
  };
  return guard(() => net().updatePaths({ [`objectives/${objective.id}`]: objective }));
}

export async function patchObjective(
  id: string,
  patch: Partial<Pick<Objective, "name" | "shortName" | "prompt" | "roundOrder">>,
): Promise<Result> {
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) updates[`objectives/${id}/${key}`] = value;
  }
  return guard(() => net().updatePaths(updates));
}

export async function reorderObjectives(orderedIds: string[]): Promise<Result> {
  const updates: Record<string, unknown> = {};
  orderedIds.forEach((id, index) => {
    updates[`objectives/${id}/roundOrder`] = index;
  });
  return guard(() => net().updatePaths(updates));
}

export async function deleteObjective(state: EventState, id: string): Promise<Result> {
  if (state.transactions.some((t) => t.slotId === id)) {
    return fail(
      "Cards have already been bought for this objective. Undo those transactions first.",
    );
  }
  // Under the objectives framing the rooms write one card *per* objective, so
  // removing one would orphan five cards mid-session.
  if (
    state.event.breakoutFraming === "objectives" &&
    state.findings.some((f) => f.objectiveId === id)
  ) {
    return fail(
      "The breakout rooms have cards for this objective. Clear or rebuild the cards first.",
    );
  }
  return guard(() => net().removePath(`objectives/${id}`));
}

// --- The auction -----------------------------------------------------------

export interface AwardOptions extends AwardInput {
  acknowledgeWarnings?: boolean;
  advanceRound?: boolean;
  note?: string;
}

/**
 * Award a card — the single most important write in the application.
 *
 * The validation runs *inside* a database transaction, against the committed
 * state rather than the copy this browser happened to be rendering. Two
 * operators on two laptops clicking AWARD on the same card cannot both
 * succeed: the second attempt re-reads, fails validation, and aborts.
 */
export async function awardFinding(options: AwardOptions): Promise<Result> {
  let rejection: Result | null = null;

  const committed = await net().transact((state) => {
    if (!state) {
      rejection = fail("The event is no longer available.");
      return null;
    }

    const validation = validateAward(state, options);

    if (!validation.ok) {
      rejection = fail(validation.errors.map((e) => e.message).join(" "));
      return null;
    }
    if (validation.warnings.length > 0 && !options.acknowledgeWarnings) {
      rejection = fail(
        "Confirm the warnings before awarding.",
        validation.warnings.map((w) => w.message),
      );
      return null;
    }

    const transaction: Transaction = {
      id: newId("tx"),
      findingId: options.findingId,
      panelistId: options.panelistId,
      slotId: options.slotId,
      price: options.price,
      timestamp: Date.now(),
      note: options.note ?? "",
    };

    const next: EventState = {
      ...state,
      transactions: [...state.transactions, transaction],
      event: { ...state.event },
    };

    if (next.event.status === "setup" || next.event.status === "breakouts") {
      next.event.status = "auction";
    }
    if (options.advanceRound) {
      next.event.currentRoundIndex = Math.min(
        next.event.currentRoundIndex + 1,
        auctionSlots(next).length - 1,
      );
    }
    next.revision = (state.revision ?? 0) + 1;
    return next;
  });

  if (rejection) return rejection;
  if (!committed) {
    return fail("Someone else changed the board at the same moment. Check it and retry.");
  }
  return OK;
}

/** Undo. Omit `id` for "the most recent transaction" — the big red button. */
export async function undoTransaction(
  id?: string,
  rewindRound = false,
): Promise<Result> {
  let rejection: Result | null = null;

  const committed = await net().transact((state) => {
    if (!state || state.transactions.length === 0) {
      rejection = fail("There is nothing to undo.");
      return null;
    }

    const target = id
      ? state.transactions.find((t) => t.id === id)
      : [...state.transactions].sort((a, b) => b.timestamp - a.timestamp)[0];

    if (!target) {
      rejection = fail("That transaction no longer exists.");
      return null;
    }

    const next: EventState = {
      ...state,
      transactions: state.transactions.filter((t) => t.id !== target.id),
      event: { ...state.event },
      revision: (state.revision ?? 0) + 1,
    };
    if (rewindRound) {
      next.event.currentRoundIndex = Math.max(-1, next.event.currentRoundIndex - 1);
    }
    return next;
  });

  if (rejection) return rejection;
  if (!committed) return fail("Could not undo — the board changed. Check it and retry.");

  // Availability and budgets are derived from the transaction list, so removing
  // that one row is the entire rollback.
  return OK;
}

/** Correct a recorded transaction in place — wrong price, wrong panelist. */
export async function patchTransaction(
  id: string,
  patch: Partial<Pick<Transaction, "panelistId" | "slotId" | "price" | "note">>,
  acknowledgeWarnings = false,
): Promise<Result> {
  let rejection: Result | null = null;

  const committed = await net().transact((state) => {
    if (!state) return null;
    const existing = state.transactions.find((t) => t.id === id);
    if (!existing) {
      rejection = fail("That transaction no longer exists.");
      return null;
    }

    const merged: Transaction = { ...existing, ...patch };
    const validation = validateAward(state, {
      findingId: merged.findingId,
      panelistId: merged.panelistId,
      slotId: merged.slotId,
      price: merged.price,
      excludeTransactionId: id,
    });

    if (!validation.ok) {
      rejection = fail(validation.errors.map((e) => e.message).join(" "));
      return null;
    }
    if (validation.warnings.length > 0 && !acknowledgeWarnings) {
      rejection = fail(
        "Confirm the warnings before saving.",
        validation.warnings.map((w) => w.message),
      );
      return null;
    }

    return {
      ...state,
      transactions: state.transactions.map((t) => (t.id === id ? merged : t)),
      revision: (state.revision ?? 0) + 1,
    };
  });

  if (rejection) return rejection;
  if (!committed) return fail("Could not save — the board changed. Check it and retry.");
  return OK;
}

/** Used by the tests to build a state object the same way the app does. */
export { toMap };
