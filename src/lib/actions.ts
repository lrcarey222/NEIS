"use client";

import { roundCount, validateAward, type AwardInput } from "./derive";
import { net } from "./net";
import { createBlankFindings, createEvent, type CreateEventOptions } from "./seed";
import { toMap } from "./serialize";
import type {
  AudienceEntry,
  Breakout,
  Confidence,
  EventState,
  Finding,
  FindingType,
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
//
// The audience is the one exception to (1) and it is deliberate: each phone
// owns exactly one `audience/<id>` node and writes the whole thing, twice.
// Nobody else touches that node, so there is nothing to clobber, and two
// writes per person is what a conference network can carry from 150 handsets.
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

/** Clears the auction but keeps every finding the breakouts produced. */
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

/** Gives every room its five blank cards, skipping rooms that already have some. */
export async function seedBlankFindings(state: EventState): Promise<Result> {
  const updates: Record<string, unknown> = {};
  for (const breakout of state.breakouts) {
    if (state.findings.some((f) => f.breakoutId === breakout.id)) continue;
    for (const finding of createBlankFindings(breakout.id)) {
      updates[`findings/${finding.id}`] = finding;
    }
  }
  if (Object.keys(updates).length === 0) {
    return fail("Every breakout already has findings.");
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
 * Sets how many findings each panelist ends up holding.
 *
 * Refuses to drop below what somebody already owns: the picks would still be
 * in the ledger, the scoreboard would show a team over its own limit, and no
 * further bid from that panelist would validate. Undo first.
 */
export async function setRoundCount(
  state: EventState,
  count: number,
): Promise<Result> {
  const next = Math.floor(count);
  if (!Number.isFinite(next) || next < 1) {
    return fail("There has to be at least one round.");
  }
  if (next > 12) {
    return fail("Twelve rounds is the most a portfolio card can show legibly.");
  }

  const mostHeld = Math.max(
    0,
    ...state.panelists.map(
      (p) => state.transactions.filter((t) => t.panelistId === p.id).length,
    ),
  );
  if (next < mostHeld) {
    return fail(
      `A panelist already holds ${mostHeld} findings. Undo a pick before cutting the rounds to ${next}.`,
    );
  }

  return guard(() =>
    net().updatePaths({
      "event/roundCount": next,
      // The pointer can be left past the end when rounds are removed.
      "event/currentRoundIndex": Math.min(state.event.currentRoundIndex, next - 1),
    }),
  );
}

export async function setRound(state: EventState, target: number | "next" | "prev") {
  const last = roundCount(state) - 1;
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
    | "headline"
    | "evidence"
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
    headline: patch.headline ?? "",
    evidence: patch.evidence ?? "",
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
    return fail("This finding has been sold at auction. Undo the transaction first.");
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
    role: "",
    rolePrompt: "",
    startingBudget: state.event.startingBudget,
    sortOrder: state.panelists.length,
  };
  return guard(() => net().updatePaths({ [`panelists/${panelist.id}`]: panelist }));
}

export async function patchPanelist(
  state: EventState,
  id: string,
  patch: Partial<
    Pick<
      Panelist,
      "name" | "affiliation" | "role" | "rolePrompt" | "startingBudget" | "sortOrder"
    >
  >,
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

// --- The auction -----------------------------------------------------------

export interface AwardOptions extends AwardInput {
  acknowledgeWarnings?: boolean;
  /** Step the round on once every panelist has picked in the current one. */
  advanceWhenRoundComplete?: boolean;
  note?: string;
}

/**
 * Award a finding — the single most important write in the application.
 *
 * The validation runs *inside* a database transaction, against the committed
 * state rather than the copy this browser happened to be rendering. Two
 * operators on two laptops clicking AWARD on the same finding cannot both
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

    // Nobody bids in a fixed order, so "the round is over" is a fact about the
    // board rather than a click: it is over when every panelist has as many
    // findings as rounds played. Checked against `next` so the pick just
    // recorded counts towards it.
    if (options.advanceWhenRoundComplete) {
      const target = next.event.currentRoundIndex + 1;
      const everyoneHasPicked =
        next.panelists.length > 0 &&
        next.panelists.every(
          (p) => next.transactions.filter((t) => t.panelistId === p.id).length >= target,
        );
      if (everyoneHasPicked) {
        next.event.currentRoundIndex = Math.min(
          next.event.currentRoundIndex + 1,
          Math.max(1, Math.floor(next.event.roundCount || 1)) - 1,
        );
      }
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
  patch: Partial<Pick<Transaction, "panelistId" | "price" | "note">>,
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
      transactions: state.transactions.map((t) => (t === existing ? merged : t)),
      revision: (state.revision ?? 0) + 1,
    };
  });

  if (rejection) return rejection;
  if (!committed) return fail("Could not save — the board changed. Check it and retry.");
  return OK;
}

// --- Audience play-along ---------------------------------------------------

/**
 * Create or update one audience member's entry.
 *
 * The whole node is written, which is safe because nobody shares it, and it is
 * called twice in the normal case: once on joining (so the operator can watch
 * the room arrive) and once on submitting. Allocations are not streamed.
 */
export async function saveAudienceEntry(entry: AudienceEntry): Promise<Result> {
  const payload: AudienceEntry = {
    ...entry,
    name: entry.name.trim(),
    affiliation: entry.affiliation.trim(),
    role: entry.role.trim(),
    // RTDB deletes keys whose value is null and drops an empty object, so a
    // cleared allocation has to leave as an absent key rather than a zero.
    allocations: Object.fromEntries(
      Object.entries(entry.allocations).filter(([, credits]) => credits > 0),
    ),
    updatedAt: Date.now(),
  };
  return guard(() => net().updatePaths({ [`audience/${entry.id}`]: payload }));
}

/** Open or close /play. Closing leaves every entry in place. */
export async function setAudienceOpen(open: boolean): Promise<Result> {
  return guard(() => net().updatePaths({ "event/audienceOpen": open }));
}

export async function deleteAudienceEntry(id: string): Promise<Result> {
  return guard(() => net().removePath(`audience/${id}`));
}

/** Wipes the play-along so a rehearsal's entries do not pollute the real one. */
export async function clearAudience(): Promise<Result> {
  return guard(() => net().updatePaths({ audience: null }));
}

/** Used by the tests to build a state object the same way the app does. */
export { toMap };
