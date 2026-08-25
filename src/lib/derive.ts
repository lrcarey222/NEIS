// ---------------------------------------------------------------------------
// Everything the UI needs, computed from the raw EventState.
//
// This module is pure and dependency-free so the same functions run on the
// server (to validate an award before it is written) and in the browser (to
// preview that award live as the operator types). One implementation means the
// warning the operator sees is exactly the rule the server enforces.
// ---------------------------------------------------------------------------

import type {
  Breakout,
  EventState,
  Finding,
  Objective,
  Panelist,
  Transaction,
} from "./types";

export interface PanelistSlot {
  objective: Objective;
  transaction: Transaction | null;
  finding: Finding | null;
  breakout: Breakout | null;
}

export interface PanelistView {
  panelist: Panelist;
  startingBudget: number;
  spent: number;
  remaining: number;
  /** Slots in round order, one per objective, filled or OPEN. */
  slots: PanelistSlot[];
  filledCount: number;
  openCount: number;
  /** Credits that must be held back to afford the remaining slots at minBid. */
  reserveRequired: number;
  /** Most the panelist can bid right now without breaking the reserve rule. */
  maxSafeBid: number;
  /** breakoutId -> number of findings acquired from it. */
  breakoutCounts: Record<string, number>;
}

export interface FindingView {
  finding: Finding;
  breakout: Breakout | null;
  transaction: Transaction | null;
  panelist: Panelist | null;
  objective: Objective | null;
  isDrafted: boolean;
  /** Submitted by its breakout and not yet sold. */
  isAvailable: boolean;
}

// --- Lookups ---------------------------------------------------------------

export function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export function sortedObjectives(state: EventState): Objective[] {
  return [...state.objectives].sort((a, b) => a.roundOrder - b.roundOrder);
}

export function sortedBreakouts(state: EventState): Breakout[] {
  return [...state.breakouts].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function sortedPanelists(state: EventState): Panelist[] {
  return [...state.panelists].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Findings for one breakout, ordered by the breakout's own 1–5 ranking. */
export function findingsForBreakout(
  state: EventState,
  breakoutId: string,
): Finding[] {
  return state.findings
    .filter((f) => f.breakoutId === breakoutId)
    .sort((a, b) => a.breakoutRank - b.breakoutRank || a.createdAt - b.createdAt);
}

/** The live transaction for a finding, or null if it is still on the board. */
export function transactionForFinding(
  state: EventState,
  findingId: string,
): Transaction | null {
  return state.transactions.find((t) => t.findingId === findingId) ?? null;
}

// --- Views -----------------------------------------------------------------

export function buildFindingView(
  state: EventState,
  finding: Finding,
): FindingView {
  const transaction = transactionForFinding(state, finding.id);
  const breakout = state.breakouts.find((b) => b.id === finding.breakoutId) ?? null;
  const panelist = transaction
    ? (state.panelists.find((p) => p.id === transaction.panelistId) ?? null)
    : null;
  const objective = transaction
    ? (state.objectives.find((o) => o.id === transaction.objectiveId) ?? null)
    : null;

  return {
    finding,
    breakout,
    transaction,
    panelist,
    objective,
    isDrafted: transaction !== null,
    isAvailable: finding.submitted && transaction === null,
  };
}

export function allFindingViews(state: EventState): FindingView[] {
  return state.findings.map((f) => buildFindingView(state, f));
}

/** Findings that can still be bought: submitted, not yet sold. */
export function availableFindings(state: EventState): FindingView[] {
  return allFindingViews(state).filter((v) => v.isAvailable);
}

export function buildPanelistView(
  state: EventState,
  panelist: Panelist,
): PanelistView {
  const objectives = sortedObjectives(state);
  const findings = byId(state.findings);
  const breakouts = byId(state.breakouts);
  const mine = state.transactions.filter((t) => t.panelistId === panelist.id);

  const slots: PanelistSlot[] = objectives.map((objective) => {
    const transaction = mine.find((t) => t.objectiveId === objective.id) ?? null;
    const finding = transaction
      ? (findings.get(transaction.findingId) ?? null)
      : null;
    const breakout = finding ? (breakouts.get(finding.breakoutId) ?? null) : null;
    return { objective, transaction, finding, breakout };
  });

  const spent = mine.reduce((sum, t) => sum + t.price, 0);
  const startingBudget = panelist.startingBudget;
  const remaining = startingBudget - spent;

  const filledCount = slots.filter((s) => s.transaction !== null).length;
  const openCount = slots.length - filledCount;

  // After winning the current lot the panelist still owes minBid for each of
  // the other open slots, so that much has to stay in the bank.
  const slotsAfterThisOne = Math.max(0, openCount - 1);
  const reserveRequired = slotsAfterThisOne * state.event.minBid;
  const maxSafeBid = Math.max(0, remaining - reserveRequired);

  const breakoutCounts: Record<string, number> = {};
  for (const slot of slots) {
    if (slot.finding) {
      breakoutCounts[slot.finding.breakoutId] =
        (breakoutCounts[slot.finding.breakoutId] ?? 0) + 1;
    }
  }

  return {
    panelist,
    startingBudget,
    spent,
    remaining,
    slots,
    filledCount,
    openCount,
    reserveRequired,
    maxSafeBid,
    breakoutCounts,
  };
}

export function allPanelistViews(state: EventState): PanelistView[] {
  return sortedPanelists(state).map((p) => buildPanelistView(state, p));
}

// --- Rounds ----------------------------------------------------------------

export function currentObjective(state: EventState): Objective | null {
  const objectives = sortedObjectives(state);
  const index = state.event.currentRoundIndex;
  if (index < 0 || index >= objectives.length) return null;
  return objectives[index];
}

// --- Award validation ------------------------------------------------------

export interface AwardInput {
  findingId: string;
  panelistId: string;
  objectiveId: string;
  price: number;
  /** Set when editing an existing transaction so it excludes itself. */
  excludeTransactionId?: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface AwardValidation {
  /** Hard rule violations. The server refuses to write when this is non-empty. */
  errors: ValidationIssue[];
  /** Soft advisories. Shown to the operator; overridable unless configured otherwise. */
  warnings: ValidationIssue[];
  ok: boolean;
}

/**
 * Applies every auction rule to a proposed award.
 *
 * Hard errors (a panelist overspending, double-buying an objective, a finding
 * being sold twice) can never be overridden — they would corrupt the
 * scoreboard. The budget-reserve rule is a warning by default, because a
 * moderator may legitimately let a panelist go all-in, and is only promoted to
 * an error when the operator turns on `enforceBudgetReserve`.
 */
export function validateAward(
  state: EventState,
  input: AwardInput,
): AwardValidation {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const finding = state.findings.find((f) => f.id === input.findingId);
  const panelist = state.panelists.find((p) => p.id === input.panelistId);
  const objective = state.objectives.find((o) => o.id === input.objectiveId);

  if (!finding) errors.push({ code: "no_finding", message: "That finding no longer exists." });
  if (!panelist) errors.push({ code: "no_panelist", message: "That panelist no longer exists." });
  if (!objective) errors.push({ code: "no_objective", message: "That objective no longer exists." });
  if (!finding || !panelist || !objective) return { errors, warnings, ok: false };

  const others = state.transactions.filter(
    (t) => t.id !== input.excludeTransactionId,
  );

  if (!finding.submitted) {
    warnings.push({
      code: "unsubmitted",
      message: `“${finding.headline}” has not been submitted by its breakout yet.`,
    });
  }

  // A finding cannot be sold twice.
  const existingSale = others.find((t) => t.findingId === finding.id);
  if (existingSale) {
    const buyer = state.panelists.find((p) => p.id === existingSale.panelistId);
    errors.push({
      code: "already_sold",
      message: `Already acquired by ${buyer?.name ?? "another panelist"} for ${existingSale.price} credits.`,
    });
  }

  // One finding per objective, per panelist.
  const slotTaken = others.find(
    (t) => t.panelistId === panelist.id && t.objectiveId === objective.id,
  );
  if (slotTaken) {
    const held = state.findings.find((f) => f.id === slotTaken.findingId);
    errors.push({
      code: "slot_filled",
      message: `${panelist.name} already filled ${objective.name} with “${held?.headline ?? "another finding"}”.`,
    });
  }

  // Price sanity.
  if (!Number.isFinite(input.price) || !Number.isInteger(input.price)) {
    errors.push({ code: "price_integer", message: "Bid must be a whole number of credits." });
  } else if (input.price < state.event.minBid) {
    errors.push({
      code: "below_min",
      message: `Minimum bid is ${state.event.minBid} credit${state.event.minBid === 1 ? "" : "s"}.`,
    });
  }

  // Budget. Recomputed against `others` so editing a transaction refunds the
  // old price before testing the new one.
  const spentByOthers = others
    .filter((t) => t.panelistId === panelist.id)
    .reduce((sum, t) => sum + t.price, 0);
  const remaining = panelist.startingBudget - spentByOthers;

  if (input.price > remaining) {
    errors.push({
      code: "insufficient",
      message: `${panelist.name} has only ${remaining} credit${remaining === 1 ? "" : "s"} left.`,
    });
  } else {
    const filled = others.filter((t) => t.panelistId === panelist.id).length;
    const openAfterThis = Math.max(0, state.objectives.length - filled - 1);
    const reserve = openAfterThis * state.event.minBid;
    const leftAfter = remaining - input.price;

    if (leftAfter < reserve) {
      const issue: ValidationIssue = {
        code: "reserve",
        message:
          `Leaves ${leftAfter} credit${leftAfter === 1 ? "" : "s"} for ${openAfterThis} ` +
          `remaining objective${openAfterThis === 1 ? "" : "s"} — ${reserve} needed to fill them at the minimum bid.`,
      };
      if (state.event.enforceBudgetReserve) errors.push(issue);
      else warnings.push(issue);
    }
  }

  return { errors, warnings, ok: errors.length === 0 };
}

// --- Summary statistics ----------------------------------------------------

export interface EventSummary {
  totalFindings: number;
  submittedFindings: number;
  draftedFindings: number;
  totalSpent: number;
  totalBudget: number;
  averagePrice: number;
  highestValued: FindingView[];
  breakoutRepresentation: { breakout: Breakout; count: number; spend: number }[];
  undrafted: FindingView[];
  /** Only meaningful once every slot is filled; see `declareWinner`. */
  leaders: PanelistView[];
}

export function buildSummary(state: EventState): EventSummary {
  const views = allFindingViews(state);
  const drafted = views.filter((v) => v.isDrafted);
  const submitted = views.filter((v) => v.finding.submitted);

  const totalSpent = state.transactions.reduce((sum, t) => sum + t.price, 0);
  const totalBudget = state.panelists.reduce((s, p) => s + p.startingBudget, 0);

  const highestValued = [...drafted].sort(
    (a, b) => (b.transaction?.price ?? 0) - (a.transaction?.price ?? 0),
  );

  const breakoutRepresentation = sortedBreakouts(state)
    .map((breakout) => {
      const owned = drafted.filter((v) => v.finding.breakoutId === breakout.id);
      return {
        breakout,
        count: owned.length,
        spend: owned.reduce((sum, v) => sum + (v.transaction?.price ?? 0), 0),
      };
    })
    .sort((a, b) => b.count - a.count || b.spend - a.spend);

  // "Notable" undrafted findings surface the breakouts' own top picks first.
  const undrafted = submitted
    .filter((v) => !v.isDrafted)
    .sort(
      (a, b) =>
        a.finding.breakoutRank - b.finding.breakoutRank ||
        (a.breakout?.sortOrder ?? 0) - (b.breakout?.sortOrder ?? 0),
    );

  // Ranked by slots filled, then by credits held in reserve. Deliberately not
  // surfaced unless the operator opts in — this is a policy exercise, not a game.
  const leaders = allPanelistViews(state).sort(
    (a, b) => b.filledCount - a.filledCount || b.remaining - a.remaining,
  );

  return {
    totalFindings: views.length,
    submittedFindings: submitted.length,
    draftedFindings: drafted.length,
    totalSpent,
    totalBudget,
    averagePrice: drafted.length ? totalSpent / drafted.length : 0,
    highestValued,
    breakoutRepresentation,
    undrafted,
    leaders,
  };
}
